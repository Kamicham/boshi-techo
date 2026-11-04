// 一冊のタブの、本がまだ無い時の最初の箱の言葉（画面は app/book/page.tsx）。
// 記録が少ない・0件の時は「一冊の本」を先に見せて、最初の1つを残す方へ。記録がある時は「記録を本にまとめる」。
// 「一冊」の字は小見出しの1か所だけに置き、大見出しと重ねない。

/** これより少ない記録（妊娠中）は、まず記録を足す方を主にする */
export const FEW_RECORDS = 10;

export type BookIntro =
  | { kind: "gather"; eyebrow?: undefined; title: string; sub: string; cta: string; tryMake: boolean }
  | { kind: "seed"; eyebrow: string; title: string; sub: string; cta: string }
  | { kind: "make"; eyebrow: string; title: string; sub: string; cta: string };

export function bookIntro(o: { childName?: string | null; count: number; born: boolean; isDemo: boolean }): BookIntro {
  const child = o.childName?.trim() || "赤ちゃん";
  const n = Math.max(0, o.count);
  const few = !o.born && n > 0 && n < FEW_RECORDS;
  if ((n === 0 && !o.isDemo) || few) {
    return {
      kind: "gather",
      title: `${child}に渡す、一冊の本`,
      sub: `話した事・撮った写真・家族の声がたまると、ここで本の形にまとめられます。いまは${n}件`,
      cta: n === 0 ? "最初の1つを残す" : "話す・撮るで足す",
      tryMake: n > 0,
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
