// 作った家族（デモ・30家族 sim-*・1000組 pop-*）の手帳の記録を、統計から作る。すべて作った記録で、実在の家族の物ではない。
// 本物の家族（わが家・アカウントで作った世帯）には何も返さない。本物の記録は、家族が話した・撮った物だけ（lib/techo.ts の約束）。
//
// 乱数は使わない。同じ家族・同じ今日なら、いつも同じ記録になる（家族 id から決まる小さな幅）。
// 今日より後の日付の記録は作らない。生まれる前に生まれた後の記録は作らない。
//
// 出典（数字の元。完全には再現できない所は「近似」）:
// - 妊婦健診の回数と時期: 厚生労働省「妊婦に対する健康診査についての望ましい基準」（平成27年 告示第226号）
//   妊娠初期〜23週は4週に1回、24〜35週は2週に1回、36週〜出産は毎週（標準14回）。初回は8週ごろとした（近似）
// - 妊娠中の体重の増え方: 厚生労働省「妊娠前からはじめる妊産婦のための食生活指針」（2021年）。ふつうの体格（BMI 18.5〜25）で 10〜13kg
// - 妊娠前の身長と体重: 厚生労働省「国民健康・栄養調査」（令和元年）30代女性の平均（身長約158cm・BMI 約21）の近くに家族ごとの幅（近似）
// - 出生体重と在胎週数: 1000組は population.ts の値（人口動態統計 2025年の分布から作った値）をそのまま使う。
//   デモと30家族は予定日と生まれた日から週数を出し、体重は週数ごとの中央値（日本小児科学会「在胎期間別出生時体格標準値」2010年の近似。
//   population.ts の MEDIAN_G と同じ表）に、家族ごとの ±6% の幅（近似）
// - 生まれた後の体重・身長・頭囲: こども家庭庁「令和5年乳幼児身体発育調査」の中央値の近く。男女を平均した値で、家族ごとに ±4% の幅（近似）。
//   早く生まれた子・小さく生まれた子は、生まれた時の差が月齢とともに縮む形にした（近似）
// - 予防接種: 国立健康危機管理研究機構（旧 国立感染症研究所）「日本の小児における予防接種スケジュール」（2025年版）の標準的な接種の時期。
//   今日より前の物だけ。ロット・医療機関・医師は作らない（空のまま）
// - できた日: 乳幼児身体発育調査（運動・言語の通過率）で、半数ができる月齢の近く（近似）。早く生まれた子は予定日から数える（修正月齢）
// - 便色: 母子健康手帳の便色カード（7色）。作った記録は 5〜7番（よくある色）だけを使う
// - 血液型: 日本人の ABO 型の割合（A 約38%・O 約31%・B 約22%・AB 約9%）の近似
import { addDays, addMonths, diffDays, lmpFromDue } from "./clock";
import type { Family } from "./demo-family";
import type { TechoEntry } from "./techo";

/** 在胎日数（最終月経から）→ 出生体重の中央値 g（在胎期間別出生時体格標準値 2010 の近似。population.ts の MEDIAN_G と同じ） */
export const BIRTH_WEIGHT_MEDIAN: [number, number][] = [[154, 500], [168, 650], [182, 850], [196, 1100], [210, 1450], [224, 1800], [238, 2200], [252, 2600], [266, 2950], [280, 3150], [294, 3300], [300, 3350]];
/** 在胎日数 → 出生身長・頭囲の中央値 cm（同じ標準値の近似） */
export const BIRTH_LENGTH_MEDIAN: [number, number][] = [[168, 31], [196, 37], [224, 41], [252, 46], [266, 48], [280, 49.5], [300, 50.5]];
export const BIRTH_HEAD_MEDIAN: [number, number][] = [[168, 22], [196, 26], [224, 29], [252, 32], [266, 33], [280, 33.5], [300, 34]];

/**
 * 月齢 → 体重 kg・身長 cm・頭囲 cm の中央値（令和5年乳幼児身体発育調査の中央値の近く。男女の平均・近似）。
 * 曲線の正本は手帳のタブの発育曲線の表。ここは作った記録のための近似の値。
 */
