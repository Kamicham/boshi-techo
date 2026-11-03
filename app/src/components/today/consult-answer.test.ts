import { describe, expect, it } from "vitest";
import type { TechoEntry } from "@/lib/techo";
import { answerOf, consultAnswerFor, consultValues, needsBridge, type ConsultAnswer } from "./consult-answer";

const period = { from: "2027-05-26", to: "2027-07-25" };
const e = (date: string, values: TechoEntry["values"], who?: string, extra: Partial<TechoEntry> = {}): TechoEntry => ({
  page: "consult",
  date,
  title: "相談できる人",
  values,
  who,
  source: "text",
  ...extra,
});

describe("相談できる人の答え", () => {
  it("4つの答えは、保存して読み戻すと同じ答えになる", () => {
    for (const a of ["yes", "hard", "no", "skip"] as ConsultAnswer[]) expect(answerOf(consultValues(a))).toBe(a);
  });

  it("答えた人ごとに見る: 母が答えても、パートナーにはまだ聞く", () => {
    const list = [e("2027-06-01", consultValues("yes"), "美咲")];
    expect(consultAnswerFor(list, period, "美咲")).toBe("yes");
    expect(consultAnswerFor(list, period, "翔太")).toBeNull();
  });

  it("その時期の外の答えは数えない", () => {
    const list = [e("2027-05-01", consultValues("no"), "美咲")];
    expect(consultAnswerFor(list, period, "美咲")).toBeNull();
  });

  it("「今は答えない」はその時期は聞かない印で、頼れる所は出さない", () => {
    const a = consultAnswerFor([e("2027-06-01", consultValues("skip"), "翔太")], period, "翔太");
    expect(a).toBe("skip");
    expect(needsBridge(a)).toBe(false);
  });

  it("いない・頼みにくいの間は、頼れる所を出し続ける", () => {
    expect(needsBridge(consultAnswerFor([e("2027-06-01", consultValues("hard"), "美咲")], period, "美咲"))).toBe(true);
    expect(needsBridge(consultAnswerFor([e("2027-06-01", consultValues("no"), "美咲")], period, "美咲"))).toBe(true);
  });

  it("あとで「いる」と答え直したら、頼れる所は引っ込む", () => {
    const list = [e("2027-06-01", consultValues("no"), "美咲"), e("2027-06-20", consultValues("yes"), "美咲")];
    expect(consultAnswerFor(list, period, "美咲")).toBe("yes");
  });

  it("who の無い古い記録は、誰の答えとしても数える（二度聞かない）", () => {
    const list = [e("2027-06-01", { has: true })];
    expect(consultAnswerFor(list, period, "翔太")).toBe("yes");
  });

  it("今の人が分からない時は、誰の答えでも数える", () => {
    expect(consultAnswerFor([e("2027-06-01", consultValues("no"), "美咲")], period, undefined)).toBe("no");
  });

  it("OK 待ちの候補と、ほかのページの記録は答えではない", () => {
    const list = [e("2027-06-01", consultValues("yes"), "美咲", { pending: true }), { ...e("2027-06-01", { text: "眠れない" }, "美咲"), page: "feeling" as const }];
    expect(consultAnswerFor(list, period, "美咲")).toBeNull();
  });

  it("話して残した「保健師さんに相談した」は、相談できる人がいる側", () => {
    expect(answerOf({ whom: "保健師さん", text: "授乳の事" })).toBe("yes");
  });
});
