// ⑦ 子どもへの贈り物: 1000日の記録を集めて、子どもに語りかける一冊にする。
// 記録の中身は他の機能が書くので、形が分からない前提で柔らかく読む（無い項目は飛ばす）。
import "server-only";
import { z } from "zod";
import { structured } from "./claude";
import { conceptionDate, diffDays, secondBirthday } from "./clock";
import { list, put, type Doc } from "./db";
import type { Family } from "./demo-family";
import { HttpError } from "./family";

// ── 一冊の形 ──

export const BookSchema = z.object({
  title: z.string().describe("一冊の題。子どもの呼び名を入れてよい。20字まで"),
  dedication: z.string().describe("表紙の次のページに置く、子どもへの献辞。親の言葉で2〜4文"),
  chapters: z
    .array(
      z.object({
        period: z.string().describe("時期の名前。渡した時期の名前をそのまま使う"),
        title: z.string().describe("章の題。その時期の記録から一番らしい一言。15字まで"),
        text: z.string().describe("子どもに語りかける本文。親の言葉づかい。段落は改行2つで区切る"),
        moments: z
          .array(z.object({ date: z.string().describe("YYYY-MM-DD。記録の日付"), text: z.string().describe("その日の出来事を一文で") }))
          .describe("この時期の小さな出来事（記録にある物だけ。0〜6個）"),
      }),
    )
    .describe("時期ごとの章。記録のある時期だけ、渡した順に"),
  closing: z.string().describe("最後のページの言葉。いつかこの本を読む子どもへ。2〜4文"),
});

export type BookContent = z.infer<typeof BookSchema>;

export interface Book extends BookContent {
  familyId: string;
  /** この日までの記録で作った */
  asOf: string;
  generatedAt: string;
  /** 使った記録の数 */
  sourceCount: number;
  /** 1000日の始まりと終わり */
  range: { start: string; end: string };
  childName: string;
}

// ── 記録を集める ──

export interface Entry {
  date: string;
  kind: "記録" | "健診" | "済んだ手続き";
  text: string;
}

export const PERIODS = ["おなかにいた日々", "生まれた日", "はじめての一年", "二歳までの一年"] as const;
export type Period = (typeof PERIODS)[number];

/** 家族の時計で時期に分ける（生まれた日〜生後6日は「生まれた日」の章） */
export function periodOf(f: Family, date: string): Period {
  const birth = f.birthDate;
  if (!birth || diffDays(date, birth) < 0) return "おなかにいた日々";
  const age = diffDays(date, birth);
  if (age <= 6) return "生まれた日";
  if (age < 365) return "はじめての一年";
  return "二歳までの一年";
}

const MAX_TEXT = 600;
const MAX_ENTRIES = 300;

