// 手帳が先回りした跡（UX の見直し C07・2026-11-05）: 一番上の札の「✓ …を下書きしました（あと◯だけ）」の言い方と、
// 開いた時に手帳が先に用意する事の選び方（一番上を含めて3件まで・14日以内・自分か家族の番）を、30家族の1000日で確かめる。
// Claude は呼ばない。
import { describe, expect, it, vi } from "vitest";
import { addDays, diffDays } from "@/lib/clock";
import { scheduleFor, statusOf } from "@/lib/milestones";
import { SIM_FAMILIES } from "@/sim/families";
import { PREP_DAYS, PREP_MAX, SAMPLE_MARK, blankNote, canLocalFor, isSample, madeLine, prepAhead, prepNoteOf } from "./prep";
import { NOW, isMine, isStale, planToday, withAssignee, type Task } from "./task";

vi.mock("server-only", () => ({}));

describe("手帳が用意した事の言い方", () => {
  it("見本の答えの札は、サーバの札（lib/samples.ts）と同じ。見本の答えは、用意した物に数えない", async () => {
    const { SAMPLE_MARK: server } = await import("@/lib/samples");
    expect(SAMPLE_MARK).toBe(server);
    expect(isSample({ title: `${server}出生届の書く事` })).toBe(true);
    expect(isSample({ title: "出生届の書く事" })).toBe(false);
    expect(isSample(null)).toBe(false);
  });

  it("下書きの行: メールと頼み文は「下書きしました」、メモと一覧は「作りました」。残る空欄は1つなら名前、2つ以上は数で", () => {
    expect(madeLine("職場へのメール", "メール", ["上司の名前"])).toBe("職場へのメールを下書きしました（あと上司の名前だけ）");
    expect(madeLine("家族への頼み文", "頼み文", [])).toBe("家族への頼み文を下書きしました");
    expect(madeLine("書く事のメモ", "記入メモ", [])).toBe("書く事のメモを作りました");
    expect(madeLine("聞く事の一覧", "質問リスト", ["a", "b"])).toBe("聞く事の一覧を作りました（空欄あと2つ）");
    expect(blankNote([])).toBe("");
    // 名前の無い【 】は、その行の文が名前になるので、長い時は数で言う
    expect(blankNote(["生まれた日に会社へ連絡する時の担当の方のお名前"])).toBe("（空欄あと1つ）");
    expect(blankNote(["上司のメールアドレス"])).toBe("（あと上司のメールアドレスだけ）");
  });

  it("帯の下の1行: 用意した物の数と、いちばん新しい日。何も無ければ出さない", () => {
    expect(prepNoteOf(["a", "b"], {})).toBeNull();
    expect(
      prepNoteOf(["a", "b", "c"], {
        a: { local: { on: "2027-04-27" } },
        b: { draft: { kind: "メール", on: "2027-04-28", blanks: [] }, local: { on: "2027-04-20" } },
        z: { draft: { kind: "メール", on: "2027-05-01", blanks: [] } },
      }),
    ).toEqual({ on: "2027-04-28", local: ["a", "b"], draft: ["b"] });
  });

  it("窓口を先に調べるのは、役所に出す手続きだけ（産院・職場に出す物と、町の分からない家族は調べない）", () => {
    const t = { needsLocal: true, kind: "手続き", title: "出生届を出す", plain: "出生届を出す" } as const;
    expect(canLocalFor(t, { city: "さいたま市" })).toBe(true);
    expect(canLocalFor(t, { city: "" })).toBe(false);
    expect(canLocalFor({ ...t, title: "直接支払制度を産院で申し込む" }, { city: "さいたま市" })).toBe(false);
    expect(canLocalFor({ ...t, kind: "仕事" }, { city: "さいたま市" })).toBe(false);
    expect(canLocalFor({ ...t, needsLocal: false }, { city: "さいたま市" })).toBe(false);
  });
});

describe("開いた時に手帳が先に用意する事（30家族の1000日）", () => {
  it("一番上を含めて3件まで。14日以内に始まる事で、自分か家族の番の事だけ。畳んだ事は入れない。一番上が用意できる事なら先頭", () => {
    let days = 0;
    let full = 0;
    let skippedOthers = 0;
    for (const f of SIM_FAMILIES) {
      const birth = f.birthDate ?? f.dueDate;
      const can = (t: Task) => canLocalFor(t, f) || t.kind === "仕事" || t.kind === "手続き";
      for (let day = addDays(f.dueDate, -270); day <= addDays(birth, 730); day = addDays(day, 7)) {
        const tasks = scheduleFor(f, day).map((m) => withAssignee({ ...m, status: statusOf(m, day, new Set()) }, f, undefined));
        for (const me of f.members) {
          const plan = planToday(tasks, day, me);
          const ahead = prepAhead(tasks, day, me, plan.top, can);
          days++;
          if (ahead.length === PREP_MAX) full++;
          const at = `${f.id} ${day} ${me.role}`;
          expect(ahead.length, at).toBeLessThanOrEqual(PREP_MAX);
          expect(new Set(ahead.map((t) => t.id)).size, at).toBe(ahead.length);
          for (const t of ahead) {
            expect(isMine(t, me), `${at} ${t.id}`).toBe(true);
            expect(isStale(t, day), `${at} ${t.id}`).toBe(false);
            expect(can(t), `${at} ${t.id}`).toBe(true);
            const near = NOW.has(t.status) || (t.status === "まだ先" && !t.awaitingBirth && !t.awaitingPregnancy && diffDays(t.startDate, day) <= PREP_DAYS);
            expect(near, `${at} ${t.id} ${t.status} ${t.startDate}`).toBe(true);
          }
          const top = plan.top;
          if (top && can(top) && isMine(top, me) && !isStale(top, day)) expect(ahead[0]?.id, at).toBe(top.id);
          // ほかの人の番の今やる事は、先に書かない
          skippedOthers += tasks.filter((t) => NOW.has(t.status) && !isMine(t, me) && can(t)).length;
        }
      }
    }
    expect(days).toBeGreaterThan(5000);
    expect(full).toBeGreaterThan(100);
    expect(skippedOthers).toBeGreaterThan(0);
  });
});
