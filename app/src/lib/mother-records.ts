// ママの記録の見分け方と、読むだけの人（祖父母など・member）に見せてよい形（2026-11-05 家族の声②の C・統括の割り振り）。
// 作り手の決め（承認したプラン https://claude.ai/artifact/3XseGBAg5LzK2UWgvoCJRK の「決める事4」）:
// 読むだけの人には、ママの体の図と、健診で見せる1枚のママの欄を見せない。ママが1枚で渡した時だけ。
// 健診で見せる1枚（lib/share-view.ts）・手帳の一覧（/api/techo）・書き出し（/api/export）が、同じこの決まりを使う。
// 画面からもサーバからも読む純粋な関数（試験は mother-records.test.ts）。
//
// 招く時にママが選ぶ「見せる項目」（components/settings/consent-texts.ts の SHARE_ITEMS・proxies.scope）は、まだどこでも読んでいない
// （lib/consent-screen.ts の「守っている事」）。ここでは選んだ項目に関わらず、読むだけの人にはママの頁を見せない（決め4のとおり）。

/** ママの頁（家で測った物 "home" を含む）。lib/techo.ts の TECHO_PAGES の外の頁もあるので、字で持つ */
export const MOTHER_PAGES: ReadonlySet<string> = new Set(["mother-health", "pregnancy-checkup", "pregnancy-test", "feeling", "postpartum", "home"]);

type EntryLike = { page: string; values?: Record<string, unknown> | null };

/** 字の欄（全角の「ＲＳ」もそろえる） */
const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v).normalize("NFKC").trim() : "");

/** 子の RS の予防（抗体の注射）。ワクチンではないが、予防接種の頁に書かれる事がある */
const CHILD_RSV = /抗体|ベイフォータス|ニルセビマブ|シナジス|パリビズマブ|beyfortus|nirsevimab|synagis|palivizumab/i;

/**
 * 妊娠中に母が受けたワクチンの行（RS ウイルスの母子免疫など）。手帳の欄と同じく、回の欄に妊娠週数を書く（府令様式 2026年4月施行版 p.52）。
 * 手帳の画面（components/techo/VaccineList.tsx）は RS で始まる行を「RSウイルス（妊娠中）」にまとめるので、それに合わせる（子の抗体の注射は除く）。
 * 迷う行はママの記録に倒す（読むだけの人に出すより、出さない方を選ぶ）
 */
export function isMaternalVaccine(e: EntryLike): boolean {
  if (e.page !== "vaccine") return false;
  const dose = str(e.values?.dose);
  const name = str(e.values?.vaccine);
  if (/^妊娠/.test(dose) || /母子免疫|妊婦|妊娠|アブリスボ|abrysvo/i.test(name)) return true;
  return /^RS/i.test(name) && !CHILD_RSV.test(name);
}

/** ママの記録か（ママの頁と、妊娠中の RS の行） */
export function isMotherEntry(e: EntryLike): boolean {
  return MOTHER_PAGES.has(e.page) || isMaternalVaccine(e);
}

/**
 * 読むだけの人に見せてよい形。ママの記録は null（見せない）。
 * 出産の頁は、お産のしかたと元の言葉を外す（ママの体の事）。ほかの子の頁はそのまま
 */
export function readerEntry<T extends { page: string; values: Record<string, unknown>; note?: string }>(e: T): T | null {
  if (isMotherEntry(e)) return null;
  if (e.page !== "birth") return e;
  const values = { ...e.values };
  delete values.method;
  const out = { ...e, values };
  delete out.note;
  return out;
}

/** mother＝ママ本人 ／ writer＝ほかの書ける人（パートナーなど） ／ reader＝読むだけの人（member） */
export type RecordViewer = "mother" | "writer" | "reader";

/**
 * 記録を見る・1枚を作る人がだれか（関所の結果から。app/api/_lib/household.ts の HouseholdAccess をそのまま渡せる）。
 * - 家（合言葉・アカウントなし＝legacy）と作った家族（体験版の写し・見本・シミュレーション＝guest）は、使う人を見分けられないので mother
 *   （プランの C の表: パートナーは同じ手帳をそのまま開く。家にはまだ読むだけの人がいない）
 * - アカウントのある世帯: 本人の種類が mother で、その人のアカウントに結ばれた本人がいれば mother。owner・admin のほかの人は writer。
 *   それ以外の役（member・知らない役）は reader（閉じる側に倒す）
 */
export function recordViewerOf(a: {
  legacy: boolean;
  role: string;
  account: { id: string } | null;
  ctx?: { subjects: readonly { kind: string; accountId: string | null }[] } | null;
}): RecordViewer {
  if (a.legacy || a.role === "guest") return "mother";
  if (a.role !== "owner" && a.role !== "admin") return "reader";
  const me = a.account?.id;
  return me && (a.ctx?.subjects ?? []).some((s) => s.kind === "mother" && s.accountId === me) ? "mother" : "writer";
}
