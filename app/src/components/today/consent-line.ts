// 下書きが「米国の Claude に送る同意」の前で断られた時の、一番上の札（と届けの束の1行目）の1行（見直し C38 の「いま」の分・2026-11-05）。
// 行を黙って消さず、同意への道を出す。同意して戻ると、今の画面で手帳がそのまま作る（usePrep は開くたびに作ってみる）。
// 同意を取らずに作る形にはしない（個人情報保護法第28条・外国にある第三者への提供の同意）。試験から読めるよう、JSX の無いこのファイルに置く。

/** 1行の言葉。mother＝まだ手帳に入っていないママの分が要る（母の分は母本人だけが押せるので、ママを手帳に入れる道へ） */
export function consentLine(noun: string, mother: boolean): string {
  return mother ? `ママが手帳に入って同意すると、手帳が${noun}を作ります` : `同意を1つすると、手帳が${noun}を作ります`;
}

/** 行き先。同意の画面は、読んで決めた後に今の画面（back）へ戻る */
export function consentHref(familyId: string, mother: boolean, back: string): string {
  const id = encodeURIComponent(familyId);
  return mother ? `/invite/new?familyId=${id}` : `/account/consent/claude?familyId=${id}&next=${encodeURIComponent(back)}`;
}
