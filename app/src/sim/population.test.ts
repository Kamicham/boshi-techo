// 1000組が統計の割合のとおりに作れているか（割合の検査）と、現実に無い組み合わせが無いか（組み合わせの検査）。
// 許容幅: 割合が5%以上の区分は、標本の揺れ（3σ）を見て最大4ポイント（分母が800組未満の一部の家族だけの割合は 3σ）。5%未満の区分は件数の幅（期待件数 ± 3√期待件数 + 1）。
// ついでに、なりきりの家族の並び（src/sim/pick.json）と、割合の一覧（docs/SIM_STATS.md）を書き出す。どちらも決まった種なので、変わるのは作り方を変えた時だけ。
import { afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addMonths, diffDays, lmpFromDue } from "../lib/clock";
import { BIRTH_ORDER_BY_AGE, ART_AGE_WEIGHT, KU23, PER_FAMILY, PLACES, SEIREI_BIRTHS, STATS, WEEK_WEIGHT_RHO, type StatItem } from "./stats";
import { DUE_RANGE, getPopulation, pickRounds, POP_SEED, POP_TODAY, STAGES, type PopFamily } from "./population";
import { SIM_FAMILIES } from "./families";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const pop = getPopulation();
const N = pop.length;

interface Row {
  item: string;
  band: string;
  expected: number;
  observed: number;
  n: number;
  ok: boolean;
  tol: string;
}
const rows: Row[] = [];

/** 割合（%）を統計と比べる */
function near(item: string, band: string, expectedPct: number, hits: number, n: number) {
  const obs = (hits / n) * 100;
  let ok: boolean;
  let tol: string;
  if (expectedPct >= 5) {
    const sd = Math.sqrt((expectedPct / 100) * (1 - expectedPct / 100) / n) * 100;
    // 1000組全体では最大4ポイント。一部の家族だけの割合（分母が小さい）は 3σ
    const t = n >= 800 ? Math.min(4, Math.max(1, 3 * sd)) : 3 * sd;
    ok = Math.abs(obs - expectedPct) <= t;
    tol = `±${t.toFixed(1)}pt`;
  } else {
    const e = (expectedPct / 100) * n;
    const lo = Math.max(0, Math.floor(e - 3 * Math.sqrt(e) - 1));
    const hi = Math.ceil(e + 3 * Math.sqrt(e) + 1);
    ok = hits >= lo && hits <= hi;
    tol = `${lo}〜${hi}件`;
  }
  rows.push({ item, band, expected: expectedPct, observed: obs, n, ok, tol });
  return ok;
}

function dist(item: string, d: Record<string, number>, keyOf: (f: PopFamily) => string | null, list: PopFamily[] = pop) {
  const total = Object.values(d).reduce((a, b) => a + b, 0);
  const used = list.filter((f) => keyOf(f) !== null);
  for (const [k, v] of Object.entries(d)) near(item, k, (v / total) * 100, used.filter((f) => keyOf(f) === k).length, used.length);
}

const children = (f: PopFamily) => f.profile.weights.length;
const weekBand = (d: number) => (d < 196 ? "22-27週" : d < 224 ? "28-31週" : d < 259 ? "32-36週" : d < 294 ? "37-41週" : "42週以上");
const weightBand = (g: number) => (g < 1000 ? "1,000g未満" : g < 1500 ? "1,000-1,499g" : g < 2000 ? "1,500-1,999g" : g < 2500 ? "2,000-2,499g" : "2,500g以上");

