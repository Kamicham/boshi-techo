// 思い出の早送り: 作った30家族の1000日を毎日たどり、節目の写真の一言（MilestoneDay・BirthdayCard のもとの memoryNudgeFor）と
// 妊娠中の思い出の誘い（BumpMoment の bumpMomentFor）が
// - 静かにする（つらい別れ・赤ちゃんの入院）を選んだ家族には、1日も出ない
// - 選んでいない家族には、生まれる前は妊娠中の節目（12・16・20・28・30週）だけ、生まれた後は節目（お七夜〜2歳の7つ）でだけ出る
// を確かめる。30家族はそのまま・loss にした写し・nicu にした写しの3通りで通す（作った家族だけ。Claude は呼ばない）。
import { describe, expect, it } from "vitest";
import { addDays, addMonths, clockAt, diffDays, lmpFromDue, secondBirthday } from "../lib/clock";
import { letterOpenOn, recentlyOpened, schoolEntry } from "../lib/letters-shared";
import {
  birthdayFor,
  birthNewsText,
  BORN_PROMPT_WEEK,
  bornPromptFor,
  BUMP_MOMENTS,
  bumpMomentFor,
  celebrationFor,
  groupForAlbum,
  memoryNudgeFor,
  milestoneSay,
  PHOTO_MILESTONES,
  welcomeFor,
  type BumpSeen,
  type ClientMedia,
} from "../lib/media-shared";
import { scheduleFor } from "../lib/milestones";
import { registrationLine } from "../components/today/welcome";
import type { Quiet } from "../lib/situation";
import { SIM_FAMILIES } from "./families";

function days(f: { dueDate: string; birthDate?: string }): string[] {
  const start = lmpFromDue(f.dueDate);
  const end = addDays(secondBirthday(f as Parameters<typeof secondBirthday>[0]), 30);
  const n = diffDays(end, start);
  return Array.from({ length: n + 1 }, (_, i) => addDays(start, i));
}

describe("思い出の一言（節目の写真）と妊娠中の誘い", () => {
  const ALL = BUMP_MOMENTS.map((m) => m.id);

  it("30家族: 生まれる前は妊娠中の節目だけ、生まれた後は節目の日だけ出る。妊娠中の誘いは月に1回まで・閉じたら二度と出ない・37週から出ない", () => {
    let shown = 0;
    let bumps = 0;
    for (const f of SIM_FAMILIES) {
      // 出た日に閉じる家族としてたどる（BumpMoment がこの端末に覚える形）
      const seen: BumpSeen = { ids: [] };
      const months = new Set<string>();
      for (const d of days(f)) {
        const m = memoryNudgeFor(f, d);
        if (m) {
          shown++;
          expect(f.birthDate && d >= f.birthDate, `${f.id} ${d} 生まれる前に節目の写真が出た`).toBe(true);
          expect(PHOTO_MILESTONES.some((x) => x.id === m.id)).toBe(true);
        }
        const b = bumpMomentFor(f, d, seen);
        if (!b) continue;
        bumps++;
        const c = clockAt(f, d);
        expect(c.phase, `${f.id} ${d} ${b.id} 妊娠中の外で出た`).toBe("pregnant");
        expect(c.pregnancyWeek! >= b.week && c.pregnancyWeek! < BORN_PROMPT_WEEK, `${f.id} ${d} ${b.id} ${c.pregnancyWeek}週`).toBe(true);
        expect(m).toBeNull();
        expect(bornPromptFor(f, d), `${f.id} ${d} 「生まれたら、ここから」と重なった`).toBe(false);
        expect(months.has(d.slice(0, 7)), `${f.id} ${d} ${b.id} 同じ月に2回`).toBe(false);
        expect(seen.ids, `${f.id} ${d} ${b.id} 閉じたのにまた出た`).not.toContain(b.id);
        months.add(d.slice(0, 7));
        seen.ids.push(b.id);
        seen.month = d.slice(0, 7);
      }
      // 出会う順は週の順。37週の後に生まれた家族（生まれた日の無い家族も）は、5つ全部に出会う
      expect(seen.ids, f.id).toEqual(ALL.slice(0, seen.ids.length));
      const bornWeek = f.birthDate ? Math.floor(diffDays(f.birthDate, lmpFromDue(f.dueDate)) / 7) : 99;
      if (bornWeek >= BORN_PROMPT_WEEK) expect(seen.ids, `${f.id} ${bornWeek}週で生まれた`).toEqual(ALL);
    }
    expect(shown).toBeGreaterThan(0);
    expect(bumps).toBeGreaterThan(0);
  });

  it("閉じない家族: 誘いはその週の間ずっと同じ1つ（12週から37週の前の日まで）。妊娠の届出を済ませた日からは、12週より前でもエコーの写真", () => {
    const f = SIM_FAMILIES.find((x) => x.birthDate && diffDays(x.birthDate, lmpFromDue(x.dueDate)) >= BORN_PROMPT_WEEK * 7 && !x.situation?.quiet)!;
    const lmp = lmpFromDue(f.dueDate);
    const at = (w: number, d = 0) => bumpMomentFor(f, addDays(lmp, w * 7 + d), { ids: [] })?.id ?? null;
    expect([at(11, 6), at(12), at(15, 6), at(16), at(19, 6), at(20), at(27, 6), at(28), at(29, 6), at(30), at(36, 6), at(37)]).toEqual([
      null, "echo", "echo", "inu", "inu", "belly", "belly", "name", "name", "letter", "letter", null,
    ]);
    const reported = addDays(lmp, 8 * 7);
    expect(bumpMomentFor(f, addDays(reported, -1), { ids: [] }, reported)).toBeNull();
    expect(bumpMomentFor(f, reported, { ids: [] }, reported)?.id).toBe("echo");
    expect(bumpMomentFor(f, addDays(lmp, 16 * 7), { ids: [] }, reported)?.id).toBe("inu");
    // 同じ月に閉じていたら、その月は出さない（次の月に出す）
    const d = addDays(lmp, 20 * 7);
    expect(bumpMomentFor(f, d, { ids: ["echo", "inu"], month: d.slice(0, 7) })).toBeNull();
    expect(bumpMomentFor(f, d, { ids: ["echo", "inu"], month: "2000-01" })?.id).toBe("belly");
  });

  it("誘いの言葉は残す事だけ（体の判断・赤ちゃんの様子・役の呼び名を言わない）", () => {
    for (const m of BUMP_MOMENTS) {
      for (const t of [m.say, m.note ?? "", m.action]) expect(t, m.id).not.toMatch(/ママ|パパ|異常|正常|順調|発達|体重|大丈夫|心配|聞こえ|成長|元気/);
    }
  });

  for (const quiet of ["loss", "nicu"] as Quiet[]) {
    it(`静かにする（${quiet}）を選んだ30家族の写し: 1000日のどの日にも出ない（節目の写真も、妊娠中の誘いも）`, () => {
      for (const f0 of SIM_FAMILIES) {
        const f = { ...f0, situation: { ...f0.situation, quiet } };
        for (const d of days(f)) {
          expect(memoryNudgeFor(f, d), `${f.id} ${d}`).toBeNull();
          expect(bumpMomentFor(f, d, { ids: [] }, lmpFromDue(f.dueDate)), `${f.id} ${d}`).toBeNull();
        }
      }
    });
  }
});

