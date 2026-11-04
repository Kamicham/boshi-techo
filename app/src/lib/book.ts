// ⑦ 子どもへの贈り物: 1000日の記録を集めて、子どもに語りかける一冊にする。
// 記録の中身は他の機能が書くので、形が分からない前提で柔らかく読む（無い項目は飛ばす）。
// 写真: Claude に渡すのは写真の文字の一覧（日付・月齢・節目・家族の一言・結んだ手帳の記録・★の数）だけで、画像は渡さない。
// 「写真を見ずに、記録の言葉から写真を選んで章を書く」。★・節目・手帳に結んだ写真を候補の上に置き、家族の選びを Claude より強くする。
import "server-only";
import { z } from "zod";
import { structured } from "./claude";
import { conceptionDate, secondBirthday } from "./clock";
import { list, put, type Doc } from "./db";
import type { Family } from "./demo-family";
import { getFamily, HttpError } from "./family";
import { bookPhotoCandidates, type BookPhoto } from "./media";
import { PERIODS, periodOfDate, type Period } from "./media-shared";
import type { TechoEntry } from "./techo";
import { listTecho } from "./techo-store";

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
        photos: z
          .array(
            z.object({
              mediaId: z.string().describe("写真の候補の番号（P1 など）。渡した候補の番号だけ"),
              line: z.string().describe("写真に添える短い一言。候補の一言・記録にある事だけ。15字まで。無ければ空"),
            }),
          )
          .describe("この章に置く写真（その時期の候補から0〜4枚。★・節目・手帳に結んだ写真を先に）。候補が無ければ空"),
      }),
    )
    .describe("時期ごとの章。記録のある時期だけ、渡した順に"),
  closing: z.string().describe("最後のページの言葉。いつかこの本を読む子どもへ。2〜4文"),
  cover: z.string().describe("表紙の写真の候補の番号（P1 など）。写真の候補が無ければ空文字"),
  film: z
    .array(
      z.object({
        mediaId: z.string().describe("写真の候補の番号（P1 など）"),
        sec: z.number().describe("映す秒数（3〜6）"),
        caption: z.string().describe("字幕。章の言葉から短く。20字まで"),
      }),
    )
    .describe("約2分の動画集の台本。選んだ写真から10〜24枚を古い順に。写真の候補が無ければ空"),
});

export type BookContent = z.infer<typeof BookSchema>;

export interface Book extends BookContent {
  familyId: string;
  /** この日までの記録で作った */
  asOf: string;
  generatedAt: string;
  /** 使った記録の数 */
  sourceCount: number;
  /** 写真の候補の数（文字だけを Claude に渡した。前の版の一冊には無い） */
  photoCount?: number;
  /** 1000日の始まりと終わり */
  range: { start: string; end: string };
  childName: string;
  /** 作った時の決まりの版（BOOK_RULES）。前の版の一冊には無い */
  rules?: number;
  /** 読む時に付ける: 前の決まりで作られ、今は入れない記録（気がかり）が入っているかもしれない */
  outdated?: boolean;
}

/** 一冊の決まりの版。2 = 気がかりの記録を入れない（第30回の後） */
export const BOOK_RULES = 2;

// ── 記録を集める ──

export interface Entry {
  date: string;
  kind: "記録" | "健診" | "済んだ手続き" | "手帳";
  text: string;
}

// 時期は写真のアルバムと同じ（lib/media-shared.ts が正本）
export { PERIODS, type Period };

/** 家族の時計で時期に分ける（生まれた日〜生後6日は「生まれた日」の章） */
export function periodOf(f: Family, date: string): Period {
  return periodOfDate(f.birthDate, date);
}

const MAX_TEXT = 600;
const MAX_ENTRIES = 300;

