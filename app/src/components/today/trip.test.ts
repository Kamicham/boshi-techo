// 生まれた翌日の母の画面を軽く（UX の見直し C08・2026-11-05）。
// 30家族の生まれた日から15日を、届けの担当の3通り（決めていない・パートナー・母）で通し、今日の画面の上の方を確かめる。
// 画面（components/Techo.tsx）と同じ組み立て: scheduleFor → statusOf → withAssignee → planToday → planBirthTrip → tripScreen。Claude は呼ばない。
import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/clock";
import { BIRTH_TRIP_IDS, NUDGE_DAYS, planBirthTrip, tripScreen } from "@/lib/birth-trip";
import { scheduleFor, statusOf } from "@/lib/milestones";
import { SIM_FAMILIES } from "@/sim/families";
import { isMine, planToday, withAssignee } from "./task";
import { dueName, nudgeText, untilWords } from "./trip";

describe("生まれた届けの言い方", () => {
  it("期限は「あと12日・5/9（日）まで」の形。今日が期限なら「今日」", () => {
    expect(untilWords(12, "2027-05-09", "2027-04-27")).toBe("あと12日・5/9（日）まで");
    expect(untilWords(0, "2027-05-09", "2027-05-09")).toBe("今日・5/9（日）まで");
    expect(dueName({ id: "birth-registration", plain: "出生届を出す" })).toBe("出生届");
    expect(dueName({ id: "x", plain: "何かの届け" })).toBe("何かの届け");
  });

  it("声をかける文: 残りの数・期限の日・どこを見ればよいかだけ。急かす言い方と損の言い方はしない", () => {
    const t = nudgeText(3, { task: { id: "birth-registration", plain: "出生届を出す" }, date: "2027-05-14", left: 3 }, "2027-05-11");
    expect(t).toContain("残りの3件");
    expect(t).toContain("出生届は5/14（金）まで");
    expect(t).toContain("生まれた届けを、まとめて");
    expect(t).not.toMatch(/損|急いで|早く|もらえなく|パパ/);
    expect(nudgeText(1, { task: { id: "birth-registration", plain: "出生届を出す" }, date: "2027-05-14", left: 0 }, "2027-05-14")).toContain("出生届は今日まで");
  });
});

describe("生まれた日から15日の今日の画面（30家族・担当の3通り）", () => {
  it("束を開く画面は束の1件目が一番上・たたむのは届けをパートナーの番に決めた家族の母の画面だけ。出生届は1回だけ出て、母の一番上は母の事", () => {
    const n = { days: 0, full: 0, folded: 0, rest: 0, nudge: 0 };
    for (const f of SIM_FAMILIES) {
      if (!f.birthDate) continue;
      const mother = f.members.find((m) => m.role === "母");
      const partner = f.members.find((m) => m.role === "パートナー");
      const all = (id: string) => Object.fromEntries([...BIRTH_TRIP_IDS].map((x) => [x, id]));
      const ways: [string, Record<string, string> | undefined][] = [["決めていない", undefined]];
      if (partner) ways.push(["パートナー", all(partner.id)]);
      if (mother && partner) ways.push(["母", all(mother.id)]);
      for (const [way, assign] of ways) {
        // 何も済ませていない家族と、3日目に出生届を出した家族
        for (const early of [[], ["birth-registration"]]) {
          for (let d = 0; d <= 15; d++) {
            const day = addDays(f.birthDate, d);
            const done = new Set(d >= 3 ? early : []);
            const tasks = scheduleFor(f, day).map((m) => withAssignee({ ...m, status: statusOf(m, day, done) }, f, assign));
            const trip = planBirthTrip(tasks, day, f.birthDate, f.situation);
            for (const me of f.members) {
              const plan = planToday(tasks, day, me);
              const ts = tripScreen(trip, tasks, plan, me.role, !!partner, day);
              const at = `${f.id} ${way} ${early.join("") || "なし"} ${day} ${me.role}`;
              if (!trip) {
                expect(ts, at).toBeNull();
                continue;
              }
              n.days++;
              const open = trip.items.map((i) => i.task);
              const shown = [ts!.top, ...ts!.rest].filter((t) => !!t);
              // たたむのは、パートナーの番に決めた家族の母の画面で、パートナーの番の届けが束にある時だけ
              const wantFold = way === "パートナー" && me.role === "母" && open.some((t) => t.who === "パートナー");
              expect(!!ts!.fold, at).toBe(wantFold);
              // 出生届は1回だけ（束の中か、たたんだ1行の中。一番上の札と「このあと」に重ねない）。
              // 期限を過ぎた出生届は束から外れ、ふつうの1件（「このあと」かふり返り）が受け持つので数えない
              const reg = open.filter((t) => t.id === "birth-registration").length;
              const inFold = ts!.fold?.items.filter((t) => t.id === "birth-registration").length ?? 0;
              const regShown = shown.filter((t) => t.id === "birth-registration" && t.status !== "期限切れ").length;
              // 一番上は、使う人の事（「家族」を含む）か無し
              if (ts!.top) expect(isMine(ts!.top, me), `${at} ${ts!.top.id}`).toBe(true);
              if (ts!.full) {
                n.full++;
                // 束を開く画面の一番上は、束のうち自分の番の最初の届け（行く順の先頭が母の出生連絡票でも、パートナーの一番上にしない）
                expect(ts!.top?.id ?? null, at).toBe(open.find((t) => isMine(t, me))?.id ?? null);
                expect(ts!.rest.filter((t) => open.some((x) => x.id === t.id)).map((t) => t.id), at).toEqual([]);
              } else {
                const fold = ts!.fold!;
                n.folded++;
                if (!ts!.top) n.rest++;
                if (fold.nudge) n.nudge++;
                // 母の一番上は母の事（たたんだ届けではない）
                if (ts!.top) expect(isMine(ts!.top, me) && !fold.items.some((t) => t.id === ts!.top!.id), at).toBe(true);
                expect(fold.items.every((t) => t.who === "パートナー"), at).toBe(true);
                expect(ts!.rest.some((t) => fold.items.some((x) => x.id === t.id)), at).toBe(false);
                expect(inFold + regShown, at).toBe(reg);
                // 済んだ数と全部の数（その人の番の届け）
                const doneTheirs = tasks.filter((t) => BIRTH_TRIP_IDS.has(t.id) && t.who === "パートナー" && t.status === "済み").length;
                expect([fold.done, fold.total], at).toEqual([doneTheirs, doneTheirs + fold.items.length]);
                // 出生連絡票（母の番）は、たたまずに母の画面に出す
                if (open.some((t) => t.id === "birth-notice")) expect(shown.some((t) => t.id === "birth-notice"), at).toBe(true);
                // 法の期限まで5日を切ったら、声をかける文
                expect(fold.nudge, at).toBe(!!fold.due && fold.due.left >= 0 && fold.due.left < NUDGE_DAYS);
              }
            }
          }
        }
      }
    }
    expect(n.days).toBeGreaterThan(500);
    expect(n.full).toBeGreaterThan(200);
    expect(n.folded).toBeGreaterThan(50);
    expect(n.nudge).toBeGreaterThan(0);
  });
});
