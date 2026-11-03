// 急ぎに見えた記録に添える電話先と、「期限」の印が法の期限らしいかの見分け（画面を持たない純粋な関数。試験は timeline-note.test.ts）。
import { clockAt } from "@/lib/clock";
import type { CaptureRecord, RecordData } from "@/lib/capture";
import type { Family } from "@/lib/demo-family";

/** 急ぎに見えた記録に添える固定の文（Claude の言葉ではなく、いつも同じ文）。母（妊娠中・産後の体）の事 */
export const URGENT_NOTE = "急ぎの時はかかりつけの産院へ電話（夜間も）。迷ったら119";
/** 子どもの事 */
export const URGENT_NOTE_CHILD = "かかりつけの小児科へ。夜や休みは #8000。命に関わる時は119";
/** 誰の事か分からない時（両方を短く） */
export const URGENT_NOTE_BOTH = "子どもはかかりつけの小児科・夜や休みは #8000。母の体はかかっている産院（夜間も）。命に関わる時は119";

/**
 * 急ぎの記録が、子どもの事か母の体の事かを、記録の who（誰の事）と家族の時期から見分ける（体の判断はしない。電話先を選ぶだけ）。
 * - 記録の日に妊娠中なら母（おなかの子の事も、かけ先は産院）
 * - who が子の呼び名なら子ども、母の呼び名なら母
 * - 生まれた後で who が分からない・パートナーの名前なら、両方を並べる
 */
export function urgentNoteFor(r: Pick<CaptureRecord, "date" | "createdAt" | "data">, family: Family): string {
  const date = r.date ?? r.createdAt.slice(0, 10);
  if (clockAt(family, date).phase === "pregnant") return URGENT_NOTE;
  const who = (r.data.who ?? "").trim();
  if (who) {
    const child = family.childName?.trim();
    if (child && (who.includes(child) || child.includes(who))) return URGENT_NOTE_CHILD;
    if (/赤ちゃん|子ども|こども|子供|息子|娘|この子|上の子/.test(who)) return URGENT_NOTE_CHILD;
    if (family.members.some((m) => m.role === "母" && m.name === who) || /^(母|ママ|私の体)$/.test(who)) return URGENT_NOTE;
  }
  return URGENT_NOTE_BOTH;
}

/**
 * 法で決まった期限らしいか（届出・申請・提出など、役所の手続き）。予定に「期限」の印が付いていても、
 * お宮参りやお祝いの集まりは法の期限ではないので、赤くしない。言葉で見分ける近似（取りこぼしは muted に倒れる）。
 */
export function isLegalDeadline(d: Pick<RecordData, "isDeadline" | "title" | "detail" | "deadlineSource">): boolean {
  if (!d.isDeadline) return false;
  const text = `${d.title} ${d.detail ?? ""} ${d.deadlineSource ?? ""}`;
  return /届|申請|申し込|申込|提出|手続|役所|役場|区役所|市役所|町役場|保険証|マイナ|児童手当|給付|助成|医療証|認定|入所|入園|出生|健康保険|育休|育児休業|年金|税/.test(text);
}

