// 子どもから見た呼び名（総点検 2-2・2026-11-04）。家族の一人ずつが持つ「ママ」「パパ」「かあちゃん」など。
// 使うのは、子どもへ向けた物（手紙・一冊・映画）の言い方だけ。予定表の題と担当（誰の番）には使わない（そちらは名前で言う）。
// 呼び名を入れていない家族（11/5 より前に作った家族を含む）は、今までどおり名前で言う。役（母・パートナー）から呼び名を決めつけない。
import type { Family } from "./demo-family";

/** 呼び名を整える（前後の空白を取り、10字まで。空なら undefined） */
export function cleanCallName(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim().slice(0, 10);
  return s || undefined;
}

/** 保存の口で家族の一人に付ける呼び名の欄（無ければ何も付けない＝11/4 までの形のまま） */
export function callNameField(v: unknown): { callName?: string } {
  const c = cleanCallName(v);
  return c ? { callName: c } : {};
}

/** 子どもに向けて、その人を言う形（「ママ（美咲）」）。呼び名が無い人・家族の外の人は名前だけ。呼び名が名前と同じなら1つ */
export function childView(family: Pick<Family, "members">, name: string): string {
  const c = family.members.find((x) => x.name === name)?.callName?.trim();
  return c && c !== name ? `${c}（${name}）` : name;
}
