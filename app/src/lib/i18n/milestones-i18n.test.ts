// 予定の言葉（lib/i18n/milestone-words.ts の msWords・辞書 dict/milestones.ts）の試験。
// 作った30家族と見本の家族の1000日に出る予定の見出し（plain）・一言（hint）・正式な言い方（title）を、中文・English で引き、
// 訳に日本語のかなが残らないかを見る（名前・町と、括弧で並べた窓口の日本語は除く）。日本語の画面は1字も変えない。
// 家族の形（双子・ひとり親・里帰り・上の子の呼び名など）で変わる言い方は、30家族に無い形も、下で作った家族で引く。言い方の取りこぼしは、ここで見つけて辞書と msWords に足す
import { describe, expect, it } from "vitest";
import { addDays, lmpFromDue, secondBirthday } from "@/lib/clock";
import { DEMO_FAMILY, type Family, type Member } from "@/lib/demo-family";
import { MILESTONES, scheduleFor } from "@/lib/milestones";
import type { Situation } from "@/lib/situation";
import { birthFacts } from "@/lib/techo-seed";
import { getPopulation } from "@/sim/population";
import { SIM_FAMILIES } from "@/sim/families";
import { withLang } from ".";
import { DICTS } from "./dicts";
import { msWords } from "./milestone-words";

type Field = "plain" | "hint" | "title";
const FIELDS: readonly Field[] = ["plain", "hint", "title"];
interface Said {
  family: string;
  id: string;
  field: Field;
  text: string;
  /** 差し込まれて、訳さずに日本語のまま出る言葉（呼び名・町の名前） */
  names: string[];
}

/** その日の家族（早送りの検査 sim/fastforward.test.ts の viewAt と同じ: 生まれる前は生まれた日を知らない。生まれた後は出産の記録の体重・週数を知っている） */
function viewAt(f: Family, day: string): Family {
  if (f.birthDate && day < f.birthDate) return { ...f, birthDate: undefined };
  if (!f.birthDate) return f;
  const { gestDays, weightsG } = birthFacts(f);
  return { ...f, birthWeightG: Math.min(...weightsG), birthWeek: Math.floor(gestDays / 7) };
}

/** 家族の1000日の節目（授かる前・妊娠中・引っ越しの前後・生まれる前後・1歳過ぎ・2歳）に出る予定の言葉を、重ねずに集める */
function saidBy(families: readonly Family[]): Said[] {
  const out = new Map<string, Said>();
  for (const f of families) {
    const s = f.situation;
    const names = [
      ...f.members.map((m) => m.name),
      ...(s?.olderKids ?? []).map((k) => k.name ?? ""),
      f.city,
      f.previousCity ?? "",
      s?.satogaeriPlace?.city ?? "",
    ].filter((x) => x.trim());
    const lmp = lmpFromDue(f.dueDate);
    const days = [addDays(lmp, -10), addDays(lmp, 70), f.dueDate, secondBirthday(f)];
    if (f.movedOn) days.push(addDays(f.movedOn, -1), f.movedOn);
    if (f.birthDate) days.push(addDays(f.birthDate, -1), f.birthDate, addDays(f.birthDate, 400));
    for (const day of days)
      for (const m of scheduleFor(viewAt(f, day), day))
        for (const field of FIELDS) {
          const text = m[field];
          const key = `${f.id}|${field}|${text}`;
          if (!out.has(key)) out.set(key, { family: f.id, id: m.id, field, text, names });
        }
  }
  return [...out.values()];
}

/** 訳に日本語の言い方が残っていないか（中文・English）。残っていれば理由を返す */
function leftover(x: Said, lang: "zh" | "en"): string | null {
  const out = withLang(lang, () => msWords(x.text), DICTS[lang]);
  const where = `${x.family} ${x.id} ${x.field} ${lang}「${x.text}」→「${out}」`;
  if (out === x.text) return `${where}: 訳が無い`;
  if (/[{}]/.test(out)) return `${where}: 差し込みが残る`;
  // 差し込んだ呼び名・町の名前と、括弧で並べた日本語（窓口で使う言葉）を除いて、かなが残らない
  let rest = out;
  for (const n of [...x.names].sort((a, b) => b.length - a.length)) rest = rest.split(n).join("");
  rest = rest.replace(/（[^）]*）|\([^)]*\)/g, "");
  return /[ぁ-んァ-ヶ]/.test(rest) ? `${where}: かなが残る` : null;
}

function check(said: readonly Said[]) {
  const bad = said.flatMap((x) => (["zh", "en"] as const).map((lang) => leftover(x, lang)).filter((b): b is string => !!b));
  expect(bad).toEqual([]);
  // 日本語の画面は1字も変えない
  expect(said.filter((x) => withLang("ja", () => msWords(x.text)) !== x.text).map((x) => x.text)).toEqual([]);
}

