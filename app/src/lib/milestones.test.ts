import { describe, expect, it } from "vitest";
import { PREGNANCY_ONLY, daycarePlan, deadlineKindOf, schoolEntry, scheduleFor, statusOf } from "./milestones";
import type { Situation } from "./situation";

// 予定日 2027-05-10 の家族（すべて作った家族）
const due = "2027-05-10";
const both = [{ role: "母" }, { role: "パートナー" }];
const ids = (situation?: Situation, members = both, birthDate?: string) => scheduleFor({ dueDate: due, birthDate, situation, members }).map((m) => m.id);

describe("家族の形で予定を組み替える", () => {
  it("わからない時は今までどおり（職場の事も育休も出る）", () => {
    const x = ids(undefined);
    for (const id of ["tell-work", "maternity-leave", "tell-work-birth", "partner-leave", "child-allowance"]) expect(x).toContain(id);
    for (const id of ["child-allowance-change", "single-child-support", "satogaeri-hospital", "nenkin-maternity-exempt"]) expect(x).not.toContain(id);
  });

  it("仕事のない母には職場の事を出さない", () => {
    const x = ids({ motherWork: "仕事なし", partnerWork: "会社員・公務員" });
    for (const id of ["tell-work", "maternity-leave", "nenkin-maternity-exempt", "tell-work-birth"]) expect(x).not.toContain(id);
    // パートナーが会社員なら、パートナーの職場に生まれた事を伝える（扶養・育休の入口）は残す
    expect(x).toContain("partner-tell-work-birth");
    const none = ids({ motherWork: "仕事なし", partnerWork: "仕事なし" });
    expect(none).not.toContain("tell-work-birth");
    expect(none).not.toContain("partner-tell-work-birth");
  });

  it("職場の事は働いている人に振る（「家族」にしない）", () => {
    const s = scheduleFor({ dueDate: due, members: both });
    expect(s.find((m) => m.id === "tell-work-birth")?.who).toBe("母");
    expect(s.find((m) => m.id === "partner-tell-work-birth")?.who).toBe("パートナー");
    for (const m of s.filter((x) => x.kind === "仕事")) expect(m.who).not.toBe("家族");
    // パートナーのいない家族には、パートナーの職場の事を出さない
    expect(ids(undefined, [{ role: "母" }])).not.toContain("partner-tell-work-birth");
  });

  it("消した項目（健診のお知らせ・入院の荷物・休む日・一冊）は出さない", () => {
    const x = ids(undefined, both, due);
    for (const id of ["checkup-plan", "checkup-biweekly", "checkup-weekly", "hospital-bag", "partner-days-off", "the-book"]) expect(x).not.toContain(id);
  });

  it("出産で辞める母: 職場に伝えるは残し、退職の日と保険の切り替えを足す", () => {
    const x = ids({ motherWork: "出産で辞める" });
    for (const id of ["tell-work", "mother-quit-date", "mother-insurance-switch"]) expect(x).toContain(id);
  });

  it("自営の母: 国民年金と国保の産前産後の免除。予定日の6か月前から", () => {
    const s = scheduleFor({ dueDate: due, situation: { motherWork: "自営・フリー" }, members: both });
    expect(s.find((m) => m.id === "nenkin-maternity-exempt")?.startDate).toBe("2026-11-10");
    expect(s.map((m) => m.id)).toContain("kokuho-maternity-exempt");
    expect(s.map((m) => m.id)).not.toContain("tell-work");
  });

  it("パートナーのいない家族: パートナーの担当は母へ。育休は出さず、ひとり親の制度を足す", () => {
    const s = scheduleFor({ dueDate: due, members: [{ role: "母" }] });
    expect(s.some((m) => m.who === "パートナー")).toBe(false);
    expect(s.find((m) => m.id === "birth-registration")?.who).toBe("母");
    expect(s.map((m) => m.id)).not.toContain("partner-leave");
    expect(s.map((m) => m.id)).toEqual(expect.arrayContaining(["single-child-support", "single-medical"]));
  });

  it("育休を取らない・自営のパートナー: 育休の事を出さない", () => {
    for (const sit of [{ partnerLeave: "取らない" }, { partnerWork: "自営・フリー" }] as Situation[]) expect(ids(sit)).not.toContain("partner-leave");
    expect(ids({ partnerLeave: "未定" })).toContain("partner-leave");
  });

  it("第2子: 児童手当は額を変える届け。上の子の預け先を足す", () => {
    const x = ids({ olderChildren: true });
    expect(x).not.toContain("child-allowance");
    expect(x).toEqual(expect.arrayContaining(["child-allowance-change", "older-child-care"]));
  });

  it("里帰り: 産院の予約・健診代の申請・訪問の依頼。出生届は里帰り先でも", () => {
    const s = scheduleFor({ dueDate: due, situation: { satogaeri: true }, members: both });
    expect(s.map((m) => m.id)).toEqual(expect.arrayContaining(["satogaeri-hospital", "satogaeri-checkup-refund", "satogaeri-visit"]));
    expect(s.find((m) => m.id === "birth-registration")?.hint).toContain("里帰り先");
    expect(ids({ satogaeri: false })).not.toContain("satogaeri-hospital");
  });

  it("双子: 見出しに（2人分）。産休は14週前から", () => {
    const s = scheduleFor({ dueDate: due, situation: { babies: 2 }, members: both });
    expect(s.find((m) => m.id === "birth-registration")?.plain).toBe("出生届を出す（2人分）");
    expect(s.find((m) => m.id === "maternity-leave")?.startDate).toBe("2027-02-01");
  });
});

