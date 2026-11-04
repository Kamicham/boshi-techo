// 下書きの書き手と職場（見直し C09）: 翔太さんの事は、美咲さんが開いても翔太さんの名前と職場で書く。
// 11/3 の形の「いつもの」（職場が家族に1つ）は母の職場として読み、パートナーの下書きには入れない（Claude にも渡さない）。
// 家族も職場も作った物。Claude は呼ばない（structured を偽にして、渡した文を確かめる）。DB は一時フォルダ（わが家の app/data には触らない）。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Family } from "./demo-family";
import type { Keep } from "./keep";

vi.mock("server-only", () => ({}));

const asked: { system: string; user: string }[] = [];
vi.mock("./claude", async () => {
  const actual = await vi.importActual<typeof import("./claude")>("./claude");
  return {
    ...actual,
    // 職場あてのメールの形（空欄は決まりどおりの名前）
    structured: vi.fn(async (_schema: unknown, system: string, user: string) => {
      asked.push({ system, user });
      return {
        kind: "メール",
        title: "育休のご相談",
        to: "【会社名】 【上司の名前】様",
        body: "【上司の名前】様\n\nお疲れさまです。【会社名】の【自分の名前】です。育休のご相談です。\n\n【自分の名前】",
        checklist: ["休む日を確かめる"],
      };
    }),
  };
});

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boshi-drafts-writer-test-"));
process.env.BOSHI_DATA_DIR = dir;
delete process.env.BOSHI_SIM;

type D = typeof import("./drafts");
type K = typeof import("./keep");
type W = typeof import("./whose");
type DB = typeof import("./db");
let Dr: D;
let Kp: K;
let Wh: W;
let Db: DB;
let F: Family;
let findMilestone: (id: string) => import("./milestones").MilestoneDef;

// 11/3 の形の「いつもの」（作った値）
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

