// 「済んだ」の意味の一言と、家族の間のありがとう（lib/done-words.ts）の試験。作った家族だけ（Claude は呼ばない）。
import { describe, expect, it } from "vitest";
import { addDays } from "./clock";
import { DEMO_FAMILY } from "./demo-family";
import { DONE_WORD_IDS, doneWords, familyNewsFor, NEWS_DAYS, THANKS_DAYS, thanksLog } from "./done-words";
import { MILESTONES } from "./milestones";

const [misaki, shota] = DEMO_FAMILY.members;
const today = "2027-04-30";

describe("意味の一言", () => {
  it("どの一言も、予定表に有る事に付き、事実だけ（体の判断・役の呼び名・急かす言葉を使わない）", () => {
    const ids = new Set(MILESTONES.map((m) => m.id));
    expect(DONE_WORD_IDS.length).toBeGreaterThanOrEqual(10);
    for (const id of DONE_WORD_IDS) {
      expect(ids.has(id), id).toBe(true);
      const w = doneWords(id, "ひなた")!;
      expect(w.length, id).toBeLessThanOrEqual(30);
      expect(w, id).not.toMatch(/ママ|パパ|異常|正常|順調|発達|体重|大丈夫|急いで|損|もらえません|必ず/);
    }
    expect(doneWords("birth-registration", "ひなた")).toBe("ひなたの名前が、戸籍にのります");
    expect(doneWords("birth-registration")).toBe("赤ちゃんの名前が、戸籍にのります");
    expect(doneWords("no-such")).toBeNull();
  });
});

describe("家族から（今日の画面）", () => {
  const base = { doneBy: { "birth-registration": shota.id }, doneOn: { "birth-registration": "2027-04-28" } };

  it("ほかの家族が7日の間に済ませた事だけ。自分が済ませた事・11/5 より前の記録（誰か分からない）・7日より前は出さない", () => {
    const n = familyNewsFor(DEMO_FAMILY, misaki, today, base);
    expect(n.done).toEqual([{ id: "birth-registration", by: shota, on: "2027-04-28", thanked: false }]);
    expect(familyNewsFor(DEMO_FAMILY, shota, today, base).done).toEqual([]);
    expect(familyNewsFor(DEMO_FAMILY, misaki, today, { doneOn: base.doneOn }).done).toEqual([]);
    expect(familyNewsFor(DEMO_FAMILY, misaki, addDays("2027-04-28", NEWS_DAYS), base).done).toEqual([]);
    expect(familyNewsFor(DEMO_FAMILY, misaki, addDays("2027-04-28", NEWS_DAYS - 1), base).done).toHaveLength(1);
    // 時計を戻した家族: 済ませた日より前の「今日」には出さない
    expect(familyNewsFor(DEMO_FAMILY, misaki, "2027-04-27", base).done).toEqual([]);
  });

  it("送ったありがとうは印になり、届いた人には3日の間「〇〇から ありがとう」", () => {
    const thanks = { "birth-registration": { by: misaki.id, today: "2027-04-30", at: "2026-11-05T00:00:00.000Z" } };
    expect(familyNewsFor(DEMO_FAMILY, misaki, today, { ...base, thanks }).done[0].thanked).toBe(true);
    const got = familyNewsFor(DEMO_FAMILY, shota, today, { ...base, thanks });
    expect(got.thanks).toEqual([{ id: "birth-registration", from: misaki, on: "2027-04-30" }]);
    expect(familyNewsFor(DEMO_FAMILY, shota, addDays(today, THANKS_DAYS), { ...base, thanks }).thanks).toEqual([]);
    // 自分が済ませていない事のありがとうは、自分には届かない
    expect(familyNewsFor(DEMO_FAMILY, misaki, today, { ...base, thanks }).thanks).toEqual([]);
  });

  it("家族が1人の手帳・使う人が分からない時は、何も出さない", () => {
    const one = { ...DEMO_FAMILY, members: [misaki] };
    expect(familyNewsFor(one, misaki, today, base)).toEqual({ done: [], thanks: [] });
    expect(familyNewsFor(DEMO_FAMILY, null, today, base)).toEqual({ done: [], thanks: [] });
  });
});

describe("家族のありがとう（一冊・映画の終わり）", () => {
  it("誰から誰へを古い順に。家族の外の人・自分へ・画面の「今日」より後の物は入れない", () => {
    const r = {
      doneBy: { "birth-registration": shota.id, "health-insurance": shota.id, "child-allowance": misaki.id, "birth-notice": shota.id },
      thanks: {
        "health-insurance": { by: misaki.id, today: "2027-05-02", at: "x" },
        "birth-registration": { by: misaki.id, today: "2027-04-28", at: "x" },
        "child-allowance": { by: misaki.id, today: "2027-04-29", at: "x" }, // 自分へ
        "birth-notice": { by: "someone", today: "2027-04-29", at: "x" }, // 家族の外
      },
    };
    const log = thanksLog(DEMO_FAMILY, "2027-05-01", r);
    expect(log.map((x) => [x.id, x.from.name, x.to.name, x.on])).toEqual([["birth-registration", "美咲", "翔太", "2027-04-28"]]);
    expect(thanksLog(DEMO_FAMILY, "2027-05-02", r).map((x) => x.id)).toEqual(["birth-registration", "health-insurance"]);
    expect(thanksLog(DEMO_FAMILY, "2027-05-02", {})).toEqual([]);
  });
});