function str(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function strList(v: unknown): string | null {
  if (Array.isArray(v)) {
    const xs = v.map((x) => (typeof x === "string" ? x : typeof x === "object" && x ? str((x as Record<string, unknown>).text) ?? str((x as Record<string, unknown>).said) : null)).filter(Boolean);
    return xs.length ? xs.join(" / ") : null;
  }
  return str(v);
}

function clip(s: string): string {
  return s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT)}…` : s;
}

function dateOf(d: Doc): string {
  const raw = d.date ?? str(d.data.date) ?? d.createdAt;
  return raw.slice(0, 10);
}

function recordText(data: Record<string, unknown>): string | null {
  const parts: string[] = [];
  const who = str(data.who) ?? str(data.by) ?? str(data.author);
  const main = str(data.text) ?? str(data.transcript) ?? str(data.said) ?? str(data.note) ?? str(data.body);
  const summary = str(data.summary) ?? str(data.title);
  const caption = str(data.caption) ?? str(data.photoCaption) ?? str(data.imageDescription);
  if (summary && summary !== main) parts.push(summary);
  if (main) parts.push(main);
  if (caption) parts.push(`（写真: ${caption}）`);
  if (!parts.length) return null;
  return `${who ? `${who}: ` : ""}${parts.join(" ")}`;
}

function visitText(data: Record<string, unknown>): string | null {
  const summary = strList(data.summary);
  const said = strList(data.said);
  const parts = [summary && `整理: ${summary}`, said && `先生の言葉: ${said}`].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

const CONFIRMED = new Set(["確定", "済み", "送った", "done", "confirmed", "sent", "approved", "final"]);

function draftText(data: Record<string, unknown>): string | null {
  const status = str(data.status);
  const ok = data.confirmed === true || data.approved === true || (status != null && CONFIRMED.has(status));
  if (!ok) return null;
  return str(data.title);
}

/** 今日までの記録を日付順に集める */
export function gather(familyId: string, today: string): Entry[] {
  const out: Entry[] = [];
  const add = (docs: Doc[], kind: Entry["kind"], read: (d: Record<string, unknown>) => string | null) => {
    for (const d of docs) {
      if (!d.data || typeof d.data !== "object") continue;
      const date = dateOf(d);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) continue;
      const text = read(d.data);
      if (text) out.push({ date, kind, text: clip(text) });
    }
  };
  add(list(familyId, "record"), "記録", recordText);
  add(list(familyId, "visit"), "健診", visitText);
  add(list(familyId, "draft"), "済んだ手続き", draftText);
  out.sort((a, b) => a.date.localeCompare(b.date));
  // 多すぎる時は、時期の偏りが出ないよう等間隔に間引く
  if (out.length <= MAX_ENTRIES) return out;
  const step = out.length / MAX_ENTRIES;
  return Array.from({ length: MAX_ENTRIES }, (_, i) => out[Math.floor(i * step)]);
}

// ── 一冊を作る ──

const SYSTEM = `あなたの役割: 家族の1000日の記録から、いつか子どもに手渡す一冊の本を書く。
書き方:
- 子どもに語りかける文。親（母とパートナー）の言葉づかいで、やさしく、あたたかく。「あなた」または子どもの呼び名で呼びかける。
- 事実は渡した記録にある事だけ。記録に無い出来事・気持ち・会話・天気・場所を足さない。「はじめて」「いつも」なども記録にある時だけ。足りない所は短くてよい。
- 健診の内容は「先生とこんな話をした」「こんな事を聞いた」と中立に書く。体の良し悪し・数値の評価・正常や異常は書かない。心配した事は「気になって先生に聞いた」まで。
- 手続きは、家族があなたを迎えるためにした事として、さらりと触れる。
- 章は渡した時期の順に、記録のある時期だけ。period は渡した時期の名前をそのまま使う。
- moments の date は記録の日付をそのまま使う。
- 家族の名前は記録と家族の情報にある呼び名だけを使う。`;

export async function makeBook(f: Family, today: string): Promise<Book> {
  const entries = gather(f.id, today);
  if (entries.length === 0) {
    throw new HttpError(422, "まだ一冊にする記録がありません。「話す・撮る」で記録をためると、ここで一冊になります");
  }
  const childName = f.childName ?? "あなた";
  const groups = new Map<Period, Entry[]>();
  for (const e of entries) {
    const p = periodOf(f, e.date);
    groups.set(p, [...(groups.get(p) ?? []), e]);
  }
  const members = f.members.map((m) => `${m.name}（${m.role}）`).join("、") || "（呼び名なし）";
  const body = [
    `子どもの呼び名: ${childName}`,
    `家族: ${members}`,
    `出産予定日: ${f.dueDate}${f.birthDate ? `／生まれた日: ${f.birthDate}` : "／まだ生まれていない"}`,
    `この本は ${today} までの記録で作る。`,
    "",
    ...PERIODS.filter((p) => groups.has(p)).flatMap((p) => [
      `## ${p}`,
      ...groups.get(p)!.map((e) => `- ${e.date}［${e.kind}］${e.text}`),
      "",
    ]),
  ].join("\n");

  const content = await structured(BookSchema, SYSTEM, body, { effort: "high" });
  const book: Book = {
    ...content,
    familyId: f.id,
    asOf: today,
    generatedAt: new Date().toISOString(),
    sourceCount: entries.length,
    range: { start: conceptionDate(f), end: secondBirthday(f) },
    childName,
  };
  put(f.id, "book", book, { date: today });
  return book;
}

/** 最新の一冊（today を渡すと、その日までに作った物の中で最新。デモの早送りで未来の本を出さない） */
export function latestBook(familyId: string, today?: string): Book | null {
  const books = list<Book>(familyId, "book", { limit: 50 });
  const hit = today ? books.find((b) => (b.date ?? "") <= today) : books[0];
  return hit?.data ?? null;
}
