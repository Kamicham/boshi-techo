import { describe, expect, it } from "vitest";
import {
  autoStage,
  briefingDay,
  familyMessage,
  lineMessage,
  summaryTooLong,
  chunkName,
  extFromMime,
  formatClock,
  looksStuck,
  mergeTranscripts,
  nextAgenda,
  orderChunks,
  orderTakeDirs,
  pickMime,
  resolveAppointmentDate,
  segmentsFromText,
  visitLabel,
} from "./visit";

const none = { month: null, day: null, afterWeeks: null, afterDays: null, afterMonths: null, weekday: null };

describe("録音の chunk", () => {
  it("番号は4桁で、数の順に並ぶ（文字の順ではない）", () => {
    expect(chunkName(3, "webm")).toBe("chunk-0003.webm");
    const names = ["chunk-0010.webm", "chunk-0002.webm", "recording.webm", "chunk-0000.webm", "chunk-0001.webm", "chunk-10000.webm"];
    const r = orderChunks(names);
    expect(r.files.slice(0, 4)).toEqual(["chunk-0000.webm", "chunk-0001.webm", "chunk-0002.webm", "chunk-0010.webm"]);
    expect(r.files[4]).toBe("chunk-10000.webm");
    expect(r.ext).toBe("webm");
  });

  it("抜けた番号を見つける", () => {
    expect(orderChunks(["chunk-0000.m4a", "chunk-0003.m4a"]).missing).toEqual([1, 2]);
    expect(orderChunks([]).files).toEqual([]);
  });

  it("録り直し（take）は数の順", () => {
    expect(orderTakeDirs(["take10", "take2", "recording.webm", "take0"])).toEqual(["take0", "take2", "take10"]);
  });

  it("形式: Chrome は webm、iOS Safari は mp4（m4a で置く）", () => {
    expect(pickMime((t) => t.startsWith("audio/webm"))).toBe("audio/webm;codecs=opus");
    expect(pickMime((t) => t === "audio/mp4")).toBe("audio/mp4");
    expect(pickMime(() => false)).toBeNull();
    expect(extFromMime("audio/webm;codecs=opus")).toBe("webm");
    expect(extFromMime("audio/mp4")).toBe("m4a");
    expect(extFromMime("audio/x-m4a")).toBe("m4a");
  });
});

describe("文字起こし", () => {
  it("分かれた録音は、前の長さだけ時刻をずらしてつなぐ", () => {
    const t = mergeTranscripts([
      { text: "あ", segments: [{ start: 0, end: 2, text: "あ" }], duration: 30 },
      { text: "い", segments: [{ start: 1.5, end: 3, text: "い" }], duration: 10 },
    ]);
    expect(t.segments[1]).toEqual({ start: 31.5, end: 33, text: "い" });
    expect(t.duration).toBe(40);
  });

  it("文字で渡されたら行ごとに分け、空行は捨てる", () => {
    expect(segmentsFromText("はい\n\n  こんにちは \n")).toEqual([{ text: "はい" }, { text: "こんにちは" }]);
  });

  it("時刻の見せ方", () => {
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(3729)).toBe("1:02:09");
  });
});

describe("次の予約日の計算（健診の日 2027-02-15 は月曜）", () => {
  const visit = "2027-02-15";
  it("2週間後", () => expect(resolveAppointmentDate(visit, { ...none, afterWeeks: 2 })).toBe("2027-03-01"));
  it("2週間後の水曜 → その週の水曜", () => expect(resolveAppointmentDate(visit, { ...none, afterWeeks: 2, weekday: 3 })).toBe("2027-03-03"));
  it("来週の月曜", () => expect(resolveAppointmentDate("2027-02-17", { ...none, afterWeeks: 1, weekday: 1 })).toBe("2027-02-22"));
  it("10日後", () => expect(resolveAppointmentDate(visit, { ...none, afterDays: 10 })).toBe("2027-02-25"));
  it("1か月後（月末は寄せる）", () => expect(resolveAppointmentDate("2027-01-31", { ...none, afterMonths: 1 })).toBe("2027-02-28"));
  it("曜日だけ → 次のその曜日（同じ曜日なら翌週）", () => {
    expect(resolveAppointmentDate(visit, { ...none, weekday: 5 })).toBe("2027-02-19");
    expect(resolveAppointmentDate(visit, { ...none, weekday: 1 })).toBe("2027-02-22");
  });
  it("月日 → 健診の日より後の、一番近いその日（年をまたぐ）", () => {
    expect(resolveAppointmentDate(visit, { ...none, month: 3, day: 1 })).toBe("2027-03-01");
    expect(resolveAppointmentDate("2026-12-20", { ...none, month: 1, day: 5 })).toBe("2027-01-05");
    expect(resolveAppointmentDate(visit, { ...none, month: 2, day: 30 })).toBeNull();
  });
  it("言っていなければ null", () => expect(resolveAppointmentDate(visit, none)).toBeNull());
});

