// 人ごとの職場と、その事の担当（見直し C09）。家族も職場も作った物（実在の会社・人ではない）。
// 11/3 の形の「いつもの」（職場が家族に1つ・人ごとの欄が無い）は、移し替えずに母の職場として読む。
import { describe, expect, it } from "vitest";
import type { Member } from "./demo-family";
import type { Keep } from "./keep";
import { assigneeOf, cleanWork, legacyWorkOwner, splitWorkInput, workOf, worksByMember } from "./whose";

const MOM: Member = { id: "misaki", name: "美咲", role: "母" };
const PARTNER: Member = { id: "shota", name: "翔太", role: "パートナー" };
const fam = { members: [MOM, PARTNER] };

// 11/3 の形（この形のまま DB に残っている。updatedAt も当時の物）
const OLD_KEEP: Keep = {
  hospital: { name: "作ったさくら産院", phone: "000-0000-0000" },
  work: { company: "作った商事", dept: "総務部", boss: "山本", email: "boss@example.com" },
  names: { shota: "佐藤 翔太" },
  office: { name: "市役所 こども課", address: "作った町1-1" },
  shareVia: "line",
  childSex: "girl",
  assign: { "birth-registration": "shota" },
  updatedAt: "2026-11-03T09:00:00.000Z",
};

describe("前からの職場（11/3 の形）は、母の職場として読む", () => {
  it("母は前からの欄の職場。パートナーの職場は無い（母の職場を貸さない）", () => {
    expect(workOf(OLD_KEEP, fam, "misaki")).toMatchObject({ company: "作った商事", boss: "山本" });
    expect(workOf(OLD_KEEP, fam, "shota")).toBeUndefined();
    expect(worksByMember(OLD_KEEP, fam).map((x) => x.member.id)).toEqual(["misaki"]);
  });

  it("母のいない家族は、家族の最初の人の職場として読む", () => {
    const solo = { members: [PARTNER] };
    expect(legacyWorkOwner(solo)?.id).toBe("shota");
    expect(workOf(OLD_KEEP, solo, "shota")?.company).toBe("作った商事");
    expect(legacyWorkOwner({ members: [] })).toBeNull();
  });

  it("人ごとの職場が入ると、その人の分はそこから読む。空白だけの職場は無い事にする", () => {
    const k: Keep = { ...OLD_KEEP, workBy: { shota: { company: "作った工業", boss: "高橋" } } };
    expect(workOf(k, fam, "shota")).toMatchObject({ company: "作った工業", boss: "高橋" });
    expect(workOf(k, fam, "misaki")?.company).toBe("作った商事");
    expect(worksByMember(k, fam).map((x) => x.member.id)).toEqual(["misaki", "shota"]);
    expect(workOf({ workBy: { shota: { company: "  " } } }, fam, "shota")).toBeUndefined();
    expect(workOf(OLD_KEEP, fam, null)).toBeUndefined();
    expect(workOf(OLD_KEEP, fam, "someone-else")).toBeUndefined();
  });
});

describe("人ごとの職場の入力を「いつもの」の欄へ振り分ける（設定と下書きの画面から /api/keep へ）", () => {
  it("母の分は work（前の版でも読める欄）、ほかの人は workBy。その家族にいない人は捨てる", () => {
    const out = splitWorkInput(fam, {
      misaki: { company: " 作った商事 ", boss: "" },
      shota: { company: "作った工業" },
      stranger: { company: "よその会社" },
    });
    expect(out.work).toMatchObject({ company: "作った商事", boss: "" });
    expect(Object.keys(out.workBy ?? {})).toEqual(["shota"]);
    expect(out.workBy?.shota).toMatchObject({ company: "作った工業" });
    // 送らなかった欄は undefined（今のまま）。部署・人事を設定の画面から消さない
    expect(out.workBy?.shota.dept).toBeUndefined();
  });

  it("形の違う入力は何もしない", () => {
    expect(splitWorkInput(fam, "作った商事")).toEqual({});
    expect(splitWorkInput(fam, [{ company: "x" }])).toEqual({});
    expect(splitWorkInput(fam, { shota: "作った工業" })).toEqual({});
    // 口の JSON で「__proto__」を名乗る人も、家族にいないので捨てる
    expect(splitWorkInput(fam, JSON.parse('{"__proto__": {"company": "x"}}'))).toEqual({});
  });

  it("職場の欄は文字だけ・前後の空白を取って200字まで", () => {
    const w = cleanWork({ company: "あ".repeat(300), boss: 3, email: " x@example.com ", extra: "使わない" });
    expect(w.company).toHaveLength(200);
    expect(w.boss).toBeUndefined();
    expect(w.email).toBe("x@example.com");
    expect("extra" in w).toBe(false);
  });
});

describe("その事の担当", () => {
  it("母・パートナーの事は、その役の人", () => {
    expect(assigneeOf({ id: "partner-leave-14", who: "パートナー" }, fam)?.id).toBe("shota");
    expect(assigneeOf({ id: "tell-work-birth", who: "母" }, fam)?.id).toBe("misaki");
    expect(assigneeOf({ id: "partner-leave-14", who: "パートナー" }, { members: [MOM] })).toBeNull();
  });

  it("家族みんなの事は「誰がやる？」で決めた人。2人で・まだ決めていない・家族にいない人は決めない", () => {
    const t = { id: "birth-registration", who: "家族" as const };
    expect(assigneeOf(t, fam, { "birth-registration": "shota" })?.id).toBe("shota");
    expect(assigneeOf(t, fam, { "birth-registration": "together" })).toBeNull();
    expect(assigneeOf(t, fam, {})).toBeNull();
    expect(assigneeOf(t, fam)).toBeNull();
    expect(assigneeOf(t, fam, { "birth-registration": "someone-else" })).toBeNull();
  });
});
