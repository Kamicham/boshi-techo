// 世帯の書き出し（GET ?familyId= → zip を受け取る）。法33条（電磁的記録での開示）・こども家庭庁ガイドライン5.5の8番に合わせる。
// 中身: はじめに.txt・家族の設定・本人・同意の履歴・記録（JSON と CSV）・写真と録音の原本（暗号を解いた物）。
// 見せてよい本人の分だけ（読むだけの人は、見える本人の分だけを受け取れる）。
// 紙の母子手帳の並びの PDF はまだ入れていない（手帳の「一冊」の画面から印刷して PDF にできる）。
import { route } from "@/lib/api";
import { withHousehold } from "@/lib/access";
import { consentHistory, audit } from "@/lib/households";
import { openForHousehold } from "@/lib/crypto";
import type { DocType } from "@/lib/db";
import { csvCell, zip, type ZipEntry } from "./zip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: DocType[] = ["profile", "techo", "record", "visit", "done", "plan", "draft", "book", "advice", "chat", "local"];

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

  // 記録
  const docs = TYPES.flatMap((t) => ctx.db.list<Record<string, unknown>>(t, { limit: 100000 }));
  entries.push({ name: "記録/records.json", data: JSON.stringify(docs, null, 2) });
  const csv = [
    ["id", "type", "date", "subject_id", "created_at", "updated_at", "data"].join(","),
    ...docs.map((d) => [d.id, d.type, d.date, d.subjectId ?? "", d.createdAt, d.updatedAt, d.data].map(csvCell).join(",")),
  ].join("\r\n");
  entries.push({ name: "記録/records.csv", data: `﻿${csv}` }); // Excel で文字化けしないよう BOM を付ける

  entries.push({ name: "家族の設定.json", data: JSON.stringify(ctx.family, null, 2) });
  entries.push({ name: "本人.json", data: JSON.stringify(ctx.subjects, null, 2) });
  const seen = new Set(ctx.subjects.map((s) => s.id));
  entries.push({ name: "同意の履歴.json", data: JSON.stringify(consentHistory(hid).filter((c) => seen.has(c.subjectId)), null, 2) });

  // 写真・録音の原本（暗号を解いて入れる）
  const media = ctx.db.media.list({ limit: 100000 });
  const index: Record<string, unknown>[] = [];
  for (const m of media) {
    const ext = EXT[m.mime] ?? "bin";
    const name = `写真と録音/${m.kind}/${(m.takenAt ?? m.createdAt).slice(0, 10)}_${m.id}.${ext}`;
    try {
      const buf = await ctx.storage.get(m.storageKey);
      if (!buf) throw new Error("ファイルがありません");
      let plain = buf;
      if (m.iv && m.tag) {
        const sealed = { ciphertext: buf, iv: m.iv, tag: m.tag };
        try {
          plain = openForHousehold(hid, sealed, m.id);
        } catch {
          plain = openForHousehold(hid, sealed);
        }
      }
      entries.push({ name, data: plain, date: new Date(m.takenAt ?? m.createdAt) });
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
      "- 記録/records.json と records.csv: 手帳・予定の済み・下書きなどの記録（CSV は Excel で開けます）",
      "- 家族の設定.json・本人.json・同意の履歴.json",
      `- 写真と録音/: 原本（暗号を解いた物）${media.length - skipped.length}件`,
      skipped.length ? `- 読めなかったファイル ${skipped.length}件: ${skipped.join("、")}` : null,
      "- 紙の母子手帳の並びで見たい時は、アプリの「手帳」→「一冊」から印刷して PDF にできます",
      "- 健診の録音（健診の画面で録った物）は、まだこの書き出しに入っていません",
      "",
      "この zip には家族の大事な情報が入っています。人に送る時は気をつけてください。",
    ]
      .filter((l) => l !== null)
      .join("\n"),
  });

  audit(hid, ctx.account?.id ?? null, "household.export", { detail: { docs: docs.length, media: media.length - skipped.length } });
  const out = zip(entries);
  return new Response(new Uint8Array(out), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="boshi-techo-${day}.zip"; filename*=UTF-8''${encodeURIComponent(`母子手帳-${day}.zip`)}`,
      "cache-control": "no-store",
    },
  });
});
