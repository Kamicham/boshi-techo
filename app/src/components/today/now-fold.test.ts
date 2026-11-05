// 「いま」の画面を静かにする（家族の声①への直し A）: ほかに今やる事の畳み方と、大きな札の日。
import { describe, expect, it } from "vitest";
import type { Member } from "../../lib/demo-family";
import { bigCardDay, foldNow, KEEP_DAYS, MINE_SHOWN, mustShow, type NowRow } from "./now-fold";
import type { Task } from "./task";

const today = "2027-04-27";
const mom: Member = { id: "misaki", name: "美咲", role: "母" };
const partner: Member = { id: "shota", name: "翔太", role: "パートナー" };
const task = (id: string, who: Task["who"], extra: Partial<Task> = {}): NowRow => ({
  kind: "task",
  task: { id, title: id, plain: id, hint: "", kind: "手続き", who, status: "今やる", startDate: "2027-04-20", deadlineDate: "2027-05-30", deadlineKind: "目安", basis: "", ...extra } as Task,
});
const ids = (rows: NowRow[]) => rows.map((r) => (r.kind === "task" ? r.task.id : r.kind));

describe("ほかに今やる事を畳む", () => {
  it("自分の番（「家族」の事を含む）は3行まで。残りは「ほかに◯件」", () => {
    const rows = [task("a", "母"), task("b", "家族"), task("c", "母"), task("d", "母"), task("e", "家族")];
    const f = foldNow(rows, mom, today);
    expect(MINE_SHOWN).toBe(3);
    expect(ids(f.shown)).toEqual(["a", "b", "c"]);
    expect(ids(f.more)).toEqual(["d", "e"]);
    expect(f.others).toEqual([]);
  });

  it("ほかの人の番は、人ごとに1行にまとめる（並びは元のまま）", () => {
    const rows: NowRow[] = [task("p1", "パートナー"), task("a", "母"), task("p2", "パートナー"), { kind: "visit" }];
    const f = foldNow(rows, mom, today);
    expect(ids(f.shown)).toEqual(["a", "visit"]);
    expect(f.others.map((g) => [g.who, ids(g.rows)])).toEqual([["パートナー", ["p1", "p2"]]]);
    // パートナーの画面では、母の事（健診の行も）が「美咲さんの番」の1行に入る
    const p = foldNow(rows, partner, today);
    expect(ids(p.shown)).toEqual(["p1", "p2"]);
    expect(p.others.map((g) => [g.who, ids(g.rows)])).toEqual([["母", ["a", "visit"]]]);
  });

  it("法で決まった期限まで1日以下（今日・明日・過ぎた）の行は、誰の番でも畳まない", () => {
    const law = (id: string, who: Task["who"], deadlineDate: string, status: Task["status"] = "期限が近い") => task(id, who, { deadlineDate, deadlineKind: "期限", status });
    expect(KEEP_DAYS).toBe(1);
    const rows = [task("a", "母"), task("b", "母"), task("c", "母"), law("tomorrow", "パートナー", "2027-04-28"), law("mine-today", "母", "2027-04-27"), law("late", "母", "2027-04-20", "期限切れ"), law("two-days", "パートナー", "2027-04-29")];
    const f = foldNow(rows, mom, today);
    expect(ids(f.shown)).toEqual(["a", "b", "c", "tomorrow", "mine-today", "late"]);
    // 2日先の法の期限は、ほかの人の番の1行へ
    expect(f.others.map((g) => ids(g.rows))).toEqual([["two-days"]]);
    // 目安の期限は、明日でも畳む
    expect(mustShow((task("x", "母", { deadlineDate: "2027-04-28", deadlineKind: "目安" }) as { task: Task }).task, today)).toBe(false);
  });

  it("畳まない法の期限の行も、自分の番の3行に数える", () => {
    const law = task("law", "母", { deadlineDate: "2027-04-27", deadlineKind: "期限", status: "期限が近い" });
    const f = foldNow([law, task("a", "母"), task("b", "母"), task("c", "母")], mom, today);
    expect(ids(f.shown)).toEqual(["law", "a", "b"]);
    expect(ids(f.more)).toEqual(["c"]);
  });

  it("健診と予約の行は母の事。使う人が決まっていない時は、全部を自分の番として数える", () => {
    const rows: NowRow[] = [{ kind: "visit" }, { kind: "prenatal" }, task("p", "パートナー")];
    expect(foldNow(rows, partner, today).others.map((g) => [g.who, ids(g.rows)])).toEqual([["母", ["visit", "prenatal"]]]);
    const f = foldNow([...rows, task("a", "母"), task("b", "母")], null, today);
    expect(ids(f.shown)).toEqual(["visit", "prenatal", "p"]);
    expect(ids(f.more)).toEqual(["a", "b"]);
    expect(f.others).toEqual([]);
  });

  it("畳んでも行は1つも消えない（開けば同じ並びで全部）", () => {
    const rows = [task("p1", "パートナー"), task("a", "母"), task("b", "家族"), task("c", "母"), task("d", "母"), task("p2", "パートナー")];
    const f = foldNow(rows, mom, today);
    expect([...f.shown, ...f.more, ...f.others.flatMap((g) => g.rows)].length).toBe(rows.length);
  });
});

describe("大きな札の日", () => {
  it("お祝い・届けの束・開いた手帳の気づきのどれかがある日", () => {
    expect(bigCardDay({ festive: true, tripShown: false, advisorOpen: 0 })).toBe(true);
    expect(bigCardDay({ festive: false, tripShown: true, advisorOpen: null })).toBe(true);
    expect(bigCardDay({ festive: false, tripShown: false, advisorOpen: 2 })).toBe(true);
    expect(bigCardDay({ festive: false, tripShown: false, advisorOpen: null })).toBe(false);
  });
});