function str(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function strList(v: unknown): string | null {
  if (Array.isArray(v)) {
    const xs = v
      .map((x) => {
        if (typeof x === "string") return x;
        if (typeof x !== "object" || !x) return null;
        const o = x as Record<string, unknown>;
        // 健診の said は { point, quote }。元の言葉（quote）を添える
        const point = str(o.point);
        const quote = str(o.quote);
        if (point) return quote && quote !== point ? `${point}（「${quote}」）` : point;
        return str(o.text) ?? str(o.said) ?? quote;
      })
      .filter(Boolean);
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
  // 気がかり（体・様子の心配）は子に渡す一冊に書かない（「何が本になる？」の約束。第30回で言葉の心配が本に入った）
  if (data.kind === "気がかり") return null;
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
  // 健診の整理は VisitData.result にある（lib/visit.ts）。終わった健診だけを使う
  if (data.kind !== "visit" || data.status !== "done") return null;
  const result = data.result && typeof data.result === "object" ? (data.result as Record<string, unknown>) : null;
  if (!result) return null;
  const summary = strList(result.summary);
  const said = strList(result.said);
  const parts = [summary && `整理: ${summary}`, said && `先生の言葉: ${said}`].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

const CONFIRMED = new Set(["ok", "確定", "済み", "送った", "done", "confirmed", "sent", "approved", "final"]);

function draftText(data: Record<string, unknown>): string | null {
  const status = str(data.status);
  const ok = data.confirmed === true || data.approved === true || (status != null && CONFIRMED.has(status));
  if (!ok) return null;
  return str(data.title);
}

/**
 * 手帳の記録（家族が OK した物）を一冊の文にする。体の数字・便の色・検査・母の健康状態は入れない（一冊は思い出の本）。
 * 健診は見出しだけ（「1か月健診」）。
 */
export function techoText(e: TechoEntry): string | null {
  const title = str(e.title);
  const v = (e.values ?? {}) as Record<string, unknown>;
  switch (e.page) {
    case "feeling": {
      const text = str(v.text) ?? title;
      return text ? `${e.who ? `${e.who}の` : ""}気持ち: ${text}` : null;
    }
    case "development":
      return title || str(v.item) ? `${title ?? str(v.item)}ができた日` : null;
    case "birth":
      return title ? `出産の記録: ${title}` : "生まれた日";
    case "vaccine":
      return title ? `予防接種（${title}）` : null;
    case "child-checkup":
    case "pregnancy-checkup":
      return title;
    default:
      return null;
  }
}

/** 今日までの記録を日付順に集める（family を渡さなければ id から引く。手帳の作った記録を時点で作るため） */
export function gather(familyId: string, today: string, family?: Family | null): Entry[] {
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
  const f = family ?? getFamily(familyId);
  for (const d of listTecho(familyId, { family: f ?? undefined, today })) {
    const e = d.data;
    if (!e || e.pending || !/^\d{4}-\d{2}-\d{2}$/.test(e.date ?? "") || e.date > today) continue;
    const text = techoText(e);
    if (text) out.push({ date: e.date, kind: "手帳", text: clip(text) });
  }
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
- 「できた日」は、できた事をそのまま喜ぶ。早い・遅い・目安との比べは書かない。
- 手続きは、家族があなたを迎えるためにした事として、さらりと触れる。
- 章は渡した時期の順に、記録のある時期だけ。period は渡した時期の名前をそのまま使う。
- moments の date は記録の日付をそのまま使う。
- 家族の名前は記録と家族の情報にある呼び名だけを使う。
写真:
- 写真は見ていない。渡すのは写真の候補の文字の一覧（番号・日付・月齢・節目・家族の一言・結んだ手帳の記録・★の数）だけ。写真に何が写っているかを想像して書かない。
- 章の photos は、その時期の候補から0〜4枚を番号（P1 など）で選ぶ。★・節目・手帳に結んだ写真を先に。line は候補の一言か記録にある事だけで短く（無ければ空）。
- cover は一番の1枚の番号。候補が無ければ空文字。film は動画集の台本で、選んだ写真から10〜24枚を古い順に、sec は3〜6、caption は章の言葉から短く。候補が無ければ空。`;

/** 1章あたり・全体の写真の候補の数（多すぎると Claude への文が長くなる） */
const PHOTOS_PER_PERIOD = 12;
const PHOTOS_TOTAL = 60;
const FILM_MAX_SEC = 120;

export interface PhotoKey {
  key: string;
  photo: BookPhoto;
}

/**
 * 写真の候補を選ぶ。時期ごとに、★・節目・手帳に結んだ写真・一言のある写真、前の一冊に入れた写真の順に上から取る。
 * 番号（P1…）を振る（Claude には写真の id も画像も渡さない）。
 */
export function photoKeys(candidates: readonly BookPhoto[], prevIds: ReadonlySet<string> = new Set()): PhotoKey[] {
  const out: BookPhoto[] = [];
  for (const p of PERIODS) {
    const xs = candidates
      .filter((c) => c.period === p)
      .map((c) => ({ c, s: c.score + (prevIds.has(c.id) ? 4 : 0) }))
      .sort((a, b) => b.s - a.s || a.c.date.localeCompare(b.c.date))
      .slice(0, PHOTOS_PER_PERIOD)
      .map((x) => x.c);
    out.push(...xs);
  }
  return out
    .slice(0, PHOTOS_TOTAL)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((photo, i) => ({ key: `P${i + 1}`, photo }));
}

/** Claude に渡す文（文字だけ）。写真が0枚なら写真の段は書かない */
export function bookInput(f: Family, today: string, entries: readonly Entry[], keys: readonly PhotoKey[]): string {
  const childName = f.childName ?? "あなた";
  const groups = new Map<Period, Entry[]>();
  for (const e of entries) {
    const p = periodOf(f, e.date);
    groups.set(p, [...(groups.get(p) ?? []), e]);
  }
  const photosOf = (p: Period) => keys.filter((k) => k.photo.period === p);
  const photoLine = ({ key, photo: x }: PhotoKey) =>
    `- ${key} ${x.date}・${x.age}${x.milestone ? `・節目「${x.milestone}」` : ""}${x.star ? `・★${x.star}` : ""}${x.caption ? `・一言「${x.caption}」` : ""}${x.techo.length ? `・手帳「${x.techo.join("・")}」` : ""}`;
  const members = f.members.map((m) => `${m.name}（${m.role}）`).join("、") || "（呼び名なし）";
  return [
    `子どもの呼び名: ${childName}`,
    `家族: ${members}`,
    `出産予定日: ${f.dueDate}${f.birthDate ? `／生まれた日: ${f.birthDate}` : "／まだ生まれていない"}`,
    `この本は ${today} までの記録で作る。`,
    keys.length ? `写真の候補は ${keys.length} 枚（文字だけ。画像は渡していない）。` : "写真はまだ無い（photos・cover・film は空にする）。",
    "",
    ...PERIODS.filter((p) => groups.has(p) || photosOf(p).length).flatMap((p) => [
      `## ${p}`,
      ...(groups.get(p) ?? []).map((e) => `- ${e.date}［${e.kind}］${e.text}`),
      ...(photosOf(p).length ? ["### 写真の候補", ...photosOf(p).map(photoLine)] : []),
      "",
    ]),
  ].join("\n");
}

