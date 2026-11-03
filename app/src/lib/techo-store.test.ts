// 手帳の記録の出し入れ（確定・消す・作った家族の記録）と、Claude を呼ばない下ごしらえ。
// DB は一時フォルダに作る（わが家の app/data には触らない）。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Family } from "./demo-family";
import type { TechoEntry } from "./techo";

vi.mock("server-only", () => ({}));
// 担当3の作った記録。ここでは決まった2件を返す（中身の検査は techo-seed 側）
// 作った家族かの判定（isMadeFamily）は本物を使う
vi.mock("./techo-seed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./techo-seed")>()),
  seedTecho: (_f: Family, today: string): TechoEntry[] => [
    { page: "development", date: today, title: "寝返り", values: { item: "寝返り" }, source: "seed" },
    { page: "mother-health", date: "2026-01-01", title: "妊婦の健康状態", values: { heightCm: 158 }, source: "seed" },
  ],
}));

// アカウントで作った本物の世帯の id（Better Auth が作る英数字だけの id の形。作った id）
const REAL = "hReal0Household0Test0001";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boshi-techo-test-"));
process.env.BOSHI_DATA_DIR = dir;

type Store = typeof import("./techo-store");
type Cap = typeof import("./capture");
let S: Store;
let C: Cap;

beforeAll(async () => {
  S = await import("./techo-store");
  C = await import("./capture");
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const fam = (id: string) => ({ id, city: "さいたま市", prefecture: "埼玉県", dueDate: "2027-05-10", members: [] }) as unknown as Family;

describe("値を決まりどおりに整える", () => {
  it("数は「3,120g」「３６．５」も読む。読めない値・知らない欄・空は捨てる", () => {
    expect(S.toNumber("3,120g")).toBe(3120);
    expect(S.toNumber("３６．５")).toBe(36.5);
    expect(S.toNumber("よめない")).toBeNull();
    expect(S.cleanValues("birth", { weightG: "3,120g", heightCm: "", headCm: "？", made: "up", method: "経膣分娩" })).toEqual({ weightG: 3120, method: "経膣分娩" });
  });

  it("便色の番号は 1〜7 だけ", () => {
    expect(S.cleanValues("stool", { colorNo: "3" })).toEqual({ colorNo: 3 });
    expect(S.cleanValues("stool", { colorNo: 8 })).toEqual({});
    expect(S.cleanEntry({ page: "stool", values: { colorNo: 0 } }, { today: "2027-06-01" })).toBeNull();
  });

  it("ページが分からない・必須の欄が無い記録は入れない。日付が無ければ今日", () => {
    expect(S.cleanEntry({ page: "nope" as never, values: { text: "x" } }, { today: "2027-06-01" })).toBeNull();
    expect(S.cleanEntry({ page: "vaccine", values: { lot: "A1" } }, { today: "2027-06-01" })).toBeNull();
    const e = S.cleanEntry({ page: "vaccine", values: { vaccine: "BCG" } }, { today: "2027-06-01", source: "voice" });
    expect(e).toMatchObject({ page: "vaccine", date: "2027-06-01", title: "BCG", source: "voice" });
  });

  it("並びはページの順 → 日付の順", () => {
    const d = (page: TechoEntry["page"], date: string) => ({ data: { page, date } as TechoEntry, date, createdAt: "x" });
    const r = S.sortTecho([d("vaccine", "2027-07-01"), d("development", "2027-09-01"), d("development", "2027-08-01"), d("mother-health", "2027-01-01")]);
    expect(r.map((x) => `${x.data.page}:${x.date}`)).toEqual(["mother-health:2027-01-01", "development:2027-08-01", "development:2027-09-01", "vaccine:2027-07-01"]);
  });
});

describe("出し入れ", () => {
  it("候補は pending で入り、OK で確定、違うで消える。ほかの家族の id は触れない", () => {
    const [a, b] = S.addTecho(
      REAL,
      [
        { page: "development", date: "2027-08-01", title: "寝返り", values: { item: "寝返り" } },
        { page: "feeling", values: { text: "早く会いたい" }, who: "美咲" },
        { page: "growth", values: { weightKg: "よめない" } },
      ],
      { today: "2027-08-02", source: "voice", pending: true, captureId: "c1" },
    );
    expect(a.data.pending).toBe(true);
    expect(b.data).toMatchObject({ page: "feeling", who: "美咲", date: "2027-08-02", captureId: "c1" });
    expect(S.listTecho(REAL)).toHaveLength(2);

    expect(S.confirmTecho(a.id, "someone-else")).toBeNull();
    const ok = S.confirmTecho(a.id, REAL);
    expect(ok?.data.pending).toBeUndefined();
    expect(S.removeTecho(b.id, "someone-else")).toBe(false);
    expect(S.removeTecho(b.id, REAL)).toBe(true);
    expect(S.listTecho(REAL).map((d) => d.id)).toEqual([a.id]);
  });

  it("聞き返しで作り直す時は、同じ束の確定していない候補だけ消す", () => {
    const [p, q] = S.addTecho("fam-r", [{ page: "development", values: { item: "はいはい" } }, { page: "development", values: { item: "指さし" } }], {
      today: "2027-10-01",
      pending: true,
      captureId: "c2",
    });
    S.confirmTecho(q.id, "fam-r");
    S.removePendingByCapture("fam-r", "c2");
    expect(S.listTecho("fam-r").map((d) => d.id)).toEqual([q.id]);
    expect(p.id).not.toBe(q.id);
  });

  it("作った家族は、その日の時点の作った記録を毎回混ぜる（保存しない）。今日より後の記録は返さない。本物の世帯には入れない", () => {
    const f = fam("sim-01");
    const first = S.listTecho(f.id, { family: f, today: "2027-09-01" });
    expect(first.map((d) => d.data.page)).toEqual(["mother-health", "development"]);
    expect(first.every((d) => d.data.source === "seed" && !d.data.pending)).toBe(true);
    expect(S.listTecho(f.id, { family: f, today: "2027-09-01" })).toHaveLength(2);
    expect(S.listTecho(f.id, { family: f, today: "2020-01-01" }).every((d) => (d.date ?? d.data.date) <= "2020-01-01")).toBe(true);
    expect(S.listTecho(REAL, { family: fam(REAL), today: "2027-09-01" }).every((d) => d.data.source !== "seed")).toBe(true);
    // 前の判定（頭の文字）では作った家族に見えた id も、固定の形に合わなければ本物として扱う
    for (const id of ["mine", "sim-abc", "demo-x", "pop-12"]) {
      expect(S.listTecho(id, { family: fam(id), today: "2027-09-01" }).every((d) => d.data.source !== "seed")).toBe(true);
    }
  });
});

describe("話した言葉に無い数字は捨てる（Claude が数字を作らない歯止め）", () => {
  it("言った数字は通し、言っていない数字は捨てる", () => {
    expect(C.numberWasSaid(3120, "3120グラムで生まれた")).toBe(true);
    expect(C.numberWasSaid(3.12, "3キロ120だった")).toBe(true);
    expect(C.numberWasSaid(3.5, "体重を測ったよ")).toBe(false);
    expect(C.numberWasSaid(5, "便は５番の色")).toBe(true);
  });

  it("候補の数の欄だけを見る。写真（said=null）はそのまま", () => {
    const t = { page: "growth" as const, date: "2027-09-01", title: "体重", who: null, values: [{ key: "weightKg", value: "7.2" }, { key: "heightCm", value: "66" }] };
    expect(C.techoFromItem(t, "体重は7.2キロだった").values).toEqual({ weightKg: "7.2" });
    expect(C.techoFromItem(t, null).values).toEqual({ weightKg: "7.2", heightCm: "66" });
  });
});

describe("子どもの体重の読み取り（「4,120 g」「4120g」「4.12kg」）", () => {
  it("書き方の違いをグラムにする。単位が無い時は 100 以上がグラム", () => {
    expect(C.gramsOf("4,120 g")).toBe(4120);
    expect(C.gramsOf("4120g")).toBe(4120);
    expect(C.gramsOf("4.12kg")).toBe(4120);
    expect(C.gramsOf("４，１２０ｇ")).toBe(4120);
    expect(C.gramsOf("3キロ120")).toBe(3120);
    expect(C.gramsOf("7.2")).toBe(7200);
    expect(C.gramsOf("3050")).toBe(3050);
    expect(C.gramsOf("よめない")).toBeNull();
  });

  it("成長・乳幼児健診は kg、出生・新生児は g の欄に直す。欄の名前が違っても入れる", () => {
    const item = (page: "growth" | "child-checkup" | "birth" | "newborn", key: string, value: string) => ({ page, date: "2027-05-26", title: "1か月児健診", who: null, values: [{ key, value }] });
    expect(C.techoFromItem(item("growth", "weightKg", "4,120 g"), null).values).toEqual({ weightKg: "4.12" });
    expect(C.techoFromItem(item("growth", "weightG", "4120g"), null).values).toEqual({ weightKg: "4.12" });
    expect(C.techoFromItem(item("child-checkup", "weightKg", "4.12kg"), null).values).toEqual({ weightKg: "4.12" });
    expect(C.techoFromItem(item("birth", "weightKg", "3.12kg"), null).values).toEqual({ weightG: "3120" });
    expect(C.techoFromItem(item("newborn", "weightG", "3,050"), null).values).toEqual({ weightG: "3050" });
    // 整えた後も、決まりどおりの数になる
    expect(S.cleanValues("growth", C.techoFromItem(item("growth", "weightKg", "4,120 g"), null).values)).toEqual({ weightKg: 4.12 });
  });

  it("体重がメモの文にだけ入っていても拾う", () => {
    const t = { page: "child-checkup" as const, date: "2027-05-26", title: "1か月児健診", who: null, values: [{ key: "checkup", value: "1か月児健診" }, { key: "memo", value: "体重 4,120g 哺乳良好" }] };
    expect(C.techoFromItem(t, null).values.weightKg).toBe("4.12");
  });

  it("話した時は、言葉に無い体重を捨てる（numberWasSaid を壊さない）", () => {
    const t = { page: "growth" as const, date: "2027-05-26", title: "体重", who: null, values: [{ key: "weightKg", value: "4.12kg" }] };
    expect(C.techoFromItem(t, "体重は4120グラムだった").values).toEqual({ weightKg: "4.12" });
    expect(C.techoFromItem(t, "体重を測ったよ").values).toEqual({});
  });
});

describe("紙に日付が無い時は、今日にせず、ページの題と生まれた日から推す", () => {
  const f = { dueDate: "2027-05-10", birthDate: "2027-04-26" };
  const today = "2029-02-01";
  const g = (page: TechoEntry["page"], title: string, values: Record<string, string> = {}) => C.guessTechoDate({ page, title, values }, f, today);
  it("健診の名前の時期から", () => {
    expect(g("child-checkup", "1か月児健診", { checkup: "1か月児健診" })).toBe("2027-05-26");
    expect(g("growth", "3〜4か月健診")).toBe("2027-07-26");
    expect(g("child-checkup", "1歳6か月児健診")).toBe("2028-10-26");
    expect(g("child-checkup", "1歳半健診")).toBe("2028-10-26");
  });
  it("出産は生まれた日、新生児・産後は日数、妊婦健診は週数から", () => {
    expect(g("birth", "出産の状態")).toBe("2027-04-26");
    expect(g("newborn", "退院時", { dayAge: "5" })).toBe("2027-05-01");
    expect(g("pregnancy-checkup", "妊婦健診", { week: "24週" })).toBe("2027-01-18");
  });
  it("推せない時・今日より後になる時は null（家族に入れてもらう）", () => {
    expect(g("growth", "計測")).toBeNull();
    expect(C.guessTechoDate({ page: "child-checkup", title: "3歳児健診", values: {} }, f, "2028-01-01")).toBeNull();
    expect(C.guessTechoDate({ page: "growth", title: "1か月児健診", values: {} }, { dueDate: "2027-05-10" }, today)).toBeNull();
  });
});

describe("候補の日付を直して OK する", () => {
  it("推した日の印は候補だけが持ち、OK で消える。渡した日で確定し、今日より後の日は受け取らない", () => {
    const [a, b] = S.addTecho(
      "fam-d",
      [
        { page: "growth", date: "2027-05-26", title: "1か月児健診", values: { weightKg: "4.12" }, dateUnsure: "guess" },
        { page: "growth", date: "2029-02-01", title: "計測", values: { heightCm: "53.6" }, dateUnsure: "none" },
      ],
      { today: "2029-02-01", source: "photo", pending: true, captureId: "c3" },
    );
    expect(a.data.dateUnsure).toBe("guess");
    expect(b.data.dateUnsure).toBe("none");
    const ok = S.confirmTecho(b.id, "fam-d", "2027-06-02", "2029-02-01");
    expect(ok?.data).toMatchObject({ date: "2027-06-02" });
    expect(ok?.data.pending).toBeUndefined();
    expect(ok?.data.dateUnsure).toBeUndefined();
    expect(ok?.date).toBe("2027-06-02");
    const future = S.confirmTecho(a.id, "fam-d", "2030-01-01", "2029-02-01");
    expect(future?.data.date).toBe("2027-05-26");
    // 確定した記録には印を付けない
    expect(S.cleanEntry({ page: "growth", values: { weightKg: 4 }, dateUnsure: "guess" }, { today: "2029-02-01" })?.dateUnsure).toBeUndefined();
  });
});