describe("時期", () => {
  it("まだ生まれていない間は、予定日を過ぎても生まれてからの事は「まだ先」", () => {
    const m = scheduleFor({ dueDate: due }).find((x) => x.id === "birth-registration")!;
    expect(m.awaitingBirth).toBe(true);
    expect(statusOf(m, "2027-05-30", new Set())).toBe("まだ先");
  });

  it("生まれた後は、妊娠中だけの事は「過ぎた」", () => {
    const s = scheduleFor({ dueDate: due, birthDate: "2027-03-20" });
    for (const m of s.filter((x) => PREGNANCY_ONLY.has(x.id))) expect(statusOf(m, "2027-03-21", new Set())).toBe("過ぎた");
    expect(statusOf(s.find((x) => x.id === "birth-registration")!, "2027-03-21", new Set())).toBe("今やる");
  });

  it("期限の印: 妊娠の届けは目安、出生届は期限", () => {
    const s = scheduleFor({ dueDate: due });
    expect(deadlineKindOf(s.find((x) => x.id === "pregnancy-report")!)).toBe("目安");
    expect(deadlineKindOf(s.find((x) => x.id === "birth-registration")!)).toBe("期限");
  });

  it("赤ちゃんの予防接種と健診は「健診」で、行き先は小児科など（役所ではない）", () => {
    const s = scheduleFor({ dueDate: due, birthDate: due });
    for (const id of ["vaccines-start", "vaccines-3m", "vaccines-4m", "bcg", "vaccines-7m", "first-birthday-vaccines", "checkup-9-10m"]) {
      const m = s.find((x) => x.id === id)!;
      expect(m.kind).toBe("健診");
      expect(m.needsLocal).toBe(true);
    }
    expect(s.find((x) => x.id === "bcg")?.deadlineDate).toBe("2028-05-09");
  });
});

