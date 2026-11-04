// だれの事か・だれの職場か（見直し C09・2026-11-05）。画面とサーバの両方が読む（server-only にしない）。
// - 職場は人ごとに持つ（keep.workBy＝家族の id → 職場）。11/3 からある keep.work は「母（いなければ家族の最初の人）」の職場として読む。
//   移し替えはしない（前の版で書いた記録は、そのまま読める）。母の職場を直した時も keep.work に書く（splitWorkInput）
// - その事の担当: 予定表の担当（母・パートナー）。家族みんなの事は「誰がやる？」で決めた人（2人で・まだ決めていない時は決まらない）
import type { Family, Member } from "./demo-family";

/** 職場（職場あての下書きの空欄を埋める・Claude に渡す） */
export interface Work {
  company?: string;
  /** 部署名 */
  dept?: string;
  boss?: string;
  /** 上司のメールアドレス */
  email?: string;
  /** 人事の担当（名前） */
  hr?: string;
  /** 人事のメールアドレス */
  hrEmail?: string;
}

export const WORK_FIELDS = ["company", "dept", "boss", "email", "hr", "hrEmail"] as const satisfies readonly (keyof Work)[];

type Members = Pick<Family, "members">;
type HasWork = { work?: Work; workBy?: Record<string, Work> };

/** 11/3 からある keep.work の持ち主（母。いなければ家族の最初の人） */
export function legacyWorkOwner(family: Members): Member | null {
  return family.members.find((m) => m.role === "母") ?? family.members[0] ?? null;
}

/** その人の職場（前からの欄の持ち主なら keep.work、ほかの人は keep.workBy）。分からなければ undefined */
export function workOf(keep: HasWork, family: Members, memberId?: string | null): Work | undefined {
  if (!memberId) return undefined;
  const owner = legacyWorkOwner(family);
  const w = owner?.id === memberId ? keep.work : keep.workBy?.[memberId];
  return w && Object.values(w).some((v) => typeof v === "string" && v.trim()) ? w : undefined;
}

const str200 = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 200) : undefined);

/** 口から来た職場を整える（文字だけ・前後の空白を取る・200字まで）。送らなかった欄は undefined＝今のまま、空の文字は消す（lib/keep.ts の remember） */
export function cleanWork(w: object): Work {
  const x = w as Record<string, unknown>;
  return Object.fromEntries(WORK_FIELDS.map((f) => [f, str200(x[f])])) as Work;
}

/**
 * 人ごとの職場の入力（家族の id → 職場）を、「いつもの」の欄へ振り分ける。
 * 前からの欄の持ち主（母。いなければ家族の最初の人）の分は work（11/3 からの記録と同じ欄＝前の版でも読める）、ほかの人は workBy。
 * その家族にいない人の分は捨てる（10人まで）
 */
export function splitWorkInput(family: Members, input: unknown): { work?: Work; workBy?: Record<string, Work> } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const owner = legacyWorkOwner(family);
  const ids = new Set(family.members.map((m) => m.id));
  const out: { work?: Work; workBy?: Record<string, Work> } = {};
  const by: Record<string, Work> = {};
  const entries = Object.entries(input as Record<string, unknown>).filter(([id, w]) => ids.has(id) && !!w && typeof w === "object" && !Array.isArray(w));
  for (const [id, w] of entries.slice(0, 10)) {
    if (id === owner?.id) out.work = cleanWork(w as object);
    else by[id] = cleanWork(w as object);
  }
  if (Object.keys(by).length) out.workBy = by;
  return out;
}

/** 職場を覚えている人ごとに（名前つき。手帳に聞く・気づきに渡す） */
export function worksByMember(keep: HasWork, family: Members): { member: Member; work: Work }[] {
  return family.members.flatMap((member) => {
    const work = workOf(keep, family, member.id);
    return work ? [{ member, work }] : [];
  });
}

/**
 * その事の担当の人。who は家族に当てはめた後の担当（scheduleFor の行の who）。
 * 家族みんなの事は「誰がやる？」で決めた人（assign）。2人で・まだ決めていない時は null
 */
export function assigneeOf(task: { id: string; who: "家族" | "母" | "パートナー" }, family: Members, assign?: Record<string, string>): Member | null {
  if (task.who === "家族") {
    const v = assign?.[task.id];
    if (!v || v === "together") return null;
    return family.members.find((m) => m.id === v) ?? null;
  }
  return family.members.find((m) => m.role === task.who) ?? null;
}