describe("1000組の割合が統計と合う", () => {
  it("1000組そろっていて、id は pop-0001〜pop-1000", () => {
    expect(N).toBe(1000);
    expect(pop[0].id).toBe("pop-0001");
    expect(pop[999].id).toBe("pop-1000");
    expect(new Set(pop.map((f) => f.id)).size).toBe(1000);
  });

  it("住む所（都道府県・場所の種類）", () => {
    dist("都道府県", STATS.prefecture.dist, (f) => f.prefecture);
    dist("住む場所の種類", STATS.placeType.dist, (f) => f.profile.placeType);
  });

  it("母の年齢・出生順位", () => {
    dist("母の年齢", STATS.motherAge.dist, (f) => f.profile.ageBand);
    dist("出生順位", STATS.birthOrder.dist, (f) => f.profile.order);
    dist("35-39歳の出生順位", BIRTH_ORDER_BY_AGE["35-39"], (f) => f.profile.order, pop.filter((f) => f.profile.ageBand === "35-39"));
  });

  it("体外受精・双子・週数・体重・NICU・帝王切開", () => {
    near("体外受精など", "体外受精など", STATS.art.dist["体外受精など"], pop.filter((f) => f.profile.art).length, N);
    near("双子（家族）", "多胎", STATS.multiple.dist["多胎"], pop.filter((f) => f.profile.twins).length, N);
    const kids = pop.reduce((n, f) => n + children(f), 0);
    const wk = (b: string) => pop.reduce((n, f) => n + (weekBand(f.profile.gestDays) === b ? children(f) : 0), 0);
    for (const [b, v] of Object.entries(STATS.weeks.dist)) near("妊娠期間（子）", b, v, wk(b), kids);
    near("妊娠期間（子）", "37週未満", 5.81, wk("22-27週") + wk("28-31週") + wk("32-36週"), kids);
    const wt = (b: string) => pop.reduce((n, f) => n + f.profile.weights.filter((g) => weightBand(g) === b).length, 0);
    for (const [b, v] of Object.entries(STATS.weight.dist)) near("出生時の体重（子）", b, v, wt(b), kids);
    near("出生時の体重（子）", "2,500g未満", 9.77, kids - wt("2,500g以上"), kids);
    // NICU の期待値 = 体重の分布 × 体重ごとの入院率（約3.2%。家族では双子の分だけ少し多い）
    const w = STATS.weight.dist;
    const r = STATS.nicuByWeight.dist;
    const nicuChild = (w["1,000g未満"] + w["1,000-1,499g"]) * r["1,500g未満"] / 100 + w["1,500-1,999g"] * r["1,500-1,999g"] / 100 + w["2,000-2,499g"] * r["2,000-2,499g"] / 100 + w["2,500g以上"] * r["2,500g以上"] / 100;
    near("NICU（家族）", "NICU あり", nicuChild, pop.filter((f) => f.profile.nicu).length, N);
    near("帝王切開", "帝王切開", STATS.cesarean.dist["帝王切開"], pop.filter((f) => f.profile.cesarean).length, N);
  });

  it("国籍・婚姻・ひとり親", () => {
    dist("父母の国籍と婚姻", STATS.nationality.dist, (f) => f.profile.nationality.kind);
    near("ひとり親（家族）", "ひとり親", STATS.unmarried.dist["0〜2歳のひとり親（推計）"], pop.filter((f) => f.profile.marital === "ひとり親").length, N);
    near("日本語に不安（母）", "母が不安", STATS.japanese.dist["母が不安（全家族）"], pop.filter((f) => f.profile.japaneseAnxious.mother).length, N);
  });

  it("祖父母・里帰り", () => {
    near("三世代同居", "三世代", STATS.threeGen.dist["三世代"], pop.filter((f) => f.profile.marital !== "ひとり親" && (f.profile.grandma.mother === "同居" || f.profile.grandma.father === "同居")).length, pop.filter((f) => f.profile.marital !== "ひとり親").length);
    const wm = STATS.wifeMother.dist;
    const rest = { 同じ市区町村: wm["同じ市区町村"], 遠く: wm["それ以外の地域"], 亡くなっている: wm["亡くなっている"] };
    dist("妻の母（同居でない・日本国籍の母）", rest, (f) => (f.profile.grandma.mother === "同居" || f.profile.nationality.mother !== "日本" ? null : f.profile.grandma.mother));
    const s = STATS.satogaeri.dist;
    dist("里帰り出産", { しない: s["しない"], 同じ市町村: s["同じ市町村"], 同じ都道府県: s["同じ都道府県"], ほかの都道府県: s["ほかの都道府県"] }, (f) => f.profile.satogaeri?.kind ?? "しない");
  });

  it("学歴・耳", () => {
    dist("母の最終学歴", STATS.education.dist, (f) => f.profile.education);
    near("聴覚に障害がある親", "父母のどちらか", STATS.hearing.dist["父母のどちらか"], pop.filter((f) => f.profile.hearing).length, N);
  });

  it("母の仕事と育休", () => {
    const first = pop.filter((f) => f.profile.order === "第1子");
    const key = (f: PopFamily) => ({ 育休: "続けた・育休あり", 育休なしで継続: "続けた・育休なし", 退職: "出産で退職", 仕事なし: "妊娠前から無職・不詳" })[f.profile.motherWork.after];
    dist("第1子の母の働き方", STATS.motherWorkFirst.dist, key, first);
    const later = pop.filter((f) => f.profile.order !== "第1子");
    dist("第2子以降の母の働き方（生まれた時）", STATS.motherWorkAfter.dist, (f) => (f.profile.motherWork.atPregnancy === "無職" ? "仕事なし" : f.profile.motherWork.atPregnancy), later);
    const leave = pop.filter((f) => f.profile.motherWork.leaveDays != null);
    const months = (f: PopFamily) => (f.profile.motherWork.leaveDays ?? 0) / 30.4;
    near("母の育休の期間", "10〜18か月", STATS.leaveWomen.dist["10〜12か月"] + STATS.leaveWomen.dist["12〜18か月"], leave.filter((f) => months(f) >= 10 && months(f) < 18).length, leave.length);
  });

  it("父の仕事・夜勤・単身赴任・育休", () => {
    const withP = pop.filter((f) => f.profile.father);
    dist("父の働き方", STATS.fatherWork.dist, (f) => ({ 正規: "正規", 自営など: "自営など", その他: "その他（非正規・無職・不詳）" })[f.profile.father!.work], withP);
    const emp = withP.filter((f) => f.profile.father!.work !== "自営など");
    near("深夜勤務がある（雇われの父）", "ある", STATS.nightShift.dist["ある"], emp.filter((f) => f.profile.father!.nightShift).length, emp.length);
    const sei = withP.filter((f) => f.profile.father!.work === "正規");
    near("父の育休（正規の父）", "取る", STATS.leaveRate.dist["男性"], sei.filter((f) => f.profile.father!.leave).length, sei.length);
    const lv = sei.filter((f) => f.profile.father!.leave);
    near("父の育休の期間", "1か月未満", STATS.leaveMen.dist["5日未満"] + STATS.leaveMen.dist["5日〜2週間"] + STATS.leaveMen.dist["2週間〜1か月"], lv.filter((f) => f.profile.father!.leave!.days < 30).length, lv.length);
    near("単身赴任（正規の父）", "単身赴任", 1.3, sei.filter((f) => f.profile.father!.tanshin).length, sei.length);
  });

  it("引っ越し", () => {
    dist("妊娠中〜2歳の引っ越し", STATS.moving.dist, (f) => f.profile.move?.kind ?? "しない");
  });

  it("今日の時期が、授かる前〜2歳過ぎにばらけている", () => {
    for (const s of STAGES) expect(pop.filter((f) => f.profile.stageToday === s).length, s).toBeGreaterThan(20);
    for (const f of pop) {
      const off = diffDays(f.dueDate, POP_TODAY);
      expect(off).toBeGreaterThanOrEqual(DUE_RANGE[0]);
      expect(off).toBeLessThanOrEqual(DUE_RANGE[1]);
    }
  });

  it("ずれた項目が無い", () => {
    const bad = rows.filter((r) => !r.ok).map((r) => `${r.item} ${r.band}: 統計 ${r.expected.toFixed(2)}% / 1000組 ${r.observed.toFixed(2)}%（${r.tol}）`);
    expect(bad, bad.join("\n")).toEqual([]);
  });
});