const zh = (s: string) => withLang("zh", () => msWords(s), DICTS.zh);
const en = (s: string) => withLang("en", () => msWords(s), DICTS.en);

describe("予定の言葉（msWords）", () => {
  it("MILESTONES のすべての見出し・一言・正式な言い方に、中文と English がある", () => {
    const missing = MILESTONES.flatMap((m) =>
      FIELDS.flatMap((field) => (["zh", "en"] as const).filter((lang) => !DICTS[lang][m[field]]).map((lang) => `${m.id} ${field} ${lang}「${m[field]}」`)),
    );
    expect(missing).toEqual([]);
  });

  it("作った30家族と見本の家族: 1000日に出る予定の言葉が、中文・English で訳に残らず届く", () => {
    const said = saidBy([...SIM_FAMILIES, DEMO_FAMILY]);
    // 家族の形で変わる言い方（名前・人数・町・上の子）も、30家族の中に入っている
    expect(said.some((x) => x.text === "翔太の育休を職場に伝える")).toBe(true);
    expect(said.some((x) => /（\d+人分）$/.test(x.text))).toBe(true);
    expect(said.some((x) => x.id.startsWith("older"))).toBe(true);
    expect(said.some((x) => /本籍地で出せる$/.test(x.text))).toBe(true);
    check(said);
  });

  it("作った1000組（現実の割合から）でも、言い方の取りこぼしが無い", () => {
    check(saidBy(getPopulation()));
  }, 60_000);

  it("30家族に無い家族の形（三つ子・ひとり親・公務員・国保・里帰りの町・上の子の呼び名・早く生まれた・小さく生まれた・引っ越し）", () => {
    const due = "2027-05-10";
    const lmp = lmpFromDue(due);
    const both: Member[] = [
      { id: "m", name: "美咲", role: "母" },
      { id: "p", name: "ゆきの", role: "パートナー" },
    ];
    const fam = (id: string, situation: Situation, more: Partial<Family> = {}): Family => ({
      id,
      city: "さいたま市",
      prefecture: "埼玉県",
      dueDate: due,
      birthDate: "2027-05-08",
      members: both,
      situation,
      ...more,
    });
    const work: Situation = { motherWork: "会社員・公務員", partnerWork: "会社員・公務員", partnerLeave: "取る" };
    const families: Family[] = [
      // 三つ子（人数の言い方）と、里帰りの町がわからない時
      fam("triplets", { ...work, babies: 3, satogaeri: true }),
      // 双子で、出産で辞める（双子の産休の一言）
      fam("twins-quit", { motherWork: "出産で辞める", partnerWork: "会社員・公務員", babies: 2 }),
      // ひとり親・公務員
      fam("single", { motherWork: "会社員・公務員", publicServant: true }, { members: [{ id: "m", name: "美咲", role: "母" }] }),
      // 自営どうし（国保の赤ちゃん・国民年金の免除）
      fam("kokuho", { motherWork: "自営・フリー", partnerWork: "自営・フリー" }),
      // 里帰り: ほかの県の町・同じ県の町・同じ市
      fam("satogaeri-far", { ...work, satogaeri: true, satogaeriPlace: { prefecture: "鹿児島県", city: "霧島市" }, satogaeriBack: "産後2か月ごろ" }),
      fam("satogaeri-near", { ...work, satogaeri: true, satogaeriPlace: { prefecture: "埼玉県", city: "川越市" } }),
      fam("satogaeri-home", { ...work, satogaeri: true, satogaeriPlace: { prefecture: "埼玉県", city: "さいたま市" } }),
      // パートナーの育休が14日に届かない・1歳を過ぎて戻る（2回目の延長）・呼び名が長い（「パートナー」のまま）
      fam(
        "leave-short",
        { ...work, partnerLeaveLen: "14日未満", returnAt: "1歳を過ぎて" },
        {
          members: [
            { id: "m", name: "美咲", role: "母" },
            { id: "p", name: "アレクサンドラ", role: "パートナー" },
          ],
        },
      ),
      // 3週間早く、小さく生まれた（早める申し出・養育医療）。体重は出産の記録の代わりにここで渡す
      fam("early-small", { ...work }, { birthDate: "2027-04-19" }),
      // 生まれた後に引っ越した
      fam("moved-after", { ...work }, { previousCity: "横浜市", previousPrefecture: "神奈川県", movedOn: "2027-08-01" }),
      // 上の子3人: 呼び名に「の」が入る子・年月だけの子・呼び名の無い子（上の子3）。最終月経のすぐ前に生まれた子で、生後すぐの健診・接種の言い方も引く
      fam("older", {
        ...work,
        olderChildren: true,
        olderKids: [
          { birthDate: addDays(lmp, -15), name: "このは" },
          { birthDate: "2025-03-01", monthOnly: true, care: "保育園" },
          { birthDate: addDays(lmp, -40) },
        ],
      }),
      // 上の子1人（呼び名なし＝「上の子」）
      fam("older-one", { ...work, olderChildren: true, olderKids: [{ birthDate: "2024-07-20", care: "幼稚園" }] }),
    ];
    const said = saidBy(families);
    // 小さく生まれた子の届けは、出産の記録の体重で出る（ここでは体重を直に渡して引く）
    const small = scheduleFor({ ...families[8], birthWeightG: 1800, birthWeek: 32 }, "2027-04-20");
    for (const m of small) for (const field of FIELDS) said.push({ family: "early-small", id: m.id, field, text: m[field], names: ["美咲", "ゆきの"] });
    expect(small.some((m) => m.id === "preterm-medical")).toBe(true);
    // 作った家族の形が、ねらった言い方を出している
    for (const text of [
      "出生届を出す（3人分）",
      "予定日の8週前から。里帰り中の受け方は町に聞く",
      "産休（双子などは14週前から）の前か後かで、受け取れるお金が変わります",
      "出産後1年まで。町の家事の手伝いも",
      "公務員は勤め先に申請。15日以内に",
      "国保は役所に14日以内。出生届と同じ日に",
      "14日以内。さいたま市・霧島市・本籍地で出せる",
      "県の中は受診券が使える事が多い。使えなかった分だけ",
      "パートナーの育休の日数を決める",
      "ゆきのの育休の始まりを早める",
      "予定日から8週を過ぎてから。勤め先がハローワークへ",
      "このはの1か月健診",
      "上の子3の予防接種を始める",
      "上の子3のBCG ",
      "上の子の3歳児健診",
    ])
      expect(said.map((x) => x.text), text).toContain(text);
    expect(said.some((x) => x.text.endsWith("（月の1日で数えた目安）"))).toBe(true);
    check(said);
  });

  it("差し込みの言い方（名前・人数・町・上の子）は、形を見て差し込みの鍵で引く", () => {
    expect(zh("翔太の育休を職場に伝える")).toBe("向工作单位提出翔太的育儿休假");
    expect(en("ゆきのの育休の始まりを早める")).toBe("Move up the start of ゆきの's childcare leave");
    expect(zh("出生届を出す（2人分）")).toBe("提交出生登记（出生届）（2人份）");
    expect(en("出生届を出す（2人分）")).toBe("Submit the birth registration (出生届) (for 2 babies)");
    expect(en("予定日の8週前から。3人分（1人5万円の目安）")).toBe("From 8 weeks before the due date. For 3 babies (about 50,000 yen each)");
    expect(zh("14日以内。江東区・霧島市・本籍地で出せる")).toBe("14天以内。可以在江東区、霧島市或户籍所在地（本籍地）提交");
    expect(zh("上の子2の3歳児健診")).toBe("大孩子2：3岁儿童健康检查");
    expect(en("上の子のBCG ")).toBe("Older child: BCG vaccine");
    expect(en("上の子（2024年12月生まれ）の3歳児健診")).toBe("Older child (born 12/2024): 3-year-old checkup");
    expect(en("もう受けていたら「済んだ」を押してください（月の1日で数えた目安）")).toBe('If it\'s already done, tap "Done" (estimated from the 1st of the month)');
    // 訳の無い言葉は、どの言葉でも日本語のまま（消えない）
    expect(en("辞書に無い予定")).toBe("辞書に無い予定");
    expect(withLang("ja", () => msWords("翔太の育休を職場に伝える"))).toBe("翔太の育休を職場に伝える");
  });
});

