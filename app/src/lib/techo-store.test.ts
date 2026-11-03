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
vi.mock("./techo-seed", () => ({
  seedTecho: (_f: Family, today: string): TechoEntry[] => [
    { page: "development", date: today, title: "寝返り", values: { item: "寝返り" }, source: "seed" },
    { page: "mother-health", date: "2026-01-01", title: "妊婦の健康状態", values: { heightCm: 158 }, source: "seed" },
  ],
}));

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
      "mine",
      [
        { page: "development", date: "2027-08-01", title: "寝返り", values: { item: "寝返り" } },
        { page: "feeling", values: { text: "早く会いたい" }, who: "美咲" },
        { page: "growth", values: { weightKg: "よめない" } },
      ],
      { today: "2027-08-02", source: "voice", pending: true, captureId: "c1" },
    );
    expect(a.data.pending).toBe(true);
    expect(b.data).toMatchObject({ page: "feeling", who: "美咲", date: "2027-08-02", captureId: "c1" });
    expect(S.listTecho("mine")).toHaveLength(2);

    expect(S.confirmTecho(a.id, "someone-else")).toBeNull();
    const ok = S.confirmTecho(a.id, "mine");
    expect(ok?.data.pending).toBeUndefined();
    expect(S.removeTecho(b.id, "someone-else")).toBe(false);
    expect(S.removeTecho(b.id, "mine")).toBe(true);
    expect(S.listTecho("mine").map((d) => d.id)).toEqual([a.id]);
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

  it("作った家族は、その日の時点の作った記録を毎回混ぜる（保存しない）。今日より後の記録は返さない。わが家には入れない", () => {
    const f = fam("sim-01");
    const first = S.listTecho(f.id, { family: f, today: "2027-09-01" });
    expect(first.map((d) => d.data.page)).toEqual(["mother-health", "development"]);
    expect(first.every((d) => d.data.source === "seed" && !d.data.pending)).toBe(true);
    expect(S.listTecho(f.id, { family: f, today: "2027-09-01" })).toHaveLength(2);
    expect(S.listTecho(f.id, { family: f, today: "2020-01-01" }).every((d) => (d.date ?? d.data.date) <= "2020-01-01")).toBe(true);
    expect(S.listTecho("mine", { family: fam("mine"), today: "2027-09-01" }).every((d) => d.data.source !== "seed")).toBe(true);
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