describe("現実に無い組み合わせが無い", () => {
  const each = (name: string, bad: (f: PopFamily) => string | false) =>
    it(name, () => {
      const hits = pop.map((f) => [f.id, bad(f)] as const).filter(([, b]) => b);
      expect(hits.slice(0, 5).map(([id, b]) => `${id}: ${b}`)).toEqual([]);
    });

  each("19歳以下で第3子以上が無い", (f) => f.profile.motherAge <= 19 && f.profile.order === "第3子以上" && `${f.profile.motherAge}歳で${f.profile.order}`);
  each("上の子を産んだ時に母が16歳以上", (f) => f.profile.olderChildrenMonths.some((m) => f.profile.motherAge * 12 - m < 16 * 12) && `${f.profile.motherAge}歳・上の子 ${f.profile.olderChildrenMonths.join(",")}か月`);
  each("上の子の数が出生順位と合う", (f) => f.profile.olderChildrenMonths.length !== { 第1子: 0, 第2子: 1, 第3子以上: 2 }[f.profile.order] && "上の子の数が違う");
  each("ひとり親にパートナーがいない／ひとり親でなければパートナーがいる", (f) => (f.profile.marital === "ひとり親") === f.members.some((m) => m.role === "パートナー") && "ひとり親とパートナーが食い違う");
  each("ひとり親に父の仕事・父の育休が無い", (f) => f.profile.marital === "ひとり親" && !!f.profile.father && "ひとり親に父の仕事");
  each("NICU は生まれた後（生まれた日がある・週数と体重がある）", (f) => f.profile.nicu && (!f.birthDate || !f.profile.weights.length) && "NICU なのに生まれていない");
  each("生まれた日は週数のとおり", (f) => diffDays(f.birthDate!, lmpFromDue(f.dueDate)) !== f.profile.gestDays && "生まれた日と週数が食い違う");
  each("22週より前に生まれない・43週を超えない", (f) => (f.profile.gestDays < 154 || f.profile.gestDays > 300) && `${f.profile.gestDays}日`);
  each("双子は子が2人・単胎は1人", (f) => f.profile.weights.length !== (f.profile.twins ? 2 : 1) && "子の数が違う");
  each("体重は450〜4000g", (f) => f.profile.weights.some((g) => g < 450 || g > 4000) && f.profile.weights.join(","));
  each("23区は東京都だけ・政令市は自分の県", (f) => {
    if (f.profile.placeType === "東京23区") return f.prefecture !== "東京都" || !KU23.includes(f.city) ? `${f.prefecture}${f.city}` : false;
    if (f.profile.placeType === "政令指定都市") return SEIREI_BIRTHS[f.city]?.pref !== f.prefecture ? `${f.prefecture}${f.city}` : false;
    const p = PLACES[f.prefecture];
    return ![...p.cities, ...p.towns, ...(p.islands ?? [])].includes(f.city) && `${f.prefecture}${f.city}`;
  });
  each("里帰りは妻の母の住む所に合う", (f) => {
    const s = f.profile.satogaeri;
    if (!s) return false;
    if (["亡くなっている", "同居", "国外"].includes(f.profile.grandma.mother)) return `妻の母が${f.profile.grandma.mother}なのに里帰り`;
    if (s.kind === "同じ市町村" && (f.profile.grandma.mother !== "同じ市区町村" || s.city !== f.city)) return "同じ市町村の里帰りなのに母が遠い";
    if (s.kind !== "同じ市町村" && f.profile.grandma.mother !== "遠く") return "遠くへの里帰りなのに母が近い";
    if (s.kind === "ほかの都道府県" && s.prefecture === f.prefecture) return "県外の里帰りが同じ県";
    return false;
  });
  each("家族の人（members）は母とパートナーだけ", (f) => f.members.some((m) => m.role !== "母" && m.role !== "パートナー") && "母とパートナーのほかの人がいる");
  each("両方の祖父母と同居しない", (f) => f.profile.grandma.mother === "同居" && f.profile.grandma.father === "同居" && "両方と同居");
  each("21歳以下で大学卒・23歳以下で大学院卒が無い", (f) => ((f.profile.motherAge < 22 && ["大学", "大学院"].includes(f.profile.education)) || (f.profile.motherAge < 24 && f.profile.education === "大学院")) && `${f.profile.motherAge}歳で${f.profile.education}`);
  each("育休は雇われて働く母だけ・期間は36か月まで", (f) => {
    const w = f.profile.motherWork;
    if (w.after === "育休" && !["正規", "非正規"].includes(w.atPregnancy)) return `${w.atPregnancy}で育休`;
    if (w.after === "仕事なし" && w.atPregnancy !== "無職") return "働いているのに仕事なし";
    if (w.leaveDays != null && (w.leaveDays < 1 || w.leaveDays > 36 * 30.4 + 1)) return `育休${w.leaveDays}日`;
    return false;
  });
  each("父の育休・単身赴任は正規の父だけ／夜勤は自営に付けない", (f) => {
    const p = f.profile.father;
    if (!p) return false;
    if ((p.leave || p.tanshin) && p.work !== "正規") return `${p.work}で育休か単身赴任`;
    if (p.nightShift && p.work === "自営など") return "自営で夜勤";
    return false;
  });
  each("引っ越しは1000日の中・町が変わる物だけ Family に入る", (f) => {
    const m = f.profile.move;
    if (!m) return f.movedOn ? "引っ越していないのに movedOn" : false;
    if (m.on < lmpFromDue(f.dueDate) || m.on > addMonths(f.birthDate!, 24)) return `引っ越しが1000日の外 ${m.on}`;
    if (m.inFamily !== !!f.movedOn) return "inFamily と movedOn が食い違う";
    if (f.movedOn && (f.previousCity === f.city && f.previousPrefecture === f.prefecture)) return "町が変わらない引っ越しが Family に入った";
    if (f.movedOn && f.movedOn <= POP_TODAY) return "使い始める前の引っ越しが Family に入った";
    return false;
  });
  each("persona の使う人は家族にいて、目的は2つ・使う期間の中", (f) => {
    if (!f.members.some((m) => m.id === f.persona.meId)) return "meId がいない";
    if (f.persona.goals.length !== 2) return "目的が2つでない";
    return false;
  });
  each("生まれる前の家族に子の名前が付いていない", (f) => !!f.childName && f.birthDate! > POP_TODAY && "生まれる前に名前");
  each("同性カップルは1000組に入れない（統計で約0）", (f) => f.members.filter((m) => m.role === "母").length !== 1 && "母が1人でない");
});

