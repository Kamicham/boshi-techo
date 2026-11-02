// ② 1000日を生きる: その家族の町の制度を取りに行く。
// 調べた結果は町ごと・事ごとに DB（type 'local'）へ置き、次からはそれを返す（調べた日つき）。
// 調べた役所は「いつもの」（keep.office）として覚え、地図や次の下書きで使う。
import "server-only";
import { z } from "zod";
import { LIGHT_MODEL, research, structured } from "./claude";
import { get, put } from "./db";
import type { Family } from "./demo-family";
import { HttpError } from "./family";
import { getKeep, remember } from "./keep";
import { MILESTONES, type MilestoneDef } from "./milestones";

export const LocalSchema = z.object({
  summary: z.string().describe("この町でこの事をする時の要点。やさしい言葉で2文まで"),
  where: z.string().describe("どこへ行くか。建物と課の名前だけを短く（例: 役場1階 住民保険課）。区ごとに違う時は「住んでいる区の区役所 市民課」のように。分からなければ「確かめる」"),
  office: z.string().describe("地図で探せる、役所そのものの名前（例: 上牧町役場、さいたま市役所）"),
  address: z.string().describe("その役所の住所。ページに無ければ空の文字"),
  bring: z.array(z.string()).describe("持って行く物。1つずつ、15字くらいまでの短い名前（細かい注意は caution へ）"),
  online: z.string().describe("ネットで出せるか（マイナポータル・電子申請など）を1文で。分からなければ「確かめる」"),
  deadline: z.string().describe("期限を短く（例: 生まれた日を入れて14日以内）。根拠の法律は caution へ"),
  extras: z.string().describe("この町だけの助成・上乗せ・もらえる物を1〜2文で。無い・分からなければそう書く"),
  caution: z.string().describe("気をつける事・期限の根拠・窓口に確かめる事（調べた範囲で言い切れない所）"),
});
export type LocalFields = z.infer<typeof LocalSchema>;

export interface LocalInfo extends LocalFields {
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

export function localId(city: string, milestoneId: string): string {
  return `local:${city}:${milestoneId}`;
}

export function findMilestone(id: unknown): MilestoneDef {
  const m = typeof id === "string" ? MILESTONES.find((x) => x.id === id) : undefined;
  if (!m) throw new HttpError(404, "その事が見つかりません");
  return m;
}

/** DB にある調べ結果（無ければ null） */
export function getLocal(family: Family, milestoneId: string): LocalInfo | null {
  const d = get<LocalInfo>(localId(family.city, milestoneId))?.data;
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
  if (cur?.name === name && (cur.address || !local.address)) return;
  remember(familyId, { office: { name, address: local.address.trim() || undefined } });
}

/** 町の制度を取りに行く。DB にあればそれを返す（force で調べ直す） */
export async function fetchLocal(family: Family, m: MilestoneDef, force = false): Promise<{ local: LocalInfo; cached: boolean }> {
  if (!family.city) throw new HttpError(400, "わが家の設定で、住んでいる市区町村を入れてください");
  if (!force) {
    const hit = getLocal(family, m.id);
    if (hit) {
      if (!getKeep(family.id).office?.name) rememberOffice(family.id, hit);
      return { local: hit, cached: true };
    }
  }
  const place = `${family.prefecture}${family.city}`;
  const question = `${place}で「${m.title}」をする時について、${family.city}の公式サイトを優先して調べてください。
知りたい事:
1. 窓口（どの役所の・何階の・どの課か。役所の住所。区役所ごとに違うならその事も）
2. 必要な物・書類
3. オンライン申請ができるか（マイナポータル・電子申請など）とそのやり方
4. 期限（参考: 全国共通の根拠は「${m.basis}」）
5. ${family.city}独自の助成・上乗せ・配布物があれば
出典のページを示してください。`;
  const found = await research(RESEARCH_SYSTEM, question);
  if (!found.text) throw new HttpError(502, "調べた答えが空でした。もう一度調べ直してください");

  const shaped = await structured(
    LocalSchema,
    SHAPE_SYSTEM,
    `町: ${place}\n事: ${m.title}\n\n調べた文章:\n${found.text}`,
    { model: LIGHT_MODEL, effort: "low", maxTokens: 4000 },
  );
  const local: LocalInfo = {
    ...shaped,
    milestoneId: m.id,
    title: m.title,
    prefecture: family.prefecture,
    city: family.city,
    sources: officialFirst(found.sources).slice(0, 8),
    researchedAt: jstToday(),
  };
  put(family.id, "local", local, { id: localId(family.city, m.id), date: local.researchedAt });
  rememberOffice(family.id, local);
  return { local, cached: false };
}
