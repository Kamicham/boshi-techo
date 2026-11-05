// 招待の言葉の決まり（招待のリンクを開いた画面・受ける画面・母が送る文）。
// 画面（.tsx）は vitest で読めないので、文を組む関数はここに置いて試験する（invite-words.test.ts）。
// 体の判断の言葉は使わない。招待の決まり（48時間・メールのコード・役と見せる範囲）は変えない。
import { clockAt, relabel, type FamilyDates } from "./clock";
import { isLang, t, translate, type Dict, type Lang } from "./i18n";
import inviteShare from "./i18n/dict/invite-share";
import { nameIn } from "./i18n/names";

/** 手帳の時期の言葉（例: 妊娠11週・生後3か月・1歳2か月）。予定日が無い・授かる前・2歳を過ぎた時は null（作らない） */
export function periodWord(f: FamilyDates | null | undefined, today: string): string | null {
  if (!f?.dueDate) return null;
  const c = clockAt(f, today);
  if (c.phase === "pregnant") return `妊娠${c.pregnancyWeek}週`;
  if (c.phase === "child") return c.ageDays === 0 ? "生後0日" : c.label;
  return null;
}

/**
 * 見出しで招いた人を呼ぶ言葉。本人の名前が役の名前のまま（3つの問いで作った手帳は「母」）の時は家族の言葉（ママ・パートナー）、
 * 名前が無ければ「ご家族」。中文・English の画面は、この言葉と時期を分けて受け取り、画面の言葉で組む（app/invite/[id]/page.tsx）
 */
export function inviterWord(inviterName: string | null | undefined): string {
  const name = inviterName?.trim();
  return name === "母" ? "ママ" : name === "パートナー" ? "パートナー" : name || "ご家族";
}

/** 「（呼び名）から、（時期）の母子手帳への招待です」。呼び名が無ければ「ご家族」、時期が無ければ時期を言わない */
export function inviteHeadline(inviterName: string | null | undefined, period: string | null | undefined): string {
  return `${inviterWord(inviterName)}から、${period ? `${period}の` : ""}母子手帳への招待です`;
}

/**
 * 招待を受ける画面の見出しを、画面の言葉で組む。who（inviterWord の言葉）と period（periodWord の言葉）は、
 * api/account/invite の GET が headline と分けて返す日本語（日本語の見出しを画面で読み直さない＝11/5 UX）。
 * 日本語の時は inviteHeadline と同じ字。役の名前のままの時と「ご家族」は訳し、家族が入れた呼び名は nameIn に通す（見本の家族の名前だけローマ字）
 */
export function inviteHeadlineShown(who: string | null | undefined, period: string | null | undefined): string {
  const whoJa = who?.trim() || inviterWord(null);
  const w = ["ご家族", "ママ", "パートナー"].includes(whoJa) ? t(whoJa) : nameIn(whoJa);
  if (!period) return t("{who}から、母子手帳への招待です", { who: w });
  const week = /^妊娠(\d+)週$/.exec(period);
  const p = week ? t("妊娠{w}週", { w: Number(week[1]) }) : relabel(period);
  return t("{who}から、{period}の母子手帳への招待です", { who: w, period: p });
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
  // 読むだけの人にも、今は母の記録を含む文字の記録が見える（手帳の頁は子の分だけ・健診は開けない。inviteSeeLine の注を見る）。見える物を少なく言わない
  return ["手帳の記録と子の写真を見られます", "みんなの章に、写真・声・手紙を足せます", "記録を足す・直すはできません"];
}

/**
 * 受ける画面の「見られる物」。今のコードで本当に見える物だけを書く（2026-11-05 に確かめ直した）。
 * - 共同の管理（admin・owner）は全部（lib/access.ts: owner・admin は本人を全員見られる）
 * - 読むだけ（member）: 手帳は子の頁だけ（/api/techo と /api/export が lib/mother-records.ts で、ママの頁・妊娠中のワクチン・お産のしかたを外す。2026-11-05）。
 *   健診（api/visit）は開けない（403。子の健診も一緒に隠れる）。
 *   ほかの文字の記録（話した記録・一冊・手帳に聞く・下書きなど）には本人（subject_id）が付かないので、母の記録も含めて見える。
 *   写真・声は本人ごとに絞る（子の分。母が項目を1つでも選ぶと、母の分も全部。lib/access.ts の visibleSubjects は proxies.scope を見ない）
 */
