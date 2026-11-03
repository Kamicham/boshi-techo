// 手帳の記録（予防接種・乳幼児健診）から、今日の画面の予定（lib/milestones.ts の id）の「済み」を出す。
// 手帳を背骨にする: 手帳に「BCG を受けた」とあるのに、今日の画面が「BCG を受ける」を期限切れに出す、を無くす。
// 体の判断はしない。見るのは「受けた・行った」の記録があるかだけで、結果の欄は読まない。
// 候補（pending = 家族がまだ OK していない）と、今日より後の日付の記録は数えない。
// 画面からもサーバからも読める純関数（server-only にしない）。サーバでは app/api/done/_lib/done.ts の doneFromTechoFor が使う。
//
// 呼び方の揺れに強くする: 全角半角（NFKC）・「水痘／水ぼうそう」「MR／麻しん風しん」「ヒブ・四種混合／五種混合」・
// 回の書き方「1回目」「第1期」「1期」「1」「一回目」「追加」。回が書かれていない時は、同じ接種の日付の順で数える。
// 双子など: 記録の誰（who）を分けずに数える（どちらかの子の記録で済みになる。近似。2人目の分は家族が画面で見る）。
import type { TechoEntry } from "./techo";

type Vax = "hepb" | "rota" | "pcv" | "five" | "bcg" | "mr" | "var" | "je";

/** 名前の正規化（全角→半角・小文字・空白を詰める） */
function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "");
}

/** 接種の名前 → 種類（知らない名前は null。任意接種のおたふくかぜ・インフルエンザなどは数えない） */
export function vaxKind(name: unknown): Vax | null {
  const n = norm(name);
  if (!n) return null;
  if (/bcg/.test(n)) return "bcg";
  if (/日本脳炎|jev?$/.test(n)) return "je";
  if (/b型肝炎|b肝|hbv|^hb$|hepb|hepatitisb/.test(n)) return "hepb";
  if (/ロタ|rota/.test(n)) return "rota";
  if (/肺炎球菌|pcv|プレベナー|バクニュバンス/.test(n)) return "pcv";
  // 五種混合（2024年4月から）。それより前の四種混合＋ヒブも同じ回の数え方にする（同じ日の2本は1回と数える）
  if (/五種|5種|四種|4種|dpt|ヒブ|hib|ゴービック|クイントバック/.test(n)) return "five";
  if (/麻しん|麻疹|はしか|風しん|風疹|^mr|mr\)|\(mr/.test(n)) return "mr";
  if (/水痘|水ぼうそう|水疱瘡|みずぼうそう/.test(n)) return "var";
  return null;
}

const KANJI: Record<string, string> = { 一: "1", 二: "2", 三: "3", 四: "4", 五: "5" };

/**
 * 回（何回目・何期）を読む。読めなければ null（日付の順で数える）。
 * MR は「期」を回として読む（1期・2期）。日本脳炎は 1期の初回1・2回目と追加（=3）を数え、2期（9歳）は 0 にして数えない。
 * 五種混合・肺炎球菌の「追加」は4回目。
 */
export function doseOf(kind: Vax, dose: unknown): number | null {
  const d = norm(dose).replace(/[一二三四五]/g, (c) => KANJI[c]);
  if (!d) return null;
  if (kind === "je") {
    if (/2期/.test(d)) return 0;
    if (/追加/.test(d)) return 3;
    const kai = d.match(/(\d+)回/);
    if (kai) return Number(kai[1]);
    if (/期/.test(d)) return null;
  } else if (kind === "mr") {
    const ki = d.match(/(\d+)期/) ?? d.match(/(\d+)回/);
    if (ki) return Number(ki[1]);
  } else {
    if (/追加/.test(d) && (kind === "pcv" || kind === "five")) return 4;
    const kai = d.match(/(\d+)回/);
    if (kai) return Number(kai[1]);
    const ki = d.match(/(\d+)期/);
    if (ki) return Number(ki[1]);
  }
  const bare = d.match(/^(\d+)/);
  return bare ? Number(bare[1]) : null;
}

/** 健診の名前 → 月齢（1歳6か月 → 18、3〜4か月 → 3、3歳 → 36）。読めなければ null */
export function checkupMonths(name: unknown): number | null {
  const n = norm(name)
    .replace(/[ヶヵケカ箇个]月/g, "か月")
    .replace(/ヶ|ヵ/g, "か")
    .replace(/半/g, "6か月");
  const ym = n.match(/(\d+)歳(\d+)か月/);
  if (ym) return Number(ym[1]) * 12 + Number(ym[2]);
  const y = n.match(/(\d+)歳/);
  if (y) return Number(y[1]) * 12;
  // 「3〜4か月」は始まりの月で読む
  const m = n.match(/(\d+)[〜~\-ー–]\d+か月/) ?? n.match(/(\d+)か月/);
  if (m) return Number(m[1]);
  return null;
}