/**
 * Claude の答えの写真の番号を、写真の id に戻す。候補に無い番号は落とす。
 * - 章に写真の候補があるのに1枚も選ばれなかった時は、上位（★・節目）から足す（家族の選びを Claude より強く）
 * - 表紙が無ければ、一番重い1枚。動画集が無ければ、章の写真から作る。合わせて2分まで
 */
export function settlePhotos(content: BookContent, keys: readonly PhotoKey[]): BookContent {
  const byKey = new Map(keys.map((k) => [k.key, k.photo]));
  const idOf = (k: string) => byKey.get(k.trim())?.id ?? null;
  const chapters = content.chapters.map((ch) => {
    const seen = new Set<string>();
    let photos = (ch.photos ?? []).flatMap((p) => {
      const id = idOf(p.mediaId);
      if (!id || seen.has(id)) return [];
      seen.add(id);
      return [{ mediaId: id, line: (p.line ?? "").slice(0, 40) }];
    });
    const period = (PERIODS as readonly string[]).includes(ch.period) ? (ch.period as Period) : null;
    const pool = keys.filter((k) => k.photo.period === period).map((k) => k.photo);
    if (!photos.length && pool.length) {
      photos = [...pool]
        .sort((a, b) => b.score - a.score || a.date.localeCompare(b.date))
        .slice(0, Math.min(3, pool.length))
        .map((p) => ({ mediaId: p.id, line: p.caption?.slice(0, 40) ?? "" }));
    }
    return { ...ch, photos: photos.slice(0, 4) };
  });
  const all = keys.map((k) => k.photo);
  const cover = idOf(content.cover ?? "") ?? [...all].sort((a, b) => b.score - a.score || a.date.localeCompare(b.date))[0]?.id ?? "";
  let film = (content.film ?? []).flatMap((x) => {
    const id = idOf(x.mediaId);
    return id ? [{ mediaId: id, sec: Math.min(6, Math.max(3, Number(x.sec) || 4)), caption: (x.caption ?? "").slice(0, 40) }] : [];
  });
  if (!film.length) film = chapters.flatMap((ch) => ch.photos.map((p) => ({ mediaId: p.mediaId, sec: 4, caption: p.line || ch.title })));
  const out: BookContent["film"] = [];
  let total = 0;
  for (const x of film) {
    if (total + x.sec > FILM_MAX_SEC) break;
    out.push(x);
    total += x.sec;
  }
  return { ...content, chapters, cover, film: out };
}