// ───────── 書き出し: なりきりの並び・割合の一覧・検査の表 ─────────

const RARE = SIM_FAMILIES.map((f) => f.id);

describe("書き出し", () => {
  it("なりきりの家族の並び（src/sim/pick.json）", () => {
    const rounds = pickRounds(pop, RARE);
    const json = {
      note: "Workflow simulate の既定の家族。本体が rounds[n] を args.pick として渡す（n は前回の次。Workflow はファイルを読めない）。1000組から割合のまま6家族（同じ時期は2家族まで）＋30家族から珍しい型を1家族（順番）。population.test.ts が書き出す",
      seed: POP_SEED,
      today: POP_TODAY,
      rounds,
    };
    fs.writeFileSync(path.join(HERE, "pick.json"), JSON.stringify(json, null, 1) + "\n");
    for (const r of rounds) {
      expect(r.families).toHaveLength(6);
      expect(new Set(r.families.map((f) => f.id)).size).toBe(6);
    }
  });

  it("割合の一覧（docs/SIM_STATS.md）が stats.ts と合っている", () => {
    const md = statsDoc();
    const file = path.resolve(HERE, "../../../docs/SIM_STATS.md");
    if (process.env.SIM_WRITE_DOCS === "1" || !fs.existsSync(file)) fs.writeFileSync(file, md);
    expect(fs.readFileSync(file, "utf8"), "docs/SIM_STATS.md が古い。SIM_WRITE_DOCS=1 npx vitest run src/sim/population.test.ts で書き直す").toBe(md);
  });
});