describe("お金が届いたか確かめる（lib/money.ts の paidDef）", () => {
  it("7つの手続きの見出し・一言・ヒントを、中文・English の形で引く（日本語は1字も変えない）", async () => {
    const { MONEY, paidDef } = await import("../money");
    const { withLang } = await import(".");
    const { DICTS } = await import("./dicts");
    for (const id of Object.keys(MONEY)) {
      const d = paidDef(id)!;
      for (const s of [d.title, d.plain, d.hint!]) {
        expect(withLang("ja", () => msWords(s), DICTS.ja)).toBe(s);
        for (const l of ["zh", "en"] as const) {
          const out = withLang(l, () => msWords(s), DICTS[l]);
          // 括弧の中の日本語（窓口の言葉）と「児童手当」（いまの辞書の訳）のほかに、日本語の文が残らない
          expect(out.replace(/（[^）]*）|\([^)]*\)/g, "").replace("児童手当", ""), `${l}: ${s}`).not.toMatch(/[ぁ-んァ-ヶ]/);
        }
      }
    }
    const child = paidDef("child-allowance")!;
    expect(withLang("en", () => msWords(child.title), DICTS.en)).toBe(
      "Check whether the first child allowance payment (児童手当) has arrived (if it's past the expected time, check with your city office)",
    );
    expect(withLang("zh", () => msWords(child.hint!), DICTS.zh)).toBe("到账了就点“完成了”。还没到的话，问市区町村的窗口");
  });
});