/** 健診の月齢 → 予定の id（6〜7か月健診は予定に無いので数えない） */
function checkupMilestone(months: number): string | null {
  if (months === 1) return "one-month-checkup";
  if (months >= 3 && months <= 5) return "checkup-3-4m";
  if (months >= 8 && months <= 11) return "checkup-9-10m";
  if (months >= 18 && months <= 23) return "checkup-18m";
  if (months >= 36 && months <= 47) return "checkup-3y";
  return null;
}

type Rec = Pick<TechoEntry, "page" | "date" | "values"> & { pending?: boolean };

/**
 * 手帳の記録から、済んだ予定の id を出す。
 * 接種の予定は、その日に受ける標準の接種がそろった時だけ済みにする（足りない物があれば済みにしない＝受け損ねを隠さない）:
 * - vaccines-start: 五種混合・小児用肺炎球菌・B型肝炎の1回目（ロタは受けられる週が限られ、過ぎると受けないので、無くても済み）
 * - vaccines-3m: 同じ3つの2回目／vaccines-4m: 五種混合・小児用肺炎球菌の3回目／vaccines-7m: B型肝炎の3回目／bcg: BCG
 * - first-birthday-vaccines: 麻しん風しん（MR）の1期と、水ぼうそう（水痘）の1回目の両方。
 *   MR の1期だけでは済みにしない（水痘の1回目を受け損ねるのを隠さないため。肺炎球菌・五種混合の追加は時期が1歳半ごろまでずれるので見ない）
 * - vaccines-18m: 水ぼうそう（水痘）の2回目／mr-vaccine-2: MR の2期
 * - je-vaccine-1: 日本脳炎の1期の初回2回／je-vaccine-1-booster: 1期の追加（3回目）
 */
export function doneFromTecho(entries: Rec[], today: string): Set<string> {
  const out = new Set<string>();
  const live = entries.filter((e) => !e.pending && typeof e.date === "string" && e.date <= today);

  // 接種: 種類ごとに、読めた回と、回の無い記録の日付
  const doses = new Map<Vax, Set<number>>();
  const undated = new Map<Vax, string[]>();
  const sorted = live.filter((e) => e.page === "vaccine").sort((a, b) => a.date.localeCompare(b.date));
  for (const e of sorted) {
    const k = vaxKind(e.values?.vaccine);
    if (!k) continue;
    const n = doseOf(k, e.values?.dose);
    if (n === 0) continue;
    if (n != null) {
      if (!doses.has(k)) doses.set(k, new Set());
      doses.get(k)!.add(n);
    } else {
      if (!undated.has(k)) undated.set(k, []);
      const ds = undated.get(k)!;
      // 同じ日の2本（四種混合とヒブなど）は1回と数える
      if (!ds.includes(e.date)) ds.push(e.date);
    }
  }
  // 回の無い記録は、読めた回の続きとして日付の順に数える（1回目・2回目…）
  const count = (k: Vax): Set<number> => {
    const s = new Set(doses.get(k) ?? []);
    let next = 1;
    for (const _ of undated.get(k) ?? []) {
      void _;
      while (s.has(next)) next++;
      s.add(next);
    }
    return s;
  };
  // 先の回の記録があれば、前の回も受けている（3回目だけ写した、など）
  const atLeast = (k: Vax, n: number) => [...count(k)].some((x) => x >= n);

  if (atLeast("five", 1) && atLeast("pcv", 1) && atLeast("hepb", 1)) out.add("vaccines-start");
  if (atLeast("five", 2) && atLeast("pcv", 2) && atLeast("hepb", 2)) out.add("vaccines-3m");
  if (atLeast("five", 3) && atLeast("pcv", 3)) out.add("vaccines-4m");
  if (atLeast("hepb", 3)) out.add("vaccines-7m");
  if (atLeast("bcg", 1)) out.add("bcg");
  if (atLeast("mr", 1) && atLeast("var", 1)) out.add("first-birthday-vaccines");
  if (atLeast("var", 2)) out.add("vaccines-18m");
  if (atLeast("mr", 2)) out.add("mr-vaccine-2");
  if (atLeast("je", 2)) out.add("je-vaccine-1");
  if (atLeast("je", 3)) out.add("je-vaccine-1-booster");

  // 乳幼児健診
  for (const e of live) {
    if (e.page !== "child-checkup") continue;
    const m = checkupMonths(e.values?.checkup);
    const id = m == null ? null : checkupMilestone(m);
    if (id) out.add(id);
  }
  return out;
}