export function inviteSeeLine(role: string, motherItems: readonly string[]): string {
  if (role === "admin" || role === "owner") return "手帳の全部（母の記録も）を見て、足して、家族を招けます";
  return `見られる物: 子の手帳の記録と、${motherItems.length ? "子と母" : "子"}の写真・声（手帳のママの頁と健診は見えません。話した記録や一冊などには、今は母の記録も入ります。記録を足す・直すはできません）`;
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

// ───────── 招待のリンクの言葉（11/5 UX・統括 OK） ─────────
// 送る人は「送る文の言葉」を日本語・中文・English から選べる（最初は送る人の画面の言葉）。リンクにもその言葉の印を付け、
// 開いた人の画面もその言葉で開く（日本語の画面の人が中国の家族を招く・中文の画面の人が日本の祖父母を招く時に、どちらの向きでも読めるように）。
// リンクに付けるのは言葉の印（ja・zh・en）だけ。呼び名などは入れない（統括 11/5）。

/** 招待のリンクに付ける言葉の印の名前（/invite/<id>?lang=zh） */
export const INVITE_LANG_PARAM = "lang";

function pickShare(lang: "zh" | "en"): Dict {
  const out: Record<string, string> = {};
  for (const [key, e] of Object.entries(inviteShare)) if (e[lang]) out[key] = e[lang]!;
  return out;
}
/** 送る文の辞書（dict/invite-share.ts の3つの鍵だけ）。送る文の言葉は画面の言葉と別に選ぶので、画面の辞書（今の言葉の分だけ）に頼らない */
const SHARE_DICTS: Readonly<Record<Lang, Dict>> = { ja: {}, zh: pickShare("zh"), en: pickShare("en") };

/** 相手にそのまま送る文を lang の言葉で（日本語は inviteShareText と同じ字） */
export function inviteShareTextIn(lang: Lang, email: string, link: string): string {
  const mail = email.trim();
  return translate(SHARE_DICTS[lang], inviteShareText(mail ? "{email}" : "", "{link}"), mail ? { email: mail, link } : { link });
}

/** 送る時の題（ほかのアプリで送る時に、メールの件名などに使われる）を lang の言葉で */
export function inviteShareTitleIn(lang: Lang): string {
  return translate(SHARE_DICTS[lang], "母子手帳への招待");
}

/** 招待のリンク（作った時に返る /invite/<id> に origin を付けた物）に、開いた人の画面の言葉の印を付ける */
export function inviteLinkIn(link: string, lang: Lang): string {
  const u = new URL(link);
  u.searchParams.set(INVITE_LANG_PARAM, lang);
  return u.toString();
}

/**
 * 招待のリンクを開いた時に、画面の言葉を変えるか（変える先の言葉。変えない時は null）。順は「本人のクッキー → リンクの言葉 → ブラウザの言葉」:
 * - 本人が選んだ言葉（クッキー）があれば変えない
 * - ログインしている人（送った本人が確かめに開いた時・ほかの手帳ですでに使っている人）も変えない
 * - 言葉の印が無い・知らない値・今の画面と同じ時も変えない（ブラウザの言葉は、根の layout がもう選んでいる）
 * 変える時は、クッキーに残して読み直す（app/invite/[id]/page.tsx。続くログイン・同意の画面も、その言葉で開くように）
 */
export function inviteLangToSwitch(linkLang: string | null | undefined, cookieLang: Lang | null, signedIn: boolean, now: Lang): Lang | null {
  if (cookieLang || signedIn || !isLang(linkLang) || linkLang === now) return null;
  return linkLang;
}

/** LINE で送る（LINE の共有の URL） */
export const lineShareUrl = (text: string) => `https://line.me/R/share?text=${encodeURIComponent(text)}`;