describe("1歳・2歳の誕生日の札（BirthdayCard と同じ birthdayFor）", () => {
  it("30家族: 1歳・2歳の誕生日から2週間だけ出る", () => {
    for (const f of SIM_FAMILIES) {
      for (const d of days(f)) {
        const age = birthdayFor(f, d);
        if (!age) continue;
        const since = diffDays(d, addMonths(f.birthDate!, age * 12));
        expect(since >= 0 && since <= 14, `${f.id} ${d}`).toBe(true);
      }
    }
  });

  for (const quiet of ["loss", "nicu"] as Quiet[]) {
    it(`静かにする（${quiet}）を選んだ30家族の写し: 「いつもの今日の画面」を開いても、どの日にも出ない`, () => {
      for (const f0 of SIM_FAMILIES) {
        const f = { ...f0, situation: { ...f0.situation, quiet } };
        for (const d of days(f)) expect(birthdayFor(f, d), `${f.id} ${d}`).toBeNull();
      }
    });
  }
});

// アルバムの月の見出し: 30家族の1000日に毎日1枚ずつ写真があるとして、同じ見出しが2回出ない・見出しの始まりの日はその月の写真より前
describe("アルバムの月の見出し（30家族）", () => {
  it("1000日のどこでも、見出しが重ならず、（）の始まりの日がその月の写真の日より後にならない", () => {
    for (const f of SIM_FAMILIES) {
      const xs = days(f).map((d, i) => ({ id: String(i), date: d, createdAt: `${d}T00:00:00Z`, star: 0, techoIds: [], hidden: false, trashedAt: null }) as unknown as ClientMedia);
      const months = groupForAlbum(f, xs).flatMap((p) => p.months);
      const labels = months.map((m) => m.label);
      expect(new Set(labels).size, `${f.id} 見出しが重なる ${labels.join("・")}`).toBe(labels.length);
      for (const m of months) {
        const [, y, mo, d] = /（(\d+)年(\d+)月(\d+)日〜）/.exec(m.label)!.map(Number);
        const from = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        expect(m.items.every((x) => x.date >= from), `${f.id} ${m.label}`).toBe(true);
      }
    }
  });
});

