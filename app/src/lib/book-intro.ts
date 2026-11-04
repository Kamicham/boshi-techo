// 一冊のタブの、本がまだ無い時の最初の箱の言葉（画面は app/book/page.tsx）。
// 記録が少ない・0件の時は「一冊の本」を先に見せて、最初の1つを残す方へ。記録がある時は「記録を本にまとめる」。
// 「一冊」の字は小見出しの1か所だけに置き、大見出しと重ねない。

import { PUBLIC_UI } from "./trial-words";

/** これより少ない記録（妊娠中）は、まず記録を足す方を主にする */
export const FEW_RECORDS = 10;

/**
 * 一冊が0件の本物の家族へ「見本の家族の一冊を読む ›」（見直し C38 ④・2026-11-05）。
 * 押すと見本の家族へ切り替え、Claude が前に書いた見本の一冊のうち、いちばん長い2歳の一冊の日へ合わせる（lib/demo-books.json の一番後ろの asOf）。
 * 戻るのは上の帯の切り替え（わが家）から
 */
export const SAMPLE_BOOK_DAY = "2029-04-26";
export const SAMPLE_BOOK_LABEL = "見本の家族の一冊を読む ›";
/** 押した印（見本の家族へ切り替えた後に、一冊の画面がその日へ合わせて消す。この端末のこのタブだけ） */
export const SAMPLE_BOOK_KEY = "boshi.readSampleBook";
/**
 * 見本の一冊が無い日に、見本の答えで一冊を作ろうとした時（lib/book.ts の makeBook。中身の無い一冊を作らず、保存もしない）。
 * 見本の一冊は lib/demo-books.json の3冊（妊娠30週・生後2か月・2歳＝scripts/make-demo-books.mts）
 */
export const SAMPLE_BOOK_LATER = "この日までの見本の一冊は、まだありません。見本の家族の妊娠30週・生後2か月・2歳の日で、前に Claude が書いた一冊を読めます";

export type BookIntro =
  | { kind: "gather"; eyebrow?: undefined; title: string; sub: string; cta: string; tryMake: boolean; sample: boolean }
  | { kind: "seed"; eyebrow: string; title: string; sub: string; cta: string }
  | { kind: "make"; eyebrow: string; title: string; sub: string; cta: string }
  /** 体験版（Claude を呼ばない）: 作る代わりに、前に Claude が書いた見本の一冊の日へ（SAMPLE_BOOK_DAY） */
  | { kind: "read"; eyebrow: string; title: string; sub: string; cta: string };

export function bookIntro(o: { childName?: string | null; count: number; born: boolean; isDemo: boolean; trial?: boolean }): BookIntro {
  const child = o.childName?.trim() || "赤ちゃん";
  const n = Math.max(0, o.count);
  // 体験版は Claude を呼ばないので、ここでは本を作らない。記録がある日は、前に Claude が書いた見本の一冊の日へ（記録が0件なら、下の「見本の記録を入れる」）
  if ((o.trial ?? (PUBLIC_UI && o.isDemo)) && n > 0) {
    return {
      kind: "read",
      eyebrow: `${child}への一冊`,
      title: "記録を本にまとめる",
      sub: "この体験版では Claude を呼ばないので、ここでは本を作りません。見本の家族の妊娠30週・生後2か月・2歳の日で、前に Claude がこの家族の記録から書いた一冊を読めます",
      cta: "2歳の日の一冊を読む ›",
    };
  }
  const few = !o.born && n > 0 && n < FEW_RECORDS;
  if ((n === 0 && !o.isDemo) || few) {
    return {
      kind: "gather",
      title: `${child}に渡す、一冊の本`,
      sub: `話した事・撮った写真・家族の声がたまると、ここで本の形にまとめられます。いまは${n}件`,
      cta: n === 0 ? "最初の1つを残す" : "話す・撮るで足す",
      tryMake: n > 0,
      // 0件の日は、たまった後の姿を先に見られるように（見本の家族の一冊）
      sample: n === 0,
    };
  }
  if (n === 0) {
    return { kind: "seed", eyebrow: `${child}への一冊`, title: "記録を本にまとめる", sub: "見本の家族の記録を入れると、本の形にまとめられます", cta: "見本の記録を入れる" };
  }
  return {
    kind: "make",
    eyebrow: `${child}への一冊`,
    title: "記録を本にまとめる",
    sub: `${n}件の記録を、AI（Claude）が時期ごとの章に分けて、本の形にまとめます（数分かかります）。画面で読めて、何度でも作り直せます`,
    cta: "本にまとめてみる",
  };
}

/** 手帳のタブから来た時だけ「‹ 手帳へ」を出す（/book?from=techo）。下のタブから開いた時は出さない */
export function cameFromTecho(search: string): boolean {
  return new URLSearchParams(search).get("from") === "techo";
}

/** みんなの章の声の行: 見出しに名前があるので札は付けず「ばあばの声（17秒）」 */
export function minnaVoiceLabel(name: string, sec?: number | null): string {
  const s = sec && sec > 0 ? `（${Math.max(1, Math.round(sec))}秒）` : "";
  return `${name}の声${s}`;
}
