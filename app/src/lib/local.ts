// ② 1000日を生きる: その家族の町の制度を取りに行く。
// 調べた結果は町ごと・事ごとに DB（type 'local'）へ置き、次からはそれを返す（調べた日つき）。
// 調べた役所は「いつもの」（keep.office）として覚え、地図や次の下書きで使う。
// 町の調べ結果はどの家族の物でもない（町の公開のページから作った物）ので、家族の id ではなく PUBLIC_ID の行に置く。
// 前は最初に調べた家族の id で置いていた（その家族を消すと、ほかの家族の分の調べ結果も消えた）。前の行も id で引けるので、そのまま読める。
// 「いつもの」の役所（rememberOffice）は家族の物なので、今までどおり家族の id に置く。
import "server-only";
import { isPaidId, paidDef } from "./money";
import { z } from "zod";
import { LIGHT_MODEL, RESEARCH_MODEL, research, structured } from "./claude";
import { get, put } from "./db";
import type { Family } from "./demo-family";
import { HttpError } from "./family";
import { getKeep, remember } from "./keep";
import { officeOf } from "./move";
import { designatedCity, officeName, wardOf } from "./local-place";
import { MILESTONES, type MilestoneDef } from "./milestones";

export const LocalSchema = z.object({
  summary: z.string().describe("この町でこの事をする時の要点。やさしい言葉で2文まで"),
  where: z
    .string()
    .describe("どこへ行くか。建物と課の名前だけを1行で短く（例: 役場1階 住民保険課）。政令市など区ごとに窓口がある時は「住んでいる区の区役所 区民課」のように。電話番号・受付時間・法律の名前は書かない。分からなければ「確かめる」"),
  office: z.string().describe("地図で探せる、役所そのものの名前（例: 上牧町役場）。政令市で区が分からない時は「さいたま市 区役所」のように、市役所本庁ではなく区役所"),
  address: z.string().describe("その役所の住所。ページに無ければ空の文字"),
  bring: z.array(z.string()).describe("持って行く物。1つずつ、15字くらいまでの短い名前（細かい注意は caution へ）"),
  online: z.string().describe("ネットで出せるか（マイナポータル・電子申請など）を1文で。分からなければ「確かめる」"),
  deadline: z.string().describe("締切を日付か日数だけで短く（例: 生まれた日を入れて14日以内・11月28日まで）。受付の始まりの日を締切と書かない（始まりしか分からない時は「11月4日から受付・締切は確かめる」）。去年度の募集の日程しか見つからない時は、その日を書かず「今年度の日程は確かめる」。法律の名前・条の番号は書かない（caution へ）"),
  extras: z.string().describe("この町だけの助成・上乗せ・もらえる物を1〜2文で。無い・分からなければそう書く"),
  caution: z.string().describe("気をつける事・期限の根拠・窓口に確かめる事（調べた範囲で言い切れない所）"),
});
export type LocalFields = z.infer<typeof LocalSchema>;

export interface LocalInfo extends LocalFields {
  /** 調べ方の版（LOCAL_FORMAT）。前の版の調べには無い */
  format?: number;
  milestoneId: string;
  title: string;
  prefecture: string;
  city: string;
  sources: { title: string; url: string }[];
  /** 調べた日（YYYY-MM-DD・日本時間） */
  researchedAt: string;
}

/** 役所のページ（.lg.jp・.go.jp など）か */
export function isOfficial(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return /\.(lg|go)\.jp$/.test(h) || /^(www\.)?(city|town|vill|pref)\./.test(h);
  } catch {
    return false;
  }
}

/** 役所のページを先に並べる */
function officialFirst(sources: LocalInfo["sources"]): LocalInfo["sources"] {
  return [...sources].sort((a, b) => Number(isOfficial(b.url)) - Number(isOfficial(a.url)));
}

/** 町の調べ結果を置く、どの世帯の物でもない行の family_id */
export const PUBLIC_ID = "public";

export function localId(city: string, milestoneId: string): string {
  return `local:${city}:${milestoneId}`;
}

export function findMilestone(id: unknown): MilestoneDef {
  // 届いたか確かめる件（paid-〈申請の id〉・lib/money.ts）は、予定の表に無いので骨組みから引く
  const m = typeof id === "string" ? (MILESTONES.find((x) => x.id === id) ?? (isPaidId(id) ? paidDef(id.slice(5)) ?? undefined : undefined)) : undefined;
  if (!m) throw new HttpError(404, "その事が見つかりません");
  return m;
}

/** DB にある調べ結果（無ければ null） */
/** 調べ方を変えた時に上げる。古い調べのうち、日程が年ごとに変わる物（保育園）は調べ直す */
const LOCAL_FORMAT = 2;
const YEARLY = new Set(["daycare-apply", "daycare-research"]);

