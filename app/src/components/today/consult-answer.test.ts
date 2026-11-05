import { describe, expect, it } from "vitest";
import type { TechoEntry } from "@/lib/techo";
import { DEMO_FAMILY } from "@/lib/demo-family";
import { answerOf, CONSULT_FIRST_AFTER_BIRTH_DAYS, consultAnswerFor, consultPeriod, consultValues, needsBridge, type ConsultAnswer } from "./consult-answer";

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

describe("聞く区切り（家族の声①への直し A: 産後の最初の問いは生後14日から）", () => {
  // 見本の家族: 予定日 2027-05-10・生まれた日 2027-04-26
  const f = DEMO_FAMILY;
  it("生まれてから13日目までは聞かない（ようこそ・届けの束の日）", () => {
    expect(CONSULT_FIRST_AFTER_BIRTH_DAYS).toBe(14);
    for (const d of ["2027-04-26", "2027-04-27", "2027-05-06", "2027-05-09"]) expect(consultPeriod(f, d), d).toBeNull();
  });
  it("生後14日から1か月の前の日までが、産後の最初の区切り（府令様式の「2週間頃」）", () => {
    expect(consultPeriod(f, "2027-05-10")).toEqual({ key: "2w", label: "産後2週ごろ", from: "2027-05-10", to: "2027-05-25" });
    expect(consultPeriod(f, "2027-05-25")?.key).toBe("2w");
    expect(consultPeriod(f, "2027-05-26")).toEqual({ key: "1m", label: "1か月", from: "2027-05-26", to: "2027-07-25" });
  });
  it("妊娠中は8週から。2歳を過ぎたら聞かない", () => {
    expect(consultPeriod({ ...f, birthDate: undefined }, "2026-09-20")).toBeNull();
    expect(consultPeriod({ ...f, birthDate: undefined }, "2026-09-28")?.key).toBe("pregnancy");
    expect(consultPeriod(f, "2029-04-26")).toBeNull();
  });
});