describe("前日の声かけ", () => {
  it("前日と当日だけ", () => {
    expect(briefingDay("2027-02-28", "2027-03-01")).toBe("eve");
    expect(briefingDay("2027-03-01", "2027-03-01")).toBe("day");
    expect(briefingDay("2027-02-27", "2027-03-01")).toBeNull();
    expect(briefingDay("2027-03-02", "2027-03-01")).toBeNull();
    expect(briefingDay("2027-03-01", null)).toBeNull();
  });
  it("週数の呼び名", () => {
    expect(visitLabel({ dueDate: "2027-05-10" }, "2027-02-15")).toBe("妊娠28週");
    expect(visitLabel({ dueDate: "2027-05-10", birthDate: "2027-05-08" }, "2027-06-08")).toBe("生後1か月");
  });
});

describe("次の健診で聞く事", () => {
  const q = (question: string) => ({ question, why: "" });
  const visits = [
    { id: "a", status: "done" as const, date: "2027-02-01", result: { questions: [q("古い質問")] } },
    { id: "b", status: "done" as const, date: "2027-02-15", result: { questions: [q("張りは何回で電話？")] } },
    { id: "c", status: "ready" as const, date: "2027-02-20" },
  ];
  it("一番新しいできた健診の質問と、気がかり", () => {
    const r = nextAgenda(visits, { concerns: [{ id: "x", text: "足がつる", date: "2027-02-20" }] });
    expect(r.items.map((i) => i.text)).toEqual(["張りは何回で電話？", "足がつる"]);
    expect(r.fromVisit).toBe("b");
  });
  it("もう持ち越した質問は出さない", () => {
    expect(nextAgenda(visits, { concerns: [], carriedFrom: "b" }).items).toEqual([]);
  });
});

describe("止まった処理", () => {
  it("20分を過ぎた処理中は止まった扱い", () => {
    const now = Date.parse("2027-02-15T10:30:00Z");
    expect(looksStuck({ status: "organizing", processingSince: "2027-02-15T10:00:00Z" }, now)).toBe(true);
    expect(looksStuck({ status: "organizing", processingSince: "2027-02-15T10:25:00Z" }, now)).toBe(false);
    expect(looksStuck({ status: "done" }, now)).toBe(false);
  });
});

