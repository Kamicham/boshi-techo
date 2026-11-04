import { describe, expect, it } from "vitest";
import { canInvitePartner, childConsentLine, invitePartnerHref, RECORD_PROMISES, type InviteView } from "./consent-screen";
import { CONSULT_AFTER_NOTE, consultWaitsFirstDay } from "./consult-first-day";

const JUDGE = /異常|正常|ふつう|大丈夫です|問題ありません/;

const base: InviteView = {
  role: "owner",
  perms: ["household:admin", "record:read"],
  account: { id: "a1" },
  members: [{ accountId: "a1", role: "owner" }],
  invitations: [],
};

describe("同意の画面の守っている事", () => {
  it("3行で、判定の言葉も「法定代理人」も入れない", () => {
    expect(RECORD_PROMISES).toHaveLength(3);
    for (const t of [...RECORD_PROMISES, CONSULT_AFTER_NOTE, childConsentLine(true, false), childConsentLine(false, true)]) {
      expect(t).not.toMatch(JUDGE);
      expect(t).not.toContain("法定代理人");
    }
  });
  it("文字の記録がまだ暗号でない事を隠さない", () => {
    expect(RECORD_PROMISES.join("")).toContain("文字の記録の暗号化は準備中");
  });
  it("生まれる前は「おなかの子」", () => {
    expect(childConsentLine(true, false)).toBe("おなかの子の分は、親のあなたが代わりに同意します");
    expect(childConsentLine(true, true)).toBe("子の分は、親のあなたが代わりに同意します");
  });
});

describe("パートナーを招く入口", () => {
  it("持ち主で、まだパートナーがいない時だけ", () => {
    expect(canInvitePartner(base)).toBe(true);
    expect(invitePartnerHref("h 1")).toBe("/invite/new?familyId=h%201");
  });
  it("招けない人・作った家族には出さない", () => {
    expect(canInvitePartner(null)).toBe(false);
    expect(canInvitePartner({ ...base, role: "member", perms: ["record:read"] })).toBe(false);
    expect(canInvitePartner({ ...base, role: "guest" })).toBe(false);
  });
  it("共同の管理の人がもういる・パートナーへの招待が返事待ちなら出さない", () => {
    expect(canInvitePartner({ ...base, members: [...base.members, { accountId: "a2", role: "admin" }] })).toBe(false);
    expect(canInvitePartner({ ...base, invitations: [{ role: "admin", relation: "パートナー" }] })).toBe(false);
    expect(canInvitePartner({ ...base, members: [...base.members, { accountId: "a3", role: "member" }] })).toBe(true);
  });
  it("共同の管理の人（パートナー自身）が開いても、持ち主がいれば出さない", () => {
    expect(canInvitePartner({ ...base, role: "admin", account: { id: "a2" }, members: [{ accountId: "a1", role: "owner" }, { accountId: "a2", role: "admin" }] })).toBe(false);
  });
});

describe("相談できる人の問いは、使い始めた日に聞かない", () => {
  it("使い始めた日（とそれより前）は聞かない、次の日から聞く", () => {
    const f = { id: "h-real", startedOn: "2026-11-04" };
    expect(consultWaitsFirstDay(f, "2026-11-04")).toBe(true);
    expect(consultWaitsFirstDay(f, "2026-11-03")).toBe(true);
    expect(consultWaitsFirstDay(f, "2026-11-05")).toBe(false);
  });
  it("見本の家族・体験の写し・使い始めた日の無い家族は今までどおり", () => {
    expect(consultWaitsFirstDay({ id: "demo-sato", startedOn: "2026-11-04" }, "2026-11-04")).toBe(false);
    expect(consultWaitsFirstDay({ id: `try-${"a".repeat(32)}`, startedOn: "2026-11-04" }, "2026-11-04")).toBe(false);
    expect(consultWaitsFirstDay({ id: "h-old" }, "2026-11-04")).toBe(false);
  });
});

describe("招く相手の呼び方", () => {
  it("パートナーが始めた手帳では「ママ」、ほかは「パートナー」", async () => {
    const { inviteeWord } = await import("./consent-screen");
    const base = { role: "owner", perms: ["household:admin"], account: { id: "a" }, members: [], invitations: [] };
    expect(inviteeWord({ ...base, subjects: [{ kind: "partner", mine: true }, { kind: "mother", mine: false }] })).toBe("ママ");
    expect(inviteeWord({ ...base, subjects: [{ kind: "mother", mine: true }] })).toBe("パートナー");
    expect(inviteeWord(null)).toBe("パートナー");
  });
});
