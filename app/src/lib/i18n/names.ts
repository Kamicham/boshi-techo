// 名前を画面の言葉で書く（2026-11-05 多言語化⑤・統括の決め方）。データの名前は日本語のまま持ち、描く時だけ通す（保存する値には使わない）。
// - English: 見本の家族の名前はローマ字（ひなた→Hinata・美咲→Misaki・翔太→Shota・和子→Kazuko＝美咲の母。見本の記録の誰が話したかに出る）。ばあば・じいじは Grandma・Grandpa（どの家族でも）
// - 中文: 名前は日本語のまま。ばあば・じいじは、作った家族（見本・体験の写し・30家族と1000組）の時だけ 外婆・爷爷
//   （見本の家族では、ばあば＝美咲の母・じいじ＝翔太の父。本物の家族は父方か母方か分からないので、家族が書いたまま）
// - 日本語: 1字も変えない
// 本物の家族の名前は家族が書いたまま（English でも、下の表にある名前だけ読み方にする）。思い出の画面（album・book・film・print）も同じ関数を使う
import { DEMO_FAMILY } from "../demo-family";
import { isTrialId } from "../trial-cookie";
import { currentLang, t } from ".";

const EN: Readonly<Record<string, string>> = { ひなた: "Hinata", 美咲: "Misaki", 翔太: "Shota", 和子: "Kazuko", ばあば: "Grandma", じいじ: "Grandpa" };
const ZH_MADE: Readonly<Record<string, string>> = { ばあば: "外婆", じいじ: "爷爷" };

/** 作った家族の id か（lib/techo-seed.ts の isMadeFamily と同じ形。画面からも読めるよう、形だけで見る） */
export function isMadeId(id: string | null | undefined): boolean {
  return !!id && (id === DEMO_FAMILY.id || isTrialId(id) || /^sim-\d{2}$/.test(id) || /^pop-\d{4}$/.test(id));
}

/** 名前1つを今の言葉で（無い時はそのまま返す） */
export function nameIn<T extends string | null | undefined>(name: T, opts?: { made?: boolean }): T {
  if (!name) return name;
  const key = name.trim();
  const lang = currentLang();
  if (lang === "en") return (EN[key] ?? name) as T;
  if (lang === "zh" && opts?.made) return (ZH_MADE[key] ?? name) as T;
  return name;
}

/** 「ママ（美咲）」「パートナー（翔太）」のような札を、役の言葉（辞書）と名前に分けて今の言葉に（English は半角の括弧）。括弧が無ければ役の言葉か名前 */
export function labelIn(label: string, opts?: { made?: boolean }): string {
  if (currentLang() === "ja") return label;
  const m = /^(.+?)（(.+)）$/.exec(label.trim());
  if (!m) return t(label) !== label ? t(label) : nameIn(label, opts);
  const role = t(m[1]);
  const name = nameIn(m[2], opts);
  return currentLang() === "en" ? `${role} (${name})` : `${role}（${name}）`;
}