// 未来の手紙: 30家族それぞれで、開く日が筋の通った日になるか（生まれる前に開かない・小学校は6〜7歳の春・20歳の誕生日）。
// 開いた知らせ（LetterNews と同じ recentlyOpened）は、開く日から2週間だけで、1000日の中で何度も出ない

describe("未来の手紙（30家族）", () => {
  it("開く日: 1歳・小学校・10歳・20歳とも生まれた日より後。小学校は満6歳の次の4月1日", () => {
    for (const f of SIM_FAMILIES) {
      const birth = f.birthDate ?? f.dueDate;
      for (const o of ["1y", "school", "10y", "20y"] as const) {
        const on = letterOpenOn(o, f)!;
        expect(on > birth, `${f.id} ${o} ${on}`).toBe(true);
      }
      const s = schoolEntry(birth);
      const age = Number(s.slice(0, 4)) - Number(birth.slice(0, 4));
      expect(s.endsWith("-04-01") && (age === 6 || age === 7), `${f.id} ${birth} → ${s}`).toBe(true);
      expect(letterOpenOn("20y", f)!.slice(5)).toBe(birth.slice(5) === "02-29" ? "02-28" : birth.slice(5));
    }
  });

  it("1歳の手紙の知らせは、1000日の中で開いた日から2週間だけ出る", () => {
    for (const f of SIM_FAMILIES.filter((x) => x.birthDate)) {
      const on = letterOpenOn("1y", f)!;
      const shown = days(f).filter((d) => recentlyOpened({ openOn: on, opened: d >= on }, d));
      expect(shown.length, f.id).toBe(14);
      expect(shown[0]).toBe(on);
    }
  });
});

describe("「生まれました」の儀式（BornPrompt・WelcomeBaby と同じ bornPromptFor・welcomeFor）", () => {
  it("30家族: 「生まれたら、ここから」は37週0日から生まれた日の前の日まで。「ようこそ」は生まれた日から生後5日まで。2つとお七夜の一言は同じ日に出ない", () => {
    let prompts = 0;
    let welcomes = 0;
    for (const f of SIM_FAMILIES) {
      const lmp = lmpFromDue(f.dueDate);
      for (const d of days(f)) {
        const p = bornPromptFor(f, d);
        const w = welcomeFor(f, d);
        if (p) {
          prompts++;
          expect(diffDays(d, lmp) >= 37 * 7, `${f.id} ${d} 37週より前に出た`).toBe(true);
          expect(!f.birthDate || d < f.birthDate, `${f.id} ${d} 生まれた後に出た`).toBe(true);
        }
        if (w !== null) {
          welcomes++;
          expect(f.birthDate && diffDays(d, f.birthDate)).toBe(w);
          expect(w >= 0 && w <= 5, `${f.id} ${d}`).toBe(true);
          expect(p).toBe(false);
          expect(memoryNudgeFor(f, d)?.id, `${f.id} ${d}`).not.toBe("oshichiya");
        }
      }
      if (f.birthDate) expect(days(f).filter((d) => welcomeFor(f, d) !== null), f.id).toHaveLength(6);
    }
    expect(prompts).toBeGreaterThan(0);
    expect(welcomes).toBeGreaterThan(0);
  });

  for (const quiet of ["loss", "nicu"] as Quiet[]) {
    it(`静かにする（${quiet}）を選んだ30家族の写し: どちらも1日も出ない`, () => {
      for (const f0 of SIM_FAMILIES) {
        const f = { ...f0, situation: { ...f0.situation, quiet } };
        for (const d of days(f)) {
          expect(bornPromptFor(f, d), `${f.id} ${d}`).toBe(false);
          expect(welcomeFor(f, d), `${f.id} ${d}`).toBeNull();
        }
      }
    });
  }

  it("家族に知らせる文は、名前と生まれた日だけ（体重・時刻・体の様子を書かない）", () => {
    for (const f of SIM_FAMILIES.filter((x) => x.birthDate)) {
      const t = birthNewsText({ birthDate: f.birthDate!, childName: f.childName });
      const [, m, d] = f.birthDate!.split("-").map(Number);
      expect(t).toContain(`${m}月${d}日`);
      expect(t).toContain(f.childName ?? "赤ちゃん");
      expect(t).not.toMatch(/\d+\s*(g|グラム|kg|cm|時|分)|体重|身長|元気|母子ともに/);
    }
  });

  it("出生届の一言: 役の呼び名（ママ・パパ）を使わず期限の日を言い、産んだ人には休む事を先に。ひとりの家族には「ほかの家族でも」", () => {
    let pairs = 0;
    for (const f of SIM_FAMILIES.filter((x) => x.birthDate)) {
      const m = scheduleFor(f, f.birthDate!).find((x) => x.id === "birth-registration");
      expect(m, f.id).toBeTruthy();
      const mother = f.members.find((x) => x.role === "母") ?? null;
      const partner = f.members.find((x) => x.role === "パートナー") ?? null;
      const base = { ...m!, status: "今やる" as const };
      const lines = [registrationLine(f, mother, base), registrationLine(f, partner, base), registrationLine(f, mother, { ...base, together: true })];
      if (f.members.length < 2) expect(lines[0], f.id).toContain("ほかの家族でもできます");
      if (mother && partner) {
        pairs++;
        // 担当をまだ決めていない時（「家族」の事のまま）も、産んだ人には休む事を先に
        if (base.who === "家族") {
          expect(lines[0], f.id).toContain("あなたは、休む事を一番に");
          expect(lines[1], f.id).toContain(`${mother.name}が休めるように`);
        }
        const toPartner = { ...base, who: "パートナー" as const };
        const a = registrationLine(f, mother, toPartner);
        const b = registrationLine(f, partner, toPartner);
        expect(a).toContain(`${partner.name}の番`);
        expect(a).toContain("あなたは、休む事を一番に");
        expect(b).toContain("あなたの番");
        expect(b).toContain(`${mother.name}が休めるように`);
        lines.push(a, b);
      }
      for (const line of lines) {
        expect(line, f.id).not.toMatch(/ママ|パパ/);
        expect(line, f.id).toMatch(/まで/);
      }
      expect(registrationLine(f, mother, { ...base, status: "済み" })).toBe("出生届は済みました。");
    }
    expect(pairs).toBeGreaterThan(0);
  });
});

