// 世帯の書き出し（GET ?familyId= → zip を受け取る）。法33条（電磁的記録での開示）・こども家庭庁ガイドライン5.5の8番に合わせる。
// 中身: はじめに.txt・家族の設定・本人・同意の履歴・記録（JSON と CSV）・写真と録音と映画の原本（暗号を解いた物）。未来の手紙は入れない（lib/letters.ts）。
// 見せてよい本人の分だけ（読むだけの人は、見える本人の分だけを受け取れる）。
// 読むだけの人（祖父母など・member）の書き出しは、子の手帳の記録と、子とその人自身の写真・声だけ（lib/mother-records.ts。作り手の決め 2026-11-05:
// 読むだけの人にはママの記録を見せない）。ママの頁・妊娠中のワクチン・お産のしかた・まだ OK していない候補・健診・予定・下書き・一冊・手帳に聞く・
// 家族の設定・だれの物か決まっていない写真は入れない。ママが招く時に選ぶ「見せる項目」（proxies.scope）はまだどこでも読んでいないので、選んだ項目に関わらず入れない。
// 紙の母子手帳の並びの PDF はまだ入れていない（手帳の「一冊」の画面から印刷して PDF にできる）。
import { route } from "@/lib/api";
import { withHousehold } from "@/lib/access";
import { consentHistory, audit } from "@/lib/households";
import { readVariant } from "@/lib/media";
import type { MediaData } from "@/lib/media-shared";
import type { Doc, DocType } from "@/lib/db";
import { readerEntry, recordViewerOf } from "@/lib/mother-records";
import { csvCell, zip, type ZipEntry } from "./zip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: DocType[] = ["profile", "techo", "record", "visit", "done", "plan", "draft", "book", "advice", "chat", "local"];

/** 読むだけの人に渡す手帳の記録（だれの物か決まった記録は、渡してよい本人の物だけ。ママの記録と候補は無し） */
function readerDoc(d: Doc<Record<string, unknown>>, shown: ReadonlySet<string>): Doc<Record<string, unknown>> | null {
  if (d.subjectId && !shown.has(d.subjectId)) return null;
  const e = d.data;
  if (e.pending || typeof e.page !== "string" || !e.values || typeof e.values !== "object") return null;
  const data = readerEntry(e as { page: string; values: Record<string, unknown>; note?: string });
  return data ? { ...d, data } : null;
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/heic": "heic", "image/heif": "heif", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/quicktime": "mov", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/webm": "webm", "audio/wav": "wav", "application/pdf": "pdf",
};