describe("1000日の先（2歳を過ぎてから）", () => {
  const s = scheduleFor({ dueDate: due, birthDate: due, members: both });
  const at = (id: string) => s.find((x) => x.id === id)!;
  it("3歳児健診: 満3歳から満4歳になるまで（母子保健法第12条）", () => {
    expect(at("checkup-3y").startDate).toBe("2030-05-10");
    expect(at("checkup-3y").deadlineDate).toBe("2031-05-09");
    expect(at("checkup-3y").basis).toContain("母子保健法第12条");
  });
  it("日本脳炎: 1期の初回は3歳・追加は4歳", () => {
    expect(at("je-vaccine-1").startDate).toBe("2030-05-10");
    expect(at("je-vaccine-1-booster").startDate).toBe("2031-05-10");
  });
  it("麻しん風しん（MR）2期: 小学校に入る前の1年間（4月1日生まれは1学年早い）", () => {
    expect(schoolEntry("2027-05-10")).toBe("2034-04-01");
    expect(schoolEntry("2027-04-02")).toBe("2034-04-01");
    expect(schoolEntry("2027-04-01")).toBe("2033-04-01");
    expect(schoolEntry("2028-03-31")).toBe("2034-04-01");
    expect(at("mr-vaccine-2").startDate).toBe("2033-04-01");
    expect(at("mr-vaccine-2").deadlineDate).toBe("2034-03-31");
  });
  it("2歳を過ぎても「まだ先」の事がある（「1000日を過ぎました」の後も次が出る）", () => {
    const later = s.filter((m) => statusOf(m, "2029-06-01", new Set()) === "まだ先").map((m) => m.id);
    expect(later).toEqual(expect.arrayContaining(["checkup-3y", "je-vaccine-1", "mr-vaccine-2"]));
  });
  it("接種の呼び方を手帳とそろえる（水ぼうそう（水痘）・麻しん風しん（MR））", () => {
    expect(at("vaccines-18m").plain).toBe("水ぼうそう（水痘）の2回目を受ける");
    expect(at("first-birthday-vaccines").hint).toContain("麻しん風しん（MR）");
    for (const m of s) {
      expect(m.plain.length, m.plain).toBeLessThanOrEqual(20);
      expect(m.hint.length, m.hint).toBeLessThanOrEqual(40);
    }
  });
});

describe("保育園（4月入園）", () => {
  const work = { motherWork: "会社員・公務員", partnerWork: "会社員・公務員" } as Situation;
  it("生後6か月を過ぎて最初の4月に入る段取り（前の年の秋に申し込む）", () => {
    const p = daycarePlan("2027-05-10");
    expect(p.entry).toBe("2028-04-01");
    expect(p.apply).toEqual({ start: "2027-10-01", deadline: "2027-11-30" });
    expect(p.cert.start).toBe("2027-09-01");
    expect(p.cert.deadline! < p.apply.deadline!).toBe(true);
    expect(p.back).toEqual({ start: "2028-02-01", deadline: "2028-03-01" });
    // 秋生まれは翌々年の4月（1歳児クラス）。申し込みは生後1か月より前に置かない
    expect(daycarePlan("2027-10-15").entry).toBe("2029-04-01");
    const sep = daycarePlan("2027-09-20");
    expect(sep.entry).toBe("2028-04-01");
    expect(sep.apply.start).toBe("2027-10-20");
  });
  it("共働きに出す。申し込み・両方の就労証明書・復職の日", () => {
    const s = scheduleFor({ dueDate: due, birthDate: due, situation: work, members: both });
    const x = s.map((m) => m.id);
    expect(x).toEqual(expect.arrayContaining(["daycare-apply", "daycare-cert-mother", "daycare-cert-partner", "return-to-work"]));
    const apply = s.find((m) => m.id === "daycare-apply")!;
    expect(apply.startDate).toBe("2027-10-01");
    expect(apply.needsLocal).toBe(true);
    expect(deadlineKindOf(apply)).toBe("目安");
    expect(apply.basis).toContain("町で確かめる");
    expect(s.find((m) => m.id === "daycare-research")?.startDate).toBe("2027-06-10");
  });
  it("母が仕事なし・出産で辞める・パートナーが仕事なしなら出さない。ひとりで働く母には出す（パートナーの分は無し）", () => {
    for (const sit of [{ motherWork: "仕事なし" }, { motherWork: "出産で辞める" }, { motherWork: "会社員・公務員", partnerWork: "仕事なし" }] as Situation[]) {
      expect(ids(sit)).not.toContain("daycare-apply");
    }
    const single = ids({ motherWork: "パート・派遣" }, [{ role: "母" }]);
    expect(single).toEqual(expect.arrayContaining(["daycare-apply", "daycare-cert-mother"]));
    expect(single).not.toContain("daycare-cert-partner");
    // 自営の母は申し込むが、職場に頼む就労証明書は無い
    const self = ids({ motherWork: "自営・フリー", partnerWork: "自営・フリー" });
    expect(self).toContain("daycare-apply");
    expect(self).not.toContain("daycare-cert-mother");
  });
});

