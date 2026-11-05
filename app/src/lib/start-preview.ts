// 3つ答えた後の予告（app/start/page.tsx の Preview）の決まり（UI/UX 見直し「自分の手帳の入口」2026-11-04）。
// ① 始める前に目安が過ぎた事がある時は、それを一番上の大きな見出しにする（急かさず「今からでもできます」）。
// ② 予約がまだの妊婦健診の目安が7日以内なら「次の妊婦健診を予約する」の1行（「いま」＝components/Techo.tsx と同じ決まり）。
// 体の判断はしない。病院が言った日が正で、ここは国の標準の目安だけ（lib/prenatal.ts）。
import { jpShort } from "../components/today/dates";
import { t } from "./i18n";
import { msWords } from "./i18n/milestone-words";
import { diffDays } from "./clock";
import { prenatalState } from "./prenatal";

/** 予約を勧める窓（日）。「いま」と同じ */
export const PRENATAL_BOOK_WINDOW_DAYS = 7;

export interface BeforeLead {
  /** 「まず、◯◯（目安 ◯/◯ を過ぎています。今からでもできます）」 */
  head: string;
  /** 2件以上の時の「ほか◯件」。1件なら null */
  more: string | null;
}

/** 始める前に目安が過ぎた事から、一番上の見出しを作る。一番先（目安の日が一番早い）の1件を名指しする */
export function beforeLead(before: { plain: string; deadlineDate?: string }[], today: string): BeforeLead | null {
  const dated = before.filter((t): t is { plain: string; deadlineDate: string } => !!t.deadlineDate);
  if (dated.length === 0) return null;
  const first = [...dated].sort((x, y) => (x.deadlineDate < y.deadlineDate ? -1 : x.deadlineDate > y.deadlineDate ? 1 : 0))[0];
  return {
    head: t("まず、{what}（目安 {date} を過ぎています。今からでもできます）", { what: msWords(first.plain), date: jpShort(first.deadlineDate, today) }),
    more: dated.length > 1 ? t("ほか{n}件", { n: dated.length - 1 }) : null,
  };
}

/**
 * 予約がまだの妊婦健診の目安が今日から7日以内なら、あと何日か（0＝今日ごろ）。出さない時は null。
 * checkups は受けた日（予告では記録が無いので空）。booked は病院で次の日が決まっているか。
 */
export function prenatalBookDays(f: { dueDate: string; birthDate?: string }, today: string, checkups: string[] = [], booked = false): number | null {
  if (booked) return null;
  const next = prenatalState(f, today, checkups)?.next;
  if (!next) return null;
  const d = diffDays(next, today);
  return d >= 0 && d <= PRENATAL_BOOK_WINDOW_DAYS ? d : null;
}

/** 「今日ごろ」「あと◯日ごろ」 */
export function prenatalBookWhen(days: number): string {
  return days === 0 ? t("今日ごろ") : t("あと{n}日ごろ", { n: days });
}