export const GET = route(async (req: Request) => {
  const familyId = new URL(req.url).searchParams.get("familyId");
  const ctx = await withHousehold(req, familyId, ["record:read", "media:read"]);
  const hid = ctx.household.id;
  const day = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const entries: ZipEntry[] = [];
  const skipped: string[] = [];
  // 読むだけの人か。その人に渡してよい本人は、子とその人自身だけ（代理の印でママが見えていても、ママの分は渡さない）
  const reader = recordViewerOf({ legacy: false, role: ctx.role, account: ctx.account, ctx }) === "reader";
  const subjects = reader ? ctx.subjects.filter((s) => s.kind === "child" || (!!ctx.account && s.accountId === ctx.account.id)) : ctx.subjects;
  const shown = new Set(subjects.map((s) => s.id));

  // 記録
  const docs = reader
    ? ctx.db.list<Record<string, unknown>>("techo", { limit: 100000 }).flatMap((d) => readerDoc(d, shown) ?? [])
    : TYPES.flatMap((t) => ctx.db.list<Record<string, unknown>>(t, { limit: 100000 }));
  entries.push({ name: "記録/records.json", data: JSON.stringify(docs, null, 2) });
  const csv = [
    ["id", "type", "date", "subject_id", "created_at", "updated_at", "data"].join(","),
    ...docs.map((d) => [d.id, d.type, d.date, d.subjectId ?? "", d.createdAt, d.updatedAt, d.data].map(csvCell).join(",")),
  ].join("\r\n");
  entries.push({ name: "記録/records.csv", data: `﻿${csv}` }); // Excel で文字化けしないよう BOM を付ける

  if (!reader) entries.push({ name: "家族の設定.json", data: JSON.stringify(ctx.family, null, 2) });
  entries.push({ name: "本人.json", data: JSON.stringify(subjects, null, 2) });
  entries.push({ name: "同意の履歴.json", data: JSON.stringify(consentHistory(hid).filter((c) => shown.has(c.subjectId)), null, 2) });

  // 写真・録音・映画の原本（暗号を解いて入れる）。置き場と暗号の印は、画面で見る時と同じ readVariant で読む
  // （11/3 の最初の版から、原本は「置き場の鍵/orig」に「id:orig」の印で置いてある。ここだけ置き場の鍵そのものを読んでいて、全部「読めなかった」になっていた）
  // 読むだけの人には、渡してよい本人の物だけ（だれの物か決まっていない写真・声・映画は入れない）
  const media = ctx.db.media.list<MediaData>({ limit: 100000 }).filter((m) => !reader || (m.subjectId != null && shown.has(m.subjectId)));
  const index: Record<string, unknown>[] = [];
  for (const m of media) {
    const ext = EXT[m.mime] ?? "bin";
    const name = `写真と録音/${m.kind}/${(m.takenAt ?? m.createdAt).slice(0, 10)}_${m.id}.${ext}`;
    try {
      const got = await readVariant(ctx, m, "orig");
      if (!got) throw new Error("ファイルがありません");
      entries.push({ name, data: got.buf, date: new Date(m.takenAt ?? m.createdAt) });
      index.push({ file: name, id: m.id, kind: m.kind, subjectId: m.subjectId, takenAt: m.takenAt, mime: m.mime, data: m.data });
    } catch {
      skipped.push(`${m.kind} ${m.id}`);
    }
  }
  entries.push({ name: "写真と録音/一覧.json", data: JSON.stringify(index, null, 2) });

  entries.unshift({
    name: "はじめに.txt",
    data: [
      `母子手帳の書き出し（${day}）`,
      "",
      reader
        ? "- 記録/records.json と records.csv: 子の手帳の記録（CSV は Excel で開けます）"
        : "- 記録/records.json と records.csv: 手帳・予定の済み・下書きなどの記録（CSV は Excel で開けます）",
      reader ? "- 本人.json・同意の履歴.json" : "- 家族の設定.json・本人.json・同意の履歴.json",
      `- 写真と録音/: 原本（暗号を解いた物）${media.length - skipped.length}件`,
      reader
        ? "- 読むだけの方の書き出しには、子の手帳の記録と、子の写真・声だけが入ります。ママの記録（妊婦健診・家で測った物・妊娠中のワクチンなど）・健診・予定・下書き・家族の設定・だれの物か決まっていない写真は入りません"
        : null,
      skipped.length ? `- 読めなかったファイル ${skipped.length}件: ${skipped.join("、")}` : null,
      "- 紙の母子手帳の並びで見たい時は、アプリの「手帳」→「一冊」から印刷して PDF にできます",
      "- 健診の録音（健診の画面で録った物）は、まだこの書き出しに入っていません",
      "- 未来の手紙は、この書き出しに入りません（開く日まで、手帳の中で封をして守ります）",
      "",
      "この zip には家族の大事な情報が入っています。人に送る時は気をつけてください。",
    ]
      .filter((l) => l !== null)
      .join("\n"),
  });

  audit(hid, ctx.account?.id ?? null, "household.export", { detail: { docs: docs.length, media: media.length - skipped.length, scope: reader ? "reader" : "all" } });
  const out = zip(entries);
  return new Response(new Uint8Array(out), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="boshi-techo-${day}.zip"; filename*=UTF-8''${encodeURIComponent(`母子手帳-${day}.zip`)}`,
      "cache-control": "no-store",
    },
  });
});