describe("小さく生まれた子", () => {
  const of = (birthWeightG?: number) => scheduleFor({ dueDate: due, birthDate: due, members: both, birthWeightG }).map((m) => m.id);
  it("2500g 未満で届け、2000g 以下で養育医療。わからなければ出さない", () => {
    expect(of(undefined)).not.toContain("low-birth-weight-report");
    expect(of(3100)).not.toContain("low-birth-weight-report");
    expect(of(2400)).toContain("low-birth-weight-report");
    expect(of(2400)).not.toContain("preterm-medical");
    expect(of(1900)).toEqual(expect.arrayContaining(["low-birth-weight-report", "preterm-medical"]));
    const m = scheduleFor({ dueDate: due, birthDate: due, birthWeightG: 1900 }).find((x) => x.id === "low-birth-weight-report")!;
    expect(m.basis).toContain("母子保健法第18条");
  });
});

describe("授かる前", () => {
  it("今日が最終月経の日より前なら、どの事も日付で出さない（「授かったら」）", () => {
    const s = scheduleFor({ dueDate: due }, "2026-07-01");
    expect(s.every((m) => m.awaitingPregnancy)).toBe(true);
    expect(statusOf(s.find((m) => m.id === "pregnancy-report")!, "2026-07-01", new Set())).toBe("まだ先");
    // 授かった後（最終月経の日から）は今までどおり
    expect(scheduleFor({ dueDate: due }, "2026-08-03").some((m) => m.awaitingPregnancy)).toBe(false);
    expect(scheduleFor({ dueDate: due }).some((m) => m.awaitingPregnancy)).toBe(false);
  });
});

describe("妊婦のための支援給付の2回目（第1波③）", () => {
  const find = (s: ReturnType<typeof scheduleFor>) => s.find((m) => m.id === "pregnancy-support-2")!;
  it("予定日の8週前から、2年の期限で出る", () => {
    const m = find(scheduleFor({ dueDate: "2027-06-10", members: both }));
    expect(m.startDate).toBe("2027-04-15");
    expect(m.deadlineDate! > "2029-04-01" && m.deadlineDate! < "2029-04-20").toBe(true);
    expect(deadlineKindOf(m)).toBe("期限");
  });
  it("双子はおなかの子の数が付き、1人の家族には付かない", () => {
    expect(find(scheduleFor({ dueDate: "2027-06-10", situation: { babies: 2 }, members: both })).plain).toContain("2人分");
    expect(find(scheduleFor({ dueDate: "2027-06-10", members: both })).plain).not.toContain("人分");
  });
  it("8週前より早く生まれたら、生まれた日から今やる", () => {
    const s = scheduleFor({ dueDate: "2027-06-10", birthDate: "2027-03-20", members: both }, "2027-03-25");
    const m = find(s);
    expect(m.startDate).toBe("2027-03-20");
    expect(statusOf(m, "2027-03-25", new Set())).toBe("今やる");
  });
  it("生まれた後も「過ぎた」にならない（妊娠中だけの事ではない）", () => {
    const s = scheduleFor({ dueDate: "2027-06-10", birthDate: "2027-06-08", members: both }, "2027-07-01");
    expect(statusOf(find(s), "2027-07-01", new Set())).toBe("今やる");
  });
});

// 期限の言い方は、損で脅さず「いつまでに出すと、何が受け取れるか」で言う（総点検 0-6・2026-11-04。夜中にひとりで読む親を脅さない）
describe("損で脅さない", () => {
  it("児童手当の一言は、いつまでに出すと何が受け取れるか。30家族のどの予定の言葉も「もらえません」「損」「遅れると」を使わない", async () => {
    const { SIM_FAMILIES } = await import("../sim/families");
    let allowance = 0;
    for (const f of SIM_FAMILIES) {
      for (const m of scheduleFor(f, f.birthDate ?? f.dueDate)) {
        expect(`${m.title}・${m.plain}・${m.hint}`, `${f.id} ${m.id}`).not.toMatch(/もらえません|もらえない|損|遅れると/);
        if (m.id !== "child-allowance") continue;
        allowance++;
        expect(m.hint).toBe("生まれた日の翌日から15日以内に出すと、翌月分から受け取れます");
      }
    }
    expect(allowance).toBeGreaterThan(0);
  });
});
