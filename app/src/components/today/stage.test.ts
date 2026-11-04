// 見本の時期の札（UX の見直し C36・2026-11-05）: 札の一言と、開いた画面の1画面目を合わせる。
// 同じ画面になる札は1枚・札の名前と上の帯の時期が同じ・札から開いた時だけ、札の言葉の事を一番上に（その日だけ）。Claude は呼ばない。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { advisorMoments } from "@/lib/advisor";
import { clockAt } from "@/lib/clock";
import { DEMO_FAMILY } from "@/lib/demo-family";
import { scheduleFor, statusOf } from "@/lib/milestones";
import { demoFirstDay, demoStages } from "./stages";
import { ADVISOR, focusFor } from "./stage-focus";
import { planToday, withAssignee } from "./task";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("見本の時期の札", () => {
  it("同じ画面になる札は1枚（同じ日の札が2枚無い）。28週と30週・生まれた翌日と早く生まれた日をまとめて8枚", () => {
    const stages = demoStages(DEMO_FAMILY);
    expect(new Set(stages.map((s) => s.date)).size).toBe(stages.length);
    expect(stages.map((s) => s.key)).toEqual(["w8", "w28", "w37", "born", "m2", "y1", "y2", "adv-2027-01-19"]);
  });

  it("札の名前と、開いた時の上の帯の時期が同じ。札を選ぶ前に開いた日も、一覧の最初の「妊娠8週」（前は7週6日）", () => {
    const band: Record<string, string> = { w8: "妊娠8週0日", w28: "妊娠28週0日", w37: "妊娠37週0日", born: "生後1日", m2: "生後2か月", y1: "1歳", y2: "2歳", "adv-2027-01-19": "妊娠24週1日" };
    for (const s of demoStages(DEMO_FAMILY)) expect(clockAt(DEMO_FAMILY, s.date).label, s.key).toBe(band[s.key]);
    expect(demoFirstDay(DEMO_FAMILY)).toBe(demoStages(DEMO_FAMILY)[0].date);
    // 見本の今日の初めの値（FamilyProvider）は、この日を使う
    expect(fs.readFileSync(path.join(here, "../FamilyProvider.tsx"), "utf8")).toContain("useState<string>(demoFirstDay(DEMO_FAMILY))");
  });

  it("早く生まれた家族は、生まれた翌日の札が組み直しを言い、開くと手帳が気づいた事を一番上に。予定どおりに生まれた家族は今までの一言", () => {
    const born = demoStages(DEMO_FAMILY).find((s) => s.key === "born")!;
    expect(born.what).toBe("出生届・14日以内の手続き。2週早く生まれて、手帳が予定を組み直した日");
    expect(born.focus).toBe(ADVISOR);
    expect(advisorMoments(DEMO_FAMILY).some((m) => m.date === born.date)).toBe(true);
    const onTime = demoStages({ ...DEMO_FAMILY, birthDate: DEMO_FAMILY.dueDate }).find((s) => s.key === "born")!;
    expect(onTime.what).toBe("出生届・14日以内の手続き");
    expect(onTime.focus).toBeUndefined();
    // もしもの札（引っ越した）も、気づいた事を一番上に
    const sky = demoStages(DEMO_FAMILY).filter((s) => s.tone === "sky");
    expect(sky.length).toBe(1);
    expect(sky.every((s) => s.focus === ADVISOR)).toBe(true);
  });

  it("生後2か月の札は、その日に始まっていて済んでいない「予防接種を始める」を一番上に", () => {
    const m2 = demoStages(DEMO_FAMILY).find((s) => s.key === "m2")!;
    expect(m2.focus).toBe("vaccines-start");
    const t = scheduleFor(DEMO_FAMILY, m2.date).find((m) => m.id === m2.focus);
    expect(t?.plain).toBe("予防接種を始める");
    expect(["今やる", "期限が近い"]).toContain(statusOf(t!, m2.date, new Set()));
  });

  it("28週の札の一言の頭は、その日の美咲さんの一番上（産休・育休のお金の手続き）", () => {
    const w28 = demoStages(DEMO_FAMILY).find((s) => s.key === "w28")!;
    const me = DEMO_FAMILY.members.find((m) => m.role === "母")!;
    // 見本の家族は、通り過ぎた期限の事を済ませた前提にする（Techo.tsx の「デモの早送り」と同じ。24週の引っ越しの転入届は 2/1 まで）
    const schedule = scheduleFor(DEMO_FAMILY, w28.date);
    const passed = new Set(schedule.filter((m) => m.deadlineDate && m.deadlineDate < w28.date).map((m) => m.id));
    expect(passed.has("moved-tennyu")).toBe(true);
    const tasks = schedule.map((m) => withAssignee({ ...m, status: statusOf(m, w28.date, passed) }, DEMO_FAMILY, undefined));
    expect(planToday(tasks, w28.date, me).top?.id).toBe("leave-money-request");
    expect(w28.what.startsWith("産休・育休のお金の手続き")).toBe(true);
  });

  it("札の focus はその日だけ（日を変えると普段の並び）。ほかの画面からの ?focus= は今までどおり", () => {
    expect(focusFor({ id: "vaccines-start", day: "2027-06-26" }, null, "2027-06-26")).toEqual({ taskId: "vaccines-start", advisorFirst: false });
    expect(focusFor({ id: "vaccines-start", day: "2027-06-26" }, null, "2027-06-27")).toEqual({ taskId: null, advisorFirst: false });
    expect(focusFor({ id: ADVISOR, day: "2027-01-19" }, null, "2027-01-19")).toEqual({ taskId: null, advisorFirst: true });
    expect(focusFor(null, "birth-registration", "2027-04-27")).toEqual({ taskId: "birth-registration", advisorFirst: false });
    expect(focusFor({ id: ADVISOR, day: "2027-01-19" }, "birth-registration", "2027-04-27")).toEqual({ taskId: "birth-registration", advisorFirst: false });
    expect(focusFor(null, null, "2027-04-27")).toEqual({ taskId: null, advisorFirst: false });
  });
});