describe("健診の日の段", () => {
  it("記録の状態から、開いた時の段を決める", () => {
    expect(autoStage({ status: "ready" })).toBe("arrive");
    expect(autoStage({ status: "ready", guide: { steps: [{ place: "受付", floor: null, what: "出す", note: null }], done: [], at: "" } })).toBe("guide");
    expect(autoStage({ status: "ready", guide: { steps: [{ place: "受付", floor: null, what: "出す", note: null }], done: [0], at: "" } })).toBe("record");
    expect(autoStage({ status: "recording" })).toBe("record");
    expect(autoStage({ status: "failed" })).toBe("record");
    expect(autoStage({ status: "failed", transcript: { text: "a", segments: [], source: "text" } })).toBe("read");
    expect(autoStage({ status: "organizing" })).toBe("read");
    expect(autoStage({ status: "done" })).toBe("read");
  });

  it("家族へ送る文は、まとめ3行と次の予約だけ。次の予約は本人が確かめた日だけ（聞こえただけの日は入れない）", () => {
    const jp = (d: string) => d;
    const result = {
      summary: ["a", "b", "c", "d"],
      said: [],
      todo: [],
      nextAppointment: { said: "2週間後", month: null, day: null, afterWeeks: 2, afterDays: null, afterMonths: null, weekday: null, time: "10:30" },
      numbers: [],
      terms: [],
      questions: [],
      answered: [],
    };
    const at = "2027-06-10T03:00:00.000Z";
    const v = { date: "2027-06-10", label: "妊娠28週", result, nextDate: "2027-06-24" };
    expect(familyMessage(v, jp)).toBe("2027-06-10の健診（妊娠28週）\n・a\n・b\n・c");
    expect(familyMessage({ ...v, nextCheck: { state: "ok", date: "2027-06-24", time: "10:30", at } }, jp)).toBe(
      "2027-06-10の健診（妊娠28週）\n・a\n・b\n・c\n次の健診: 2027-06-24 10:30",
    );
    // 直した日と時刻が入る（聞こえた時刻は使わない）。言われていない時は入れない
    expect(familyMessage({ ...v, nextDate: "2027-06-25", nextCheck: { state: "fixed", date: "2027-06-25", time: "14:00", at } }, jp)).toContain("次の健診: 2027-06-25 14:00");
    expect(familyMessage({ ...v, nextDate: null, nextCheck: { state: "none", at } }, jp)).not.toContain("次の健診");
    expect(familyMessage({ date: "2027-06-10", label: "妊娠28週", result: undefined, nextDate: null }, jp)).toBe("2027-06-10の健診（妊娠28週）");
  });

  it("LINE に渡す文はさらに短い（まとめ2行・40字まで・次の健診）", () => {
    const long = "あ".repeat(60);
    const result = {
      summary: [long, "b", "c"],
      said: [],
      todo: [],
      nextAppointment: { said: "2週間後", month: null, day: null, afterWeeks: 2, afterDays: null, afterMonths: null, weekday: null, time: "10:30" },
      numbers: [],
      terms: [],
      questions: [],
      answered: [],
    };
    const v = { date: "2027-06-10", label: "妊娠28週", result, nextDate: "2027-06-24" };
    // まだ確かめていない日は、LINE の文にも入れない
    expect(lineMessage(v)).toBe(`6/10 健診（妊娠28週）\n${"あ".repeat(39)}…\nb`);
    const m = lineMessage({ ...v, nextCheck: { state: "ok", date: "2027-06-24", time: "10:30", at: "2027-06-10T03:00:00.000Z" } });
    expect(m).toBe(`6/10 健診（妊娠28週）\n${"あ".repeat(39)}…\nb\n次は 6/24 10:30`);
    expect(m.split("\n").every((l) => l.length <= 40)).toBe(true);
  });

  it("まとめが3行×40字を超えたら長いと見る", () => {
    expect(summaryTooLong(["a", "b", "c"])).toBe(false);
    expect(summaryTooLong(["a", "b", "c", "d"])).toBe(true);
    expect(summaryTooLong(["あ".repeat(41)])).toBe(true);
  });
});

describe("concernSide（第31回: 聞く事を、子・ママ・妊娠中のふり返りに分ける）", () => {
  it("子の印がある物は子", async () => {
    const { concernSide } = await import("./visit");
    expect(concernSide({ date: "2027-01-01", for: "child" }, "2026-12-01")).toBe("child");
  });
  it("生まれる前は、印の無い物はママ", async () => {
    const { concernSide } = await import("./visit");
    expect(concernSide({ date: "2026-11-03" }, null)).toBe("mother");
  });
  it("生まれた後に見ると、生まれる前の物はふり返り（ママの印でも）", async () => {
    const { concernSide } = await import("./visit");
    expect(concernSide({ date: "2026-11-03", for: "mother" }, "2027-07-26")).toBe("past");
    expect(concernSide({ date: "2026-11-03" }, "2027-07-26")).toBe("past");
  });
  it("生まれた後の印の無い古い物は子・ママの印はママ", async () => {
    const { concernSide } = await import("./visit");
    expect(concernSide({ date: "2026-11-08" }, "2025-05-02")).toBe("child");
    expect(concernSide({ date: "2027-08-10", for: "mother" }, "2027-07-26")).toBe("mother");
  });
  it("nextAgenda は、生まれた後は妊娠中の物と子の物をママの聞く事に入れない", async () => {
    const { nextAgenda } = await import("./visit");
    const plan = {
      concerns: [
        { id: "a", text: "おりもの", date: "2026-11-03", for: "mother" as const },
        { id: "b", text: "ことば", date: "2027-09-01", for: "child" as const },
        { id: "c", text: "傷の痛み", date: "2027-08-10", for: "mother" as const },
      ],
    };
    expect(nextAgenda([], plan, "2027-07-26").items.map((i) => i.id)).toEqual(["c"]);
    expect(nextAgenda([], plan, null).items.map((i) => i.id)).toEqual(["a", "c"]);
  });
});