afterAll(() => {
  const out = path.resolve(HERE, "../../sim/out");
  fs.mkdirSync(out, { recursive: true });
  const L = ["# 1000組の割合の検査", "", `種 ${POP_SEED}・${N}組。統計の割合と、作った1000組の割合。`, "", "| 印 | 項目 | 区分 | 統計 | 1000組 | 分母 | 許容 |", "|---|---|---|---|---|---|---|"];
  for (const r of rows) L.push(`| ${r.ok ? "○" : "×"} | ${r.item} | ${r.band} | ${r.expected.toFixed(2)}% | ${r.observed.toFixed(2)}% | ${r.n} | ${r.tol} |`);
  fs.writeFileSync(path.join(out, "population.md"), L.join("\n") + "\n");
});

// ───────── docs/SIM_STATS.md ─────────

function statsDoc(): string {
  const L: string[] = [];
  L.push("# 1000組のもとにした統計", "");
  L.push("シミュレーションの1000組（`app/src/sim/population.ts`。すべて作った家族で、実在の人物ではない。町だけは実在の市区町村）は、下の割合から作っています。数字の正本は `app/src/sim/stats.ts` で、この一覧はそこから書き出しています（`app/src/sim/population.test.ts` が食い違いを止めます）。");
  L.push("");
  L.push("- **統計**: 公的な統計・一次の出典の数字そのまま");
  L.push("- **推計**: 出典の数字から計算した物（計算のしかたは「注」）");
  L.push("- **近似**: 手元に統計が無いので置いた物（理由は「注」）。都合のよい作り話で埋めないため、ここに全部書きます");
  L.push("");
  L.push(`1組は、全国の1年の出生の 1/1000（2025年 671,270人 ÷ 1000 ≒ ${PER_FAMILY}家族）にあたります。報告の「全国に直すと年に約◯家族」は、1000組の中の数 × ${PER_FAMILY} です（双子の家族も1家族）。`);
  L.push("");
  L.push("## 項目", "");
  L.push("| 項目 | 割合 | 印 | 数えた物 | 年 | 出典 |", "|---|---|---|---|---|---|");
  for (const s of Object.values(STATS) as StatItem[]) {
    const d = Object.entries(s.dist).map(([k, v]) => `${k} ${v.toLocaleString("ja-JP")}`).join(" / ");
    L.push(`| ${s.label} | ${d} | ${s.kind} | ${s.unit} | ${s.year} | ${s.source.map((x) => `[${x.name}](${x.url})`).join("<br>")} |`);
  }
  L.push("", "## 注（推計・近似の中身）", "");
  for (const s of Object.values(STATS) as StatItem[]) if (s.note) L.push(`- **${s.label}**（${s.kind}）: ${s.note}`);
  L.push("", "## 母の年齢ごとの出生順位（近似）", "", "| 母の年齢 | 第1子 | 第2子 | 第3子以上 |", "|---|---|---|---|");
  for (const [a, d] of Object.entries(BIRTH_ORDER_BY_AGE)) L.push(`| ${a} | ${d["第1子"]}% | ${d["第2子"]}% | ${d["第3子以上"]}% |`);
  L.push("", `体外受精などの年齢の重み（近似）: ${Object.entries(ART_AGE_WEIGHT).map(([a, w]) => `${a}歳 ${w}`).join(" / ")}（全体が12.6%になるよう割り戻す）。週数と体重の相関: ${WEEK_WEIGHT_RHO}（近似）。`);
  L.push("", "## 市区町村（近似）", "");
  L.push("各県の代表の市・町村・離島だけを実名で持っています（全部の市区町村の表ではありません）。政令指定都市と東京23区は出生の数で、ほかは等分で選びます。");
  L.push("", "| 都道府県 | 政令市 | 市 | 町村 | 離島 |", "|---|---|---|---|---|");
  for (const [p, v] of Object.entries(PLACES)) {
    const sei = Object.entries(SEIREI_BIRTHS).filter(([, x]) => x.pref === p).map(([c]) => c);
    L.push(`| ${p} | ${sei.join("・") || "—"}${p === "東京都" ? `（ほかに23区: ${KU23.join("・")}）` : ""} | ${v.cities.join("・")} | ${v.towns.join("・")} | ${v.islands?.join("・") ?? "—"} |`);
  }
  L.push("", "## 早送りの検査での家族の動き（仮定）", "");
  L.push("統計ではなく、検査のための動きの仮定です。30家族の検査と同じ作りに合わせています。");
  L.push("");
  L.push("- どの家族も今日（2026-11-03）から使い始める（使い始める前に期限が過ぎた事は済み扱い。アプリの「途中から使い始めた家族」と同じ）");
  L.push("- 母とパートナーは毎日、自分の画面の一番上を1つ済ませる。夜勤の父は3日おき、単身赴任の父は7日おきで、生まれてから10日は手を付けられない");
  L.push("- ふだんの検査（`npm run sim`）は1週おき＋節目の日（届出・出産の前後・生後14日・1か月・3か月・1歳・2歳など）だけ画面を確かめ、間の日に家族が動いた分は、確かめる日の前にまとめて動かす（近似）。全部の日を通すのは `npm run sim:full`");
  L.push("");
  return L.join("\n");
}
