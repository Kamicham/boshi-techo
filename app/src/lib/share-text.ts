// 健診で見せる記録（家族の声②の C・2026-11-05）の、共有シートに入れる文と、1枚の決まった文。
// 病院あてなので、画面の言葉に関わらず日本語で作る（統括の頼み）。既定は要約の1行。表の全部は、家族が選んだ時だけ。
// 名前は入れない（1枚の紙には、手で書く欄を置く）。数字の良し悪し・評価の言葉は書かない。
// 中身は lib/share-view.ts の shareView の結果（出してよい欄だけ）だけを読む。試験は share-text.test.ts。
import { monthsFromDays } from "./growth";
import type { ShareSheet } from "./share-view";

/** 1枚の足元と、共有の文の終わりに、いつも置く文 */
export const SHARE_FOOT = "家族が入れた記録です。医療機関の記録ではありません。紙の母子手帳が正本です。";

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const n1 = (v: number | undefined) => (v === undefined ? "" : String(Math.round(v * 10) / 10));

/** 作った日（2027年4月18日） */
export function madeOn(today: string): string {
  return `${Number(today.slice(0, 4))}年${Number(today.slice(5, 7))}月${Number(today.slice(8, 10))}日`;
}

/** 妊娠週（36週・36週2日）。つらい別れの家族・週の無い行は空 */
export function weekText(sheet: Pick<ShareSheet, "hideCounts">, week: number | undefined, day: number | undefined): string {
  if (sheet.hideCounts || week === undefined) return "";
  return `${week}週${day ? `${day}日` : ""}`;
}

/** 生後の日数を、手帳の言い方に（生後12日・生後3か月） */
export function ageText(days: number): string {
  if (days < 31) return `生後${days}日`;
  return `生後${Math.floor(monthsFromDays(days))}か月`;
}

/** 双子などの時だけ「1人目 」を頭に（1人の時は付けない） */
function childHead(sheet: ShareSheet, child: number | undefined): string {
  const many = (sheet.growth?.length ?? 0) > 1 || [...(sheet.checkups ?? []), ...(sheet.vaccines ?? [])].some((x) => (x.child ?? 0) > 1);
  return many && child ? `${child}人目 ` : "";
}

/** 血圧（上/下） */
const bp = (hi?: number, lo?: number) => (hi === undefined && lo === undefined ? "" : `${n1(hi)}/${n1(lo)}`);

/** 要約の1行（いちばん新しい妊婦健診の数字・子の体重・次の予約・聞きたい事の数）と、足元の文 */
export function shareSummary(sheet: ShareSheet, today: string): string {
  const parts: string[] = [];
  const last = sheet.body?.checkups.at(-1);
  if (last) {
    const xs = [
      last.weightKg !== undefined ? `体重 ${n1(last.weightKg)}kg` : "",
      bp(last.bpHigh, last.bpLow) ? `血圧 ${bp(last.bpHigh, last.bpLow)}` : "",
      last.fundusCm !== undefined ? `子宮底長 ${n1(last.fundusCm)}cm` : "",
    ].filter(Boolean);
    const w = weekText(sheet, last.week, last.day);
    if (xs.length) parts.push(`妊婦健診 ${md(last.date)}${w ? `（${w}）` : ""} ${xs.join("・")}`);
  }
  for (const g of sheet.growth ?? []) {
    const p = [...g.points].reverse().find((x) => x.weightKg !== undefined);
    if (p) parts.push(`${childHead(sheet, g.child)}体重 ${n1(p.weightKg)}kg（${md(p.date)}・${ageText(p.ageDays)}）`);
  }
  if (sheet.next) parts.push(`次の予約 ${md(sheet.next.date)}${sheet.next.time ? ` ${sheet.next.time}` : ""}`);
  const q = sheet.questions?.length ?? 0;
  if (q) parts.push(`健診で聞きたい事 ${q}件`);
  return [`健診で見せる記録（${madeOn(today)}）: ${parts.join("。") || "数字はまだありません"}`, SHARE_FOOT].join("\n");
}