beforeAll(async () => {
  Dr = await import("./drafts");
  Kp = await import("./keep");
  Wh = await import("./whose");
  Db = await import("./db");
  const { DEMO_FAMILY } = await import("./demo-family");
  ({ findMilestone } = await import("./local"));
  // 見本の家族の形（美咲＝母・翔太＝パートナー）で、id だけ別にする（見本の答えの決まりに乗らない）
  F = { ...DEMO_FAMILY, id: "whose-test-family" };
  // 11/3 の版が書いたとおりに置く（remember を通さない＝欄も updatedAt もそのまま）
  Db.put<Keep>(F.id, "profile", OLD_KEEP, { id: `keep:${F.id}` });
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("11/3 の形の「いつもの」を、そのまま読める", () => {
  it("欄はそのまま。職場は母の分", () => {
    const k = Kp.getKeep(F.id);
    expect(k).toEqual(OLD_KEEP);
    expect(Wh.workOf(k, F, "misaki")?.company).toBe("作った商事");
    expect(Wh.workOf(k, F, "shota")).toBeUndefined();
  });
});

describe("書き手は、その事の担当の人", () => {
  it("パートナーの事は、母が開いてもパートナー。母の事は、パートナーが開いても母", () => {
    expect(Dr.writerOf(F, "misaki", "partner-leave-14")?.id).toBe("shota");
    expect(Dr.writerOf(F, "shota", "tell-work-birth")?.id).toBe("misaki");
  });

  it("家族みんなの事は「誰がやる？」で決めた人。2人で・まだ決めていない時は開いた人（分からなければ母）", () => {
    expect(Dr.writerOf(F, "misaki", "birth-registration", { "birth-registration": "shota" })?.id).toBe("shota");
    expect(Dr.writerOf(F, "shota", "birth-registration", { "birth-registration": "together" })?.id).toBe("shota");
    expect(Dr.writerOf(F, "shota", "birth-registration")?.id).toBe("shota");
    expect(Dr.writerOf(F, null, "birth-registration")?.id).toBe("misaki");
  });
});

describe("パートナーの下書きに、母の職場を入れない", () => {
  it("母が開いたパートナーの育休の下書き: Claude に母の会社・上司を渡さず、空欄も母の職場で埋めない。翔太さんへ渡す1行が出る", async () => {
    asked.length = 0;
    const v = await Dr.makeDraft(F, findMilestone("partner-leave-14"), "2027-02-01", "misaki");
    expect(asked).toHaveLength(1);
    const { system, user } = asked[0];
    expect(system).toContain("職場あての文は、書き手の職場の事だけを書く");
    expect(user).toContain("書き手: 翔太（パートナー）");
    expect(user).not.toContain("作った商事");
    expect(user).not.toContain("山本");
    expect(user).not.toContain("総務部");
    // 母の職場では埋めない（パートナーの職場はまだ知らない＝空欄のまま聞く）
    const text = `${v.draft?.to}\n${v.draft?.body}`;
    expect(text).not.toContain("作った商事");
    expect(text).not.toContain("山本");
    expect(text).toContain("【会社名】");
    expect(v.mailTo).toBe("");
    expect(v.blanks.map((b) => b.key)).toEqual(expect.arrayContaining(["company", "boss", "email"]));
    // 書き手の名前は、覚えた翔太さんの名前
    expect(v.draft?.body).toContain("佐藤 翔太");
    expect(v.writerId).toBe("shota");
    // 渡す1行は画面の呼び方（手紙に書く名前ではない）
    expect(v.handTo).toEqual({ id: "shota", name: "翔太" });
  });

  it("翔太さんの職場を覚えたら、翔太さんの職場で埋まる。母の職場は消えない", () => {
    const k = Kp.remember(F.id, Wh.splitWorkInput(F, { shota: { company: "作った工業", boss: "高橋", email: "takahashi@example.com" } }));
    expect(k.work).toEqual(OLD_KEEP.work);
    expect(k.workBy?.shota).toMatchObject({ company: "作った工業", boss: "高橋" });
    const v = Dr.viewDraft(F, Dr.getDraft(F.id, "partner-leave-14"), "misaki");
    expect(v.draft?.to).toBe("作った工業 高橋様");
    expect(v.draft?.body).toContain("作った工業の佐藤 翔太です");
    expect(v.draft?.body).not.toContain("作った商事");
    expect(v.mailTo).toBe("takahashi@example.com");
    // 翔太さん本人が開いた時は、渡す1行を出さない
    expect(Dr.viewDraft(F, Dr.getDraft(F.id, "partner-leave-14"), "shota").handTo).toBeNull();
  });

  it("母の事は、翔太さんが開いても母の職場（覚えている事として渡し、空欄も母の職場で埋める）", async () => {
    asked.length = 0;
    const v = await Dr.makeDraft(F, findMilestone("tell-work-birth"), "2027-04-27", "shota");
    const { user } = asked[0];
    expect(user).toContain("書き手: 美咲（母）");
    expect(user).toContain("覚えている事（職場は美咲の職場）:");
    expect(user).toContain("会社名: 作った商事");
    expect(user).toContain("上司の名前: 山本");
    expect(user).not.toContain("作った工業");
    expect(user).not.toContain("高橋");
    expect(v.draft?.to).toBe("作った商事 山本様");
    expect(v.mailTo).toBe("boss@example.com");
    expect(v.handTo).toEqual({ id: "misaki", name: "美咲" });
  });

  it("直した文の保存と「送った」の印も、渡した書き手の職場で埋める", () => {
    const w = Dr.writerWork(F, Kp.getKeep(F.id), "misaki", "partner-leave-14");
    expect(w?.company).toBe("作った工業");
    const saved = Dr.saveDraft(F.id, "partner-leave-14", { body: "【会社名】の【上司の名前】様へ" }, { work: w });
    expect(saved?.body).toBe("作った工業の高橋様へ");
    const ok = Dr.confirmDraft(F.id, "partner-leave-14", { to: "【会社名】 人事部" }, "2027-02-02", { work: w });
    expect(ok?.to).toBe("作った工業 人事部");
    expect(ok?.status).toBe("ok");
  });
});

describe("「いつもの」の職場を直す", () => {
  it("人ごとの職場を足しても、空にしても、前からの欄（母の職場）は消えない", () => {
    Kp.remember(F.id, Wh.splitWorkInput(F, { shota: { company: "", boss: "", email: "" } }));
    const k = Kp.getKeep(F.id);
    expect(k.workBy).toBeUndefined();
    expect(k.work).toEqual(OLD_KEEP.work);
  });

  it("母の欄を設定から直すと、直した欄だけが変わる（部署は設定から送らないので残る）", () => {
    const k = Kp.remember(F.id, Wh.splitWorkInput(F, { misaki: { company: "作った商事", boss: "", email: "boss2@example.com" } }));
    expect(k.work).toEqual({ company: "作った商事", dept: "総務部", email: "boss2@example.com" });
    expect(k.names).toEqual(OLD_KEEP.names);
    expect(k.assign).toEqual(OLD_KEEP.assign);
  });
});

describe("町を変えた時の、前の町の窓口（見直し C10①）", () => {
  it("覚えた窓口は、Claude への頼みに「役所:」として渡す", async () => {
    asked.length = 0;
    await Dr.makeDraft(F, findMilestone("birth-registration"), "2027-04-27", "misaki");
    expect(asked[0].user).toContain("役所: 市役所 こども課（作った町1-1）");
  });

  it("町を変えたら印が付き、窓口の名前と住所は消さずに、頼みには渡さない", async () => {
    Kp.markOfficeMoved(F.id, "横浜市");
    expect(Kp.getKeep(F.id).office).toEqual({ ...OLD_KEEP.office, staleFrom: "横浜市" });
    asked.length = 0;
    await Dr.makeDraft(F, findMilestone("birth-registration"), "2027-04-27", "misaki");
    expect(asked[0].user).not.toContain("役所:");
    expect(asked[0].user).not.toContain("作った町1-1");
  });

  it("窓口を直すと印が外れ、また渡す。窓口を覚えていない家族には印を付けない", async () => {
    Kp.remember(F.id, { office: { name: "さいたま市 区役所", address: "", staleFrom: "" } });
    expect(Kp.getKeep(F.id).office).toEqual({ name: "さいたま市 区役所" });
    asked.length = 0;
    await Dr.makeDraft(F, findMilestone("birth-registration"), "2027-04-27", "misaki");
    expect(asked[0].user).toContain("役所: さいたま市 区役所");
    const other = "whose-test-no-office";
    Kp.markOfficeMoved(other, "横浜市");
    expect(Kp.getKeep(other).office).toBeUndefined();
  });
});