describe("節目の1枚（MilestoneDay と同じ celebrationFor）", () => {
  const FIVE = ["oshichiya", "omiyamairi", "okuizome", "half", "18m"];
  it("30家族: お七夜・お宮参り・お食い初め・ハーフ・1歳6か月のその日から2日の間だけ一番上に。「今日は」と言うのはその日だけ。1歳・2歳は誕生日の札", () => {
    for (const f of SIM_FAMILIES.filter((x) => x.birthDate)) {
      const seen = new Map<string, number>();
      for (const d of days(f)) {
        const c = celebrationFor(f, d);
        if (!c) continue;
        expect(FIVE, `${f.id} ${d}`).toContain(c.id);
        const off = diffDays(d, c.at(f.birthDate!));
        expect(off >= 0 && off <= 2, `${f.id} ${d} ${c.id}`).toBe(true);
        const say = milestoneSay(c, f.birthDate!, d);
        if (off > 0) expect(say, `${f.id} ${d}`).not.toMatch(/^今日/);
        if (off === 0 && c.id !== "omiyamairi") expect(say, `${f.id} ${d}`).toMatch(/^今日/);
        expect(birthdayFor(f, d), `${f.id} ${d}`).toBeNull();
        seen.set(c.id, (seen.get(c.id) ?? 0) + 1);
      }
      // 1000日の中に入る節目は、どれも3日ずつ
      for (const id of FIVE) {
        const at = PHOTO_MILESTONES.find((m) => m.id === id)!.at(f.birthDate!);
        if (addDays(at, 2) <= secondBirthday(f)) expect(seen.get(id), `${f.id} ${id}`).toBe(3);
      }
    }
  });

  it("お七夜とお食い初めは、上の帯（生まれた日を0日目に数える）と食い違わないよう、数え方を添える", () => {
    const f = SIM_FAMILIES.find((x) => x.birthDate)!;
    const o7 = PHOTO_MILESTONES.find((m) => m.id === "oshichiya")!;
    expect(clockAt(f, o7.at(f.birthDate!)).label).toBe("生後6日");
    expect(o7.note).toBe("生まれた日から数えて7日目");
    const o100 = PHOTO_MILESTONES.find((m) => m.id === "okuizome")!;
    expect(diffDays(o100.at(f.birthDate!), f.birthDate!)).toBe(99);
    expect(o100.note).toBe("生まれた日から数えて100日目");
  });

  for (const quiet of ["loss", "nicu"] as Quiet[]) {
    it(`静かにする（${quiet}）を選んだ30家族の写し: 1日も出ない`, () => {
      for (const f0 of SIM_FAMILIES) {
        const f = { ...f0, situation: { ...f0.situation, quiet } };
        for (const d of days(f)) expect(celebrationFor(f, d), `${f.id} ${d}`).toBeNull();
      }
    });
  }
});
