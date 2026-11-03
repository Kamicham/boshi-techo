import { describe, expect, it } from "vitest";
import { DEMO_FAMILY } from "@/lib/demo-family";
import { MILESTONES } from "@/lib/milestones";
import { isMine, withAssignee } from "./task";

const shared = MILESTONES.find((m) => m.who === "家族")!;
const mom = DEMO_FAMILY.members.find((m) => m.role === "母")!;
const partner = DEMO_FAMILY.members.find((m) => m.role === "パートナー")!;

describe("家族みんなの事の「誰がやる？」", () => {
  it("決めていなければ全員の事のまま・選べる印が付く", () => {
    const t = withAssignee(shared, DEMO_FAMILY, undefined);
    expect(t.who).toBe("家族");
    expect(t.shared).toBe(true);
    expect(isMine(t, mom) && isMine(t, partner)).toBe(true);
  });
  it("パートナーに決めたら、パートナーの番になる", () => {
    const t = withAssignee(shared, DEMO_FAMILY, { [shared.id]: partner.id });
    expect(t.who).toBe("パートナー");
    expect(isMine(t, partner)).toBe(true);
    expect(isMine(t, mom)).toBe(false);
  });
  it("2人でと決めたら、全員の事のまま together の印", () => {
    const t = withAssignee(shared, DEMO_FAMILY, { [shared.id]: "together" });
    expect(t.who).toBe("家族");
    expect(t.together).toBe(true);
  });
  it("1人の家族では選ばせない", () => {
    const solo = { ...DEMO_FAMILY, members: [mom] };
    expect(withAssignee(shared, solo, { [shared.id]: mom.id }).shared).toBeUndefined();
  });
  it("家族にいない id は無視する", () => {
    expect(withAssignee(shared, DEMO_FAMILY, { [shared.id]: "nobody" }).who).toBe("家族");
  });
});