/** 表の全部（家族が選んだ時だけ）。1枚と同じ並び・同じ欄 */
export function shareFull(sheet: ShareSheet, today: string): string {
  const out: string[] = [`健診で見せる記録（${madeOn(today)}）`];
  const b = sheet.body;
  if (b) {
    const head = [b.heightCm !== undefined ? `身長 ${n1(b.heightCm)}cm` : "", b.preWeightKg !== undefined ? `妊娠前の体重 ${n1(b.preWeightKg)}kg` : "", b.bmi !== undefined ? `BMI ${n1(b.bmi)}` : ""].filter(Boolean);
    if (head.length) out.push("", `■ 妊娠前: ${head.join("・")}`);
    if (b.checkups.length) {
      out.push("", "■ 妊娠中の経過（診察月日 週数 子宮底長 体重 血圧 むくみ 尿蛋白 尿糖）");
      for (const r of b.checkups)
        out.push(
          [md(r.date), weekText(sheet, r.week, r.day), r.fundusCm !== undefined ? `${n1(r.fundusCm)}cm` : "", r.weightKg !== undefined ? `${n1(r.weightKg)}kg` : "", bp(r.bpHigh, r.bpLow), r.edema ?? "", r.urineProtein ?? "", r.urineSugar ?? ""]
            .map((x) => x || "-")
            .join(" "),
        );
    }
    if (b.home.length) {
      out.push("", "■ 家で測った物");
      for (const r of b.home) {
        const xs = [r.weightKg !== undefined ? `体重 ${n1(r.weightKg)}kg` : "", bp(r.bpHigh, r.bpLow) ? `血圧 ${bp(r.bpHigh, r.bpLow)}` : "", r.tempC !== undefined ? `体温 ${n1(r.tempC)}℃` : ""].filter(Boolean);
        const w = weekText(sheet, r.week, r.day);
        out.push(`${md(r.date)}${w ? ` ${w}` : ""} ${xs.join("・")}`);
      }
    }
  }
  for (const g of sheet.growth ?? []) {
    if (!g.points.length) continue;
    out.push("", `■ ${childHead(sheet, g.child)}身長・体重・頭囲`);
    for (const p of g.points) {
      const xs = [p.weightKg !== undefined ? `体重 ${n1(p.weightKg)}kg` : "", p.heightCm !== undefined ? `身長 ${n1(p.heightCm)}cm` : "", p.headCm !== undefined ? `頭囲 ${n1(p.headCm)}cm` : ""].filter(Boolean);
      out.push(`${md(p.date)} ${ageText(p.ageDays)} ${xs.join("・")}`);
    }
  }
  // 妊婦健診の日は「妊娠中の経過」に同じ日が並ぶので、表がある時は省く（子の健診の日だけ。1枚と同じ）
  const days = (sheet.checkups ?? []).filter((c) => c.kind !== "pregnancy" || !b?.checkups.length);
  if (days.length) {
    out.push("", "■ 健診の日");
    for (const c of days) {
      const w = weekText(sheet, c.week, c.day);
      out.push(`${md(c.date)} ${c.kind === "pregnancy" ? `妊婦健診${w ? `（${w}）` : ""}` : `${childHead(sheet, c.child)}${c.name ?? "乳幼児健診"}`}`);
    }
  }
  if (sheet.vaccines?.length) {
    out.push("", "■ 予防接種");
    for (const v of sheet.vaccines) out.push(`${md(v.date)} ${v.mother ? "（ママ）" : childHead(sheet, v.child)}${v.vaccine}${v.dose ? ` ${v.dose}` : ""}`);
  }
  if (sheet.next) out.push("", `■ 次の予約: ${md(sheet.next.date)}${sheet.next.time ? ` ${sheet.next.time}` : ""}`);
  if (sheet.questions?.length) {
    // ママの健診で聞く事と、子の健診で聞く事が両方ある時だけ、分けて書く
    const both = sheet.questions.some((q) => q.forChild) && sheet.questions.some((q) => !q.forChild);
    out.push("", "■ 健診で聞きたい事");
    for (const [label, forChild] of both ? ([["ママの健診で", false], ["子の健診で", true]] as const) : ([["", null]] as const)) {
      if (label) out.push(`（${label}）`);
      for (const q of sheet.questions) if (forChild === null || q.forChild === forChild) out.push(`・${q.text}`);
    }
  }
  const h = sheet.motherHealth;
  if (h) {
    const xs = [
      // 身長と妊娠前の体重は、体の束が無い時だけここに（同じ数を2回書かない）
      !b && h.heightCm !== undefined ? `身長: ${n1(h.heightCm)}cm` : "",
      !b && h.preWeightKg !== undefined ? `妊娠前の体重: ${n1(h.preWeightKg)}kg` : "",
      h.history ? `これまでの病気: ${h.history}` : "",
      h.allergy ? `アレルギー: ${h.allergy}` : "",
      h.medicine ? `薬: ${h.medicine}` : "",
      h.pastBirths ? `前のお産: ${h.pastBirths}` : "",
      h.smoking ? `たばこ: ${h.smoking}` : "",
    ].filter(Boolean);
    if (xs.length) out.push("", "■ 妊婦の健康状態", ...xs);
  }
  out.push("", SHARE_FOOT);
  return out.join("\n");
}
