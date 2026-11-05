// 招待の言葉の決まり（招待のリンクを開いた画面・受ける画面・母が送る文）。
// 画面（.tsx）は vitest で読めないので、文を組む関数はここに置いて試験する（invite-words.test.ts）。
// 体の判断の言葉は使わない。招待の決まり（48時間・メールのコード・役と見せる範囲）は変えない。
import { clockAt, type FamilyDates } from "./clock";

/** 手帳の時期の言葉（例: 妊娠11週・生後3か月・1歳2か月）。予定日が無い・授かる前・2歳を過ぎた時は null（作らない） */
export function periodWord(f: FamilyDates | null | undefined, today: string): string | null {
  if (!f?.dueDate) return null;
  const c = clockAt(f, today);
  if (c.phase === "pregnant") return `妊娠${c.pregnancyWeek}週`;
  if (c.phase === "child") return c.ageDays === 0 ? "生後0日" : c.label;
  return null;
}

/** 「（呼び名）から、（時期）の母子手帳への招待です」。呼び名が無ければ「ご家族」、時期が無ければ時期を言わない */
export function inviteHeadline(inviterName: string | null | undefined, period: string | null | undefined): string {
  // 本人の名前が役の名前のまま（3つの問いで作った手帳は「母」）の時は、家族の言葉で呼ぶ
  const name = inviterName?.trim();
  const who = name === "母" ? "ママ" : name === "パートナー" ? "パートナー" : name || "ご家族";
  return `${who}から、${period ? `${period}の` : ""}母子手帳への招待です`;
}

/** メールの一部を伏せる（例: papa@example.com → p…@e…） */
export function maskEmail(email: string | null | undefined): string {
  const e = String(email ?? "").trim();
  const at = e.lastIndexOf("@");
  if (at < 1 || at === e.length - 1) return e ? `${e[0]}…` : "";
  return `${e[0]}…@${e[at + 1]}…`;
}

/** 入ると何ができるか（ログイン前の画面）。admin＝共同の管理（パートナー）、それ以外＝読むだけ（祖父母など） */
export function inviteCanLines(role: string): string[] {
  if (role === "admin" || role === "owner")
    return ["やる事を二人で分けられます", "あなたの番の手続き（育休など）を、手帳が先に用意します", "健診の日と、先生に聞く事が見られます"];
  // 読むだけの人にも、今は母の記録を含む文字の記録が見える（手帳の頁は子の分だけ。inviteSeeLine の注を見る）。見える物を少なく言わない
  return ["手帳の記録と子の写真を見られます", "みんなの章に、写真・声・手紙を足せます", "記録を足す・直すはできません"];
}

/**
 * 受ける画面の「見られる物」。今のコードで本当に見える物だけを書く（2026-11-05 に確かめ直した）。
 * - 共同の管理（admin・owner）は全部（lib/access.ts: owner・admin は本人を全員見られる）
 * - 読むだけ（member）: 手帳は子の頁だけ（/api/techo と /api/export が lib/mother-records.ts で、ママの頁・妊娠中のワクチン・お産のしかたを外す。2026-11-05）。
 *   ほかの文字の記録（話した記録・一冊・手帳に聞く・下書きなど）には本人（subject_id）が付かないので、母の記録も含めて見える。
 *   写真・声は本人ごとに絞る（子の分。母が項目を1つでも選ぶと、母の分も全部。lib/access.ts の visibleSubjects は proxies.scope を見ない）
 */
export function inviteSeeLine(role: string, motherItems: readonly string[]): string {
  if (role === "admin" || role === "owner") return "手帳の全部（母の記録も）を見て、足して、家族を招けます";
  return `見られる物: 子の手帳の記録と、${motherItems.length ? "子と母" : "子"}の写真・声（手帳のママの頁は見えません。話した記録や一冊などには、今は母の記録も入ります。記録を足す・直すはできません）`;
}

/** 母が選んだ見せる項目の注記（読むだけの招待で、母が項目を選んだ時だけ）。項目ごとの選び分けはまだ効かないので「準備中」と書く */
export function inviteMotherItemsLine(role: string, motherItems: readonly string[]): string | null {
  if (role === "admin" || role === "owner" || !motherItems.length) return null;
  return `母が選んだ${motherItems.map((x) => `「${x}」`).join("")}だけを見せる仕組みは準備中です`;
}

/** 母が相手にそのまま送る文（リンクは最後の行に） */
export function inviteShareText(email: string, link: string): string {
  const mail = email.trim();
  return `母子手帳のアプリに一緒に入ってほしい。このリンクを Safari で開いて、${mail ? `このメール（${mail}）` : "招待したメール"}に届くコードで入ってね。48時間で切れます。\n${link}`;
}

/** LINE で送る（LINE の共有の URL） */
export const lineShareUrl = (text: string) => `https://line.me/R/share?text=${encodeURIComponent(text)}`;