export const GROWTH_MEDIAN: { m: number; kg: number; cm: number; head: number }[] = [
  { m: 0, kg: 3.0, cm: 48.8, head: 33.2 },
  { m: 1, kg: 4.0, cm: 53.0, head: 36.4 },
  { m: 3, kg: 6.0, cm: 59.3, head: 39.5 },
  { m: 4, kg: 6.6, cm: 62.0, head: 40.6 },
  { m: 6, kg: 7.6, cm: 65.7, head: 42.4 },
  { m: 7, kg: 7.9, cm: 67.2, head: 43.0 },
  { m: 9, kg: 8.5, cm: 69.8, head: 44.1 },
  { m: 10, kg: 8.7, cm: 71.0, head: 44.6 },
  { m: 12, kg: 9.0, cm: 74.1, head: 45.5 },
  { m: 18, kg: 10.1, cm: 80.0, head: 47.1 },
  { m: 24, kg: 11.2, cm: 84.6, head: 48.2 },
];

/** 標準の接種（月齢と、その回の名前） */
const VACCINES: { m: number; vaccine: string; dose: string }[] = [
  { m: 2, vaccine: "B型肝炎", dose: "1回目" },
  { m: 2, vaccine: "ロタウイルス", dose: "1回目" },
  { m: 2, vaccine: "小児用肺炎球菌", dose: "1回目" },
  { m: 2, vaccine: "五種混合", dose: "1回目" },
  { m: 3, vaccine: "B型肝炎", dose: "2回目" },
  { m: 3, vaccine: "ロタウイルス", dose: "2回目" },
  { m: 3, vaccine: "小児用肺炎球菌", dose: "2回目" },
  { m: 3, vaccine: "五種混合", dose: "2回目" },
  { m: 4, vaccine: "小児用肺炎球菌", dose: "3回目" },
  { m: 4, vaccine: "五種混合", dose: "3回目" },
  { m: 5, vaccine: "BCG", dose: "" },
  { m: 7, vaccine: "B型肝炎", dose: "3回目" },
  { m: 12, vaccine: "麻しん風しん（MR）", dose: "1期" },
  { m: 12, vaccine: "水痘", dose: "1回目" },
  { m: 12, vaccine: "小児用肺炎球菌", dose: "4回目" },
  { m: 13, vaccine: "五種混合", dose: "4回目" },
  { m: 18, vaccine: "水痘", dose: "2回目" },
];

/** できた日（半数ができる月齢の近く・近似） */
const DEVELOPMENT_AT: { item: string; m: number }[] = [
  { item: "首すわり", m: 3.5 },
  { item: "寝返り", m: 5.5 },
  { item: "ひとりすわり", m: 7 },
  { item: "はいはい", m: 8.5 },
  { item: "つかまり立ち", m: 9.5 },
  { item: "つたい歩き", m: 10.5 },
  { item: "ひとり歩き", m: 13 },
  { item: "指さし", m: 12.5 },
  { item: "意味のあることば", m: 13.5 },
];

/** 乳幼児健診（多くの町で行う時期） */
const CHILD_CHECKUPS: { m: number; checkup: string }[] = [
  { m: 1, checkup: "1か月児健診" },
  { m: 3, checkup: "3〜4か月児健診" },
  { m: 6, checkup: "6〜7か月児健診" },
  { m: 9, checkup: "9〜10か月児健診" },
  { m: 18, checkup: "1歳6か月児健診" },
];

/** 妊婦健診の週（標準の14回。初回8週は近似） */
export const CHECKUP_WEEKS = [8, 12, 16, 20, 24, 26, 28, 30, 32, 34, 36, 37, 38, 39];

/** 作った気持ちの言葉（本物の家族の言葉は使わない） */
const FEELINGS_PREG = [
  "おなかの中で動くのが分かった。早く会いたい。",
  "健診で心臓が動いているのを見た。小さいのに一生懸命だった。",
  "名前をふたりで考えている。どんな声で泣くのかな。",
  "少しずつおなかが大きくなってきた。毎日話しかけている。",
];
const FEELINGS_BIRTH = [
  "生まれてきてくれてありがとう。眠そうな顔がずっと見ていられる。",
  "初めて抱っこした時、思ったより軽くて、思ったより温かかった。",
  "あなたに会える日をずっと待っていたよ。ようこそ。",
];