export async function makeBook(f: Family, today: string): Promise<Book> {
  const entries = gather(f.id, today, f);
  if (entries.length === 0) {
    throw new HttpError(422, "まだ一冊にする記録がありません。「話す・撮る」で記録をためると、ここで一冊になります");
  }
  const childName = f.childName ?? "あなた";
  // 作り直した時も、前の一冊に入れた写真を残す方へ寄せる
  const prev = latestBook(f.id);
  const prevIds = new Set([...(prev?.chapters ?? []).flatMap((c) => (c.photos ?? []).map((p) => p.mediaId)), ...(prev?.cover ? [prev.cover] : [])]);
  const keys = photoKeys(bookPhotoCandidates(f, today), prevIds);
  const body = bookInput(f, today, entries, keys);

  // Claude に渡すのは文字だけ（画像は渡さない）
  const raw = await structured(BookSchema, SYSTEM, body, { effort: "high", task: "book" });
  const content = settlePhotos(raw, keys);
  const book: Book = {
    ...content,
    familyId: f.id,
    asOf: today,
    generatedAt: new Date().toISOString(),
    sourceCount: entries.length,
    photoCount: keys.length,
    range: { start: conceptionDate(f), end: secondBirthday(f) },
    childName,
    rules: BOOK_RULES,
  };
  put(f.id, "book", book, { date: today });
  return book;
}

/** 最新の一冊（today を渡すと、その日までに作った物の中で最新。デモの早送りで未来の本を出さない） */
export function latestBook(familyId: string, today?: string): Book | null {
  const books = list<Book>(familyId, "book", { limit: 50 });
  const hit = today ? books.find((b) => (b.date ?? "") <= today) : books[0];
  if (!hit) return null;
  const book = hit.data;
  // 前の決まりで作った一冊に、今は入れない気がかりの記録が入っているか（作った時より前の気がかりがあれば、作り直しを勧める）
  if ((book.rules ?? 1) < BOOK_RULES && list<{ kind?: string }>(familyId, "record").some((d) => d.data.kind === "気がかり" && d.createdAt <= book.generatedAt)) {
    return { ...book, outdated: true };
  }
  return book;
}