/**
 * どの町で調べるか。「里帰り先の町で確かめる」（第2波⑦）だけは里帰り先の町、ほかは住む町。
 * 調べた結果は町×事で1回だけ持ち、ほかの家族と使い回す（鍵は今までどおり localId）
 */
export function placeFor(family: Family, milestoneId: string): { prefecture: string; city: string; away: boolean } {
  const p = family.situation?.satogaeri ? family.situation.satogaeriPlace : undefined;
  if (milestoneId === "satogaeri-local" && p?.city) return { prefecture: p.prefecture, city: p.city, away: true };
  return { prefecture: family.prefecture, city: family.city, away: false };
}

export function getLocal(family: Family, milestoneId: string): LocalInfo | null {
  const d = get<LocalInfo & { format?: number }>(localId(placeFor(family, milestoneId).city, milestoneId))?.data;
  if (d && YEARLY.has(milestoneId) && (d.format ?? 1) < LOCAL_FORMAT) return null;
  // 前の形で調べた物には office・address が無い
  return d ? { ...d, office: d.office ?? "", address: d.address ?? "", sources: officialFirst(d.sources) } : null;
}

function jstToday(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

const RESEARCH_SYSTEM = `あなたの役割: 家族が住む町（市区町村）の子育ての制度を、その町の公式サイトを優先して調べる係。
- 市区町村の公式サイト（.lg.jp や city.〇〇.jp など）を最優先にし、次に都道府県・国（こども家庭庁・厚生労働省・法務省など）のページを使う。まとめサイトや個人のブログは根拠にしない。
- 窓口（役所の名前・住所・課の名前・何階か）、必要な物、オンライン申請の可否とやり方、期限と根拠、町独自の助成・上乗せ・配布物を、家族がそのまま動ける具体さで書く。
- ページで確かめられなかった事は推測で埋めず「確かめる」と書く。区ごとに窓口が違う町では、その事も書く。
- 日本語で、短く。`;

const SHAPE_SYSTEM = `あなたの役割: 町の制度を調べた文章を、家族がスマホで立ったまま読む決まった形に整える係。
- 調べた文章に書かれている事だけを使う。書かれていない事を足さない。分からない所は「確かめる」と書く。
- 中学生が読める言葉で、とにかく短く。1つの欄は2行まで。専門の言葉や法律の名前、細かい条件・電話番号は caution にまとめる。
- 窓口の名前や持ち物の名前は、調べた文章の言葉を使う。`;

/** 調べた窓口の役所を「いつもの」として覚える（手続きごとの課ではなく、役所そのもの） */
function rememberOffice(familyId: string, local: LocalInfo) {
  const name = local.office.trim();
  if (!name || name.includes("確かめる")) return;
  const cur = getKeep(familyId).office;
  if (!cur?.staleFrom && cur?.name === name && (cur.address || !local.address)) return;
  // 前の町の窓口の印は外す（新しい町の調べで覚え直した＝見直し C10①）
  remember(familyId, { office: { name, address: local.address.trim() || (cur?.staleFrom ? "" : undefined), staleFrom: "" } });
}

/**
 * その事だけに聞く6番目の問い（無ければ空）。町×事で1回だけ調べてほかの家族と使い回すので、家族の事（名前・日付）は入れない。
 * city は調べる町（里帰り先の町で調べる事は里帰り先）、home は住む町。
 */
export function extraQuestion(id: string, city: string, home: { prefecture: string; city: string }): string {
  switch (id) {
    case "pregnancy-support-2":
      return "2回目の面談の予約の仕方（電話・オンライン・予約なし）と、受け取り方（振込など）・申請の期限";
    case "daycare-prep":
      return "病児保育・病後児保育の施設と、使う前の登録の仕方（登録の書類・予約の仕方）";
    case "older-daycare-continue":
      return "育休中に、上の子が保育園を続けて使えるか（続けられる期間・短い時間になるか・申請の書類と期限）";
    case "satogaeri-local":
      return `ほかの町（${home.prefecture}${home.city}）に住む人が、${city}に里帰りして産む時: 赤ちゃん訪問を${city}で受けられるか（頼み方は住む町から）・${home.city}の妊婦健診の受診券が${city}の病院で使えるか・出生届を${city}の役所に出す時の窓口と持ち物`;
    // 今夜足した3つ（2026-11-04 D の一部）。どれも「受けるか・使うか」は家族と産院が決める事なので、町の仕組みだけを聞く
    case "rsv-maternal":
      return `RSウイルスの母子免疫ワクチン（妊婦の定期接種・2026年度から）について、${city}で受けられる医療機関（一覧のページがあればその場所）・予診票の受け取り方（妊娠届の時に渡されるか、医療機関にあるか、申請が要るか）・費用（無料か、自己負担があるか）。${city}の外の医療機関（里帰り先など）で受けた時の扱いも`;
    case "postpartum-care":
      return `${city}の産後ケア事業の種類（宿泊・日帰り・訪問）と使える施設・申し込みの時期（妊娠中から申し込めるか、生まれてからか）と申し込み方・費用（1回の自己負担と、減免があるか）`;
    case "postpartum-checkup-2w":
      return `産婦健康診査の受診票（助成）の受け取り方（妊娠届の時に渡されるか、後から申請するか）・使える回数（産後2週間・1か月など）・使える医療機関（${city}の外の医療機関で受けた時の払い戻しも）`;
    default:
      return "";
  }
}

/** 町の制度を取りに行く。DB にあればそれを返す（force で調べ直す） */
/** 調べている途中の物（同じ町・同じ手続きを同時に2回調べない。開き直して押し直しても、前の調べを待つ） */
const inflight = new Map<string, Promise<{ local: LocalInfo; cached: boolean }>>();

export async function fetchLocal(family: Family, m: MilestoneDef, force = false): Promise<{ local: LocalInfo; cached: boolean }> {
  if (!family.city) throw new HttpError(400, "わが家の設定で、住んでいる市区町村を入れてください");
  const key = localId(placeFor(family, m.id).city, m.id);
  const running = inflight.get(key);
  if (running) return running;
  const p = fetchLocalOnce(family, m, force).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function fetchLocalOnce(home: Family, m: MilestoneDef, force: boolean): Promise<{ local: LocalInfo; cached: boolean }> {
  // 里帰り先の町で調べる事は、町だけを里帰り先に差し替える（窓口を「いつもの役所」として覚えない）
  const at = placeFor(home, m.id);
  const family = { ...home, prefecture: at.prefecture, city: at.city };
  if (!force) {
    const hit = getLocal(family, m.id);
    if (hit) {
      if (!at.away && !officeOf(getKeep(family.id).office)?.name) rememberOffice(family.id, hit);
      return { local: hit, cached: true };
    }
  }
  const place = `${family.prefecture}${family.city}`;
  const base = designatedCity(family.city);
  const ward = wardOf(family.city);
  // 政令市は、届出の窓口が市役所本庁ではなく区役所
  const wardNote = base
    ? ward
      ? `\n${base}は政令指定都市です。窓口は${ward}役所なので、${ward}役所の課・階・住所で答えてください（市役所本庁ではなく）。`
      : `\n${base}は政令指定都市です。窓口は住んでいる区の区役所なので、区役所の課の名前で答えてください（市役所本庁ではなく。区ごとの住所や電話の一覧は要りません）。`
    : "";
  const extra = extraQuestion(m.id, family.city, home);
  const question = `${place}で「${m.title}」をする時について、${family.city}の公式サイトを優先して調べてください。${wardNote}
知りたい事:
1. 窓口（どの役所の・何階の・どの課か。役所の住所。区役所ごとに違うならその事も）
2. 必要な物・書類
3. オンライン申請ができるか（マイナポータル・電子申請など）とそのやり方
4. 期限（参考: 全国共通の根拠は「${m.basis}」）
5. ${family.city}独自の助成・上乗せ・配布物があれば${extra ? `\n6. ${extra}` : ""}
出典のページを示してください。`;
  // 町×手続きで1回だけ調べて、ほかの家族と使い回す（PUBLIC_ID に置く）。1回の重さも抑える: Sonnet・検索は4回まで
  const found = await research(RESEARCH_SYSTEM, question, { model: RESEARCH_MODEL, maxUses: 4 });
  if (!found.text) throw new HttpError(502, "調べた答えが空でした。もう一度調べ直してください");

  const shaped = await structured(
    LocalSchema,
    SHAPE_SYSTEM,
    [
      `町: ${place}`,
      `事: ${m.title}`,
      base && !ward ? `政令指定都市: 窓口は住んでいる区の区役所。office は「${officeName(family.city)}」、address は空にする` : "",
      base && ward ? `政令指定都市: 窓口は${ward}役所。office は「${officeName(family.city)}」` : "",
      "",
      "調べた文章:",
      found.text,
    ]
      .filter((x) => x !== "")
      .join("\n"),
    { model: LIGHT_MODEL, effort: "low", maxTokens: 4000 },
  );
  const local: LocalInfo = {
    ...shaped,
    milestoneId: m.id,
    title: m.title,
    prefecture: family.prefecture,
    city: family.city,
    sources: officialFirst(found.sources).slice(0, 8),
    format: LOCAL_FORMAT,
    researchedAt: jstToday(),
  };
  put(PUBLIC_ID, "local", local, { id: localId(family.city, m.id), date: local.researchedAt });
  if (!at.away) rememberOffice(family.id, local);
  return { local, cached: false };
}