// ───────── 小さな道具 ─────────

/** 家族 id とキーから決まる 0〜1 の値（乱数ではない。毎回同じ） */
function unit(familyId: string, key: string): number {
  let h = 2166136261;
  const s = `${familyId}:${key}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
/** -1〜1 */
const spread = (fid: string, key: string) => unit(fid, key) * 2 - 1;

function interp(table: [number, number][], x: number): number {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [x0, y0] = table[i - 1];
    const [x1, y1] = table[i];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return table[table.length - 1][1];
}

/** 月齢 → 発育の中央値 */
export function growthMedian(m: number): { kg: number; cm: number; head: number } {
  const t = (k: "kg" | "cm" | "head") => interp(GROWTH_MEDIAN.map((g) => [g.m, g[k]] as [number, number]), m);
  return { kg: t("kg"), cm: t("cm"), head: t("head") };
}

export const birthWeightMedian = (gestDays: number) => interp(BIRTH_WEIGHT_MEDIAN, gestDays);

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * 作った家族か（本物の家族には何も作らない）。コードが作る id の形にぴったり合う物だけ:
 * 見本の家族 demo-sato・30家族 sim-01〜sim-99・1000組 pop-0001〜pop-9999。
 * 前は「demo-・sim-・pop- で始まる」で決めていた。アカウントで作った世帯の id（Better Auth が作る英数字だけの id）は
 * どれにも合わないので、本物の世帯に作った記録が混ざらない（lib/family.ts の madeFamilyKind・api/household も同じ考え）。
 * 誰が見てよいかの判定には使わない（それは lib/access.ts の publicHouseholdKind）。
 */
export function isMadeFamily(id: string): boolean {
  return id === "demo-sato" || /^sim-\d{2}$/.test(id) || /^pop-\d{4}$/.test(id);
}

/** 1000組の家族が持つ値（population.ts の profile。lib から sim を読まないよう、形だけここに書く） */
interface PopLike {
  profile?: { gestDays?: number; weights?: number[]; twins?: boolean; cesarean?: boolean; order?: string };
}

/** 生まれた時の値（家族のデータがあればそれ、無ければ週数の中央値の近く） */
export function birthFacts(family: Family): { gestDays: number; weightsG: number[] } {
  const prof = (family as Family & PopLike).profile;
  const lmp = lmpFromDue(family.dueDate);
  const birth = family.birthDate ?? family.dueDate;
  const gestDays = prof?.gestDays ?? diffDays(birth, lmp);
  if (prof?.weights?.length) return { gestDays, weightsG: prof.weights };
  const babies = Math.max(1, Math.min(3, family.situation?.babies ?? 1));
  // 双子は中央値を1割下げる（population.ts と同じ近似）
  const med = birthWeightMedian(gestDays) * (babies > 1 ? 0.9 : 1);
  const weightsG = Array.from({ length: babies }, (_, i) => Math.round((med * (1 + 0.06 * spread(family.id, `bw${i}`))) / 2) * 2);
  return { gestDays, weightsG };
}

const weekText = (days: number) => `${Math.floor(days / 7)}週${days % 7 ? `${days % 7}日` : ""}`;

// ───────── 作る ─────────

/**
 * 作った家族の、今日までの時期に合った記録（source "seed"）。わが家には空。
 * 並びは日付の順。体の数字は家族のデータか、上の出典の中央値の近くだけ。
 */
export function seedTecho(family: Family, today: string): TechoEntry[] {
  if (!isMadeFamily(family.id)) return [];
  const fid = family.id;
  const out: TechoEntry[] = [];
  const add = (e: Omit<TechoEntry, "source">) => {
    if (e.date <= today) out.push({ ...e, source: "seed", note: e.note ?? "作った記録（統計から作った家族）" });
  };
  const lmp = lmpFromDue(family.dueDate);
  const born = family.birthDate && family.birthDate <= today ? family.birthDate : null;
  const birthEdge = family.birthDate ?? addDays(family.dueDate, 14);
  const mother = family.members.find((m) => m.role === "母");
  const partner = family.members.find((m) => m.role === "パートナー");
  const prof = (family as Family & PopLike).profile;

  // ── 妊婦の健康状態（初回の健診の日に本人が書いた、の形）
  const heightCm = round1(158 + 5 * spread(fid, "h"));
  const bmi = 21 + 1.8 * spread(fid, "bmi");
  const preKg = round1((bmi * heightCm * heightCm) / 10000);
  const first = addDays(lmp, CHECKUP_WEEKS[0] * 7 + Math.floor(unit(fid, "c0") * 4));
  if (first < birthEdge) {
    const older = family.situation?.olderChildren ?? (prof?.order ? prof.order !== "第1子" : undefined);
    add({
      page: "mother-health",
      date: first,
      title: "妊婦の健康状態",
      who: mother?.name,
      values: { heightCm, weightKg: preKg, ...(older !== undefined ? { pastBirths: older ? "出産したことがある" : "初めての出産" } : {}) },
    });
    // 血液型（初期の検査）
    const u = unit(fid, "abo");
    const abo = u < 0.38 ? "A型" : u < 0.69 ? "O型" : u < 0.91 ? "B型" : "AB型";
    add({ page: "pregnancy-test", date: first, title: "血液型", values: { test: "血液型", result: `${abo} Rh(+)` } });
  }

  // ── 妊婦健診（標準の時期。生まれる日より前・今日まで）
  const gainKg = 10 + 3 * unit(fid, "gain");
  const bpHi = Math.round(110 + 7 * spread(fid, "bph"));
  const bpLo = Math.round(66 + 5 * spread(fid, "bpl"));
  for (const [i, w] of CHECKUP_WEEKS.entries()) {
    const date = addDays(lmp, w * 7 + Math.floor(unit(fid, `c${i}`) * 4));
    if (date >= birthEdge) break;
    const gain = w <= 12 ? 0.5 * (w / 12) : 0.5 + (gainKg - 0.5) * Math.min(1, (w - 12) / 28);
    add({
      page: "pregnancy-checkup",
      date,
      title: `妊娠${w}週の健診`,
      values: {
        week: weekText(diffDays(date, lmp)),
        weightKg: round1(preKg + gain),
        bpHigh: bpHi + Math.round(3 * spread(fid, `bph${i}`)),
        bpLow: bpLo + Math.round(3 * spread(fid, `bpl${i}`)),
        ...(w >= 20 ? { fundusCm: Math.min(33, w - 3) } : {}),
        urineProtein: "−",
        urineSugar: "−",
      },
    });
  }

  // ── 気持ちの記録（妊娠中に1つ。作った言葉）
  const feelDate = addDays(lmp, (20 + Math.floor(unit(fid, "f1") * 6)) * 7);
  if (feelDate < birthEdge && mother) {
    add({ page: "feeling", date: feelDate, title: "迎える気持ち", who: mother.name, values: { text: FEELINGS_PREG[Math.floor(unit(fid, "fp") * FEELINGS_PREG.length)], occasion: "妊娠中" } });
  }

  if (!born) return sortByDate(out);

  // ── 出産の状態
  const { gestDays, weightsG } = birthFacts(family);
  const twins = weightsG.length > 1;
  const kids = weightsG.map((g, i) => ({ g, who: twins ? `${family.childName ?? "子"}（${i + 1}人目）` : family.childName, i }));
  for (const k of kids) {
    const ratio = k.g / birthWeightMedian(gestDays);
    add({
      page: "birth",
      date: born,
      title: twins ? `出産の状態（${k.i + 1}人目）` : "出産の状態",
      who: k.who,
      values: {
        week: weekText(gestDays),
        weightG: k.g,
        heightCm: round1(interp(BIRTH_LENGTH_MEDIAN, gestDays) * (1 + (ratio - 1) * 0.3)),
        headCm: round1(interp(BIRTH_HEAD_MEDIAN, gestDays) * (1 + (ratio - 1) * 0.25)),
        ...(prof?.cesarean !== undefined ? { method: prof.cesarean ? "帝王切開" : "経腟分娩" } : {}),
      },
    });
  }
  // 生まれた日の気持ち（パートナーがいればパートナー、いなければ母）
  const writer = partner ?? mother;
  if (writer) add({ page: "feeling", date: addDays(born, 1), title: "生まれた日に", who: writer.name, values: { text: FEELINGS_BIRTH[Math.floor(unit(fid, "fb") * FEELINGS_BIRTH.length)], occasion: "誕生" } });

  // ── 新生児の記録（退院のころ・2週間ごろ）
  for (const k of kids) {
    add({ page: "newborn", date: addDays(born, 5), title: "退院のころ", who: k.who, values: { dayAge: 5, weightG: Math.round((k.g * (0.95 + 0.02 * unit(fid, `dis${k.i}`))) / 2) * 2, vitaminK: "飲んだ", test: "聴覚の検査" } });
    add({ page: "newborn", date: addDays(born, 14), title: "2週間ごろ", who: k.who, values: { dayAge: 14, weightG: Math.round((k.g + 80 + 120 * unit(fid, `w2${k.i}`)) / 2) * 2 } });
  }
  // ── 便色（2週ごろ・1か月ごろに選んだ番号。作った記録は5〜7番だけ）
  for (const [j, d] of [14, 30].entries()) add({ page: "stool", date: addDays(born, d), title: d === 14 ? "2週間ごろ" : "1か月ごろ", values: { colorNo: 5 + Math.floor(unit(fid, `st${j}`) * 3), ageText: d === 14 ? "生後2週" : "生後1か月" } });
  // ── 産後の母の経過
  if (mother) {
    add({ page: "postpartum", date: addDays(born, 14), title: "産後2週間の健診", who: mother.name, values: { days: 14 } });
    add({ page: "postpartum", date: addDays(born, 30), title: "産後1か月の健診", who: mother.name, values: { days: 30 } });
  }

  // ── 成長と乳幼児健診（健診の時期に点を1つ）
  // 早く生まれた日数（修正月齢に使う）。修正するのは37週より前に生まれた子だけ（早産の定義）
  const early = gestDays < 259 ? Math.max(0, diffDays(family.dueDate, born)) : 0;
  for (const c of CHILD_CHECKUPS) {
    const date = addDays(addMonths(born, c.m), Math.floor(unit(fid, `cc${c.m}`) * 10));
    for (const k of kids) {
      const corrected = Math.max(0, c.m - early / 30.4);
      const med = growthMedian(corrected);
      const shrink = Math.exp(-c.m / 6);
      const ratio = k.g / (birthWeightMedian(280) * (twins ? 0.9 : 1));
      const f = (key: string) => 1 + (ratio - 1) * shrink * 0.6 + 0.04 * spread(fid, `${key}${c.m}${k.i}`);
      add({
        page: "growth",
        date,
        title: c.checkup,
        who: k.who,
        values: { weightKg: round1(med.kg * f("kg")), heightCm: round1(med.cm * (1 + (f("cm") - 1) * 0.4)), headCm: round1(med.head * (1 + (f("hd") - 1) * 0.4)) },
      });
      add({ page: "child-checkup", date, title: c.checkup, who: k.who, values: { checkup: c.checkup } });
    }
  }

  // ── できた日（その子のペース。早く生まれた子は予定日から数える）
  for (const d of DEVELOPMENT_AT) {
    const start = early > 0 ? family.dueDate : born;
    const date = addDays(start, Math.round((d.m + 1.2 * spread(fid, `dv${d.item}`)) * 30.4));
    for (const k of kids) add({ page: "development", date, title: d.item, who: k.who, values: { item: d.item } });
  }

  // ── 予防接種（標準の時期・今日より前の物だけ）
  for (const v of VACCINES) {
    const date = addDays(addMonths(born, v.m), Math.floor(unit(fid, `vx${v.m}`) * 10));
    if (date >= today) continue;
    for (const k of kids) add({ page: "vaccine", date, title: v.dose ? `${v.vaccine} ${v.dose}` : v.vaccine, who: k.who, values: { vaccine: v.vaccine, ...(v.dose ? { dose: v.dose } : {}) } });
  }

  return sortByDate(out);
}

function sortByDate(xs: TechoEntry[]): TechoEntry[] {
  return xs.sort((a, b) => a.date.localeCompare(b.date));
}
