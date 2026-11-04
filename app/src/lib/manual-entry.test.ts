// 打って入れる（VISION ①「入力ゼロ、でも押し付けない」）の決まりと、手帳の欄の先入れ
import { describe, expect, it } from "vitest";
import { DEMO_FAMILY } from "./demo-family";
import { cleanManual, temperatureRecord } from "./manual-entry";
import { techoPrefill } from "./techo-prefill";

const today = "2027-03-01";

describe("打って入れる記録（cleanManual）", () => {
  it("一言はそのまま記録になる（Claude を通さない）", () => {
    const r = cleanManual({ kind: "できごと", title: " 初めて  しゃっくり ", date: "2027-02-28" }, today);
    expect(r).toEqual({ ok: true, value: { kind: "できごと", title: "初めて しゃっくり", detail: "", date: "2027-02-28" } });
  });
  it("日付が無ければ今日", () => {
    const r = cleanManual({ kind: "メモ", title: "ベビーカーを見に行った" }, today);
    expect(r.ok && r.value.date).toBe(today);
  });
  it("予定は先の日と時刻を入れられ、期限にもできる", () => {
    const r = cleanManual({ kind: "予定", title: "保育園の見学", date: "2027-03-09", time: "10:30", deadline: true }, today);
    expect(r).toEqual({ ok: true, value: { kind: "予定", title: "10:30 保育園の見学", detail: "10:30から", date: "2027-03-09", isDeadline: true } });
  });
  it("予定のほかは先の日にしない・期限にしない", () => {
    expect(cleanManual({ kind: "できごと", title: "x", date: "2027-03-02" }, today).ok).toBe(false);
    const r = cleanManual({ kind: "メモ", title: "x", deadline: true }, today);
    expect(r.ok && r.value.isDeadline).toBeUndefined();
  });
  it("種類・中身・日付・時刻がおかしい時は、家族に見せる言葉で止める", () => {
    expect(cleanManual({ kind: "書類", title: "x" }, today)).toEqual({ ok: false, error: "何の記録かを選んでください" });
    expect(cleanManual({ kind: "予定", title: "  " }, today)).toEqual({ ok: false, error: "何の予定かを入れてください" });
    expect(cleanManual({ kind: "メモ", title: "x", date: "3/1" }, today).ok).toBe(false);
    expect(cleanManual({ kind: "予定", title: "x", time: "25:00" }, today).ok).toBe(false);
    expect(cleanManual({ kind: "メモ", title: "あ".repeat(81) }, today).ok).toBe(false);
  });
});

describe("体温（temperatureRecord）", () => {
  it("数字を小数1桁の記録にする（全角も読む）。良し悪しは書かない", () => {
    const r = temperatureRecord("３６．８", today, today, "美咲");
    expect(r).toEqual({ ok: true, value: { kind: "メモ", title: "体温 36.8℃", detail: "", date: today, who: "美咲" } });
  });
  it("打ち間違いだけを止める", () => {
    expect(temperatureRecord("368", today, today).ok).toBe(false);
    expect(temperatureRecord("", today, today).ok).toBe(false);
  });
});

describe("手帳の欄の先入れ（techoPrefill）", () => {
  const f = DEMO_FAMILY;
  it("妊婦健診: 週数は手帳の時計から、医療機関は前回から。体の数字は入れない", () => {
    const items = [{ page: "pregnancy-checkup", date: "2027-02-01", values: { week: "26週", weightKg: 58.2, facility: "さいたま母子クリニック（例）" } }];
    expect(techoPrefill("pregnancy-checkup", f, "2027-03-01", items)).toEqual({ facility: "さいたま母子クリニック（例）", week: "30週" });
  });
  it("OK 待ちの候補・その日より後の記録は前回にしない", () => {
    const items = [
      { page: "pregnancy-checkup", date: "2027-02-01", values: { facility: "A" }, pending: true },
      { page: "pregnancy-checkup", date: "2027-04-01", values: { facility: "B" } },
    ];
    expect(techoPrefill("pregnancy-checkup", f, "2027-03-01", items).facility).toBeUndefined();
  });
  it("新生児・産後は生まれた日からの日数", () => {
    expect(techoPrefill("newborn", f, "2027-05-03", [])).toEqual({ dayAge: "7" });
    expect(techoPrefill("postpartum", f, "2027-05-26", [])).toEqual({ days: "30" });
  });
  it("妊婦の健康状態は前回の値を引き継ぐ", () => {
    const items = [{ page: "mother-health", date: "2026-10-07", values: { heightCm: 158, allergy: "なし" } }];
    expect(techoPrefill("mother-health", f, today, items)).toEqual({ heightCm: "158", allergy: "なし" });
  });
});
