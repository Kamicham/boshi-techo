// 記録の同意の画面の、版の外の言葉と決まり（版のある本文は components/settings/consent-texts.ts。ここは変えても同意を取り直さない）。
// 画面を持たない純粋な関数だけ（試験は consent-screen.test.ts）。
//
// 「守っている事」の3行は、今のコードで本当にそうなっている事だけを書く（2026-11-05 に確かめ直した）:
// - 見られる人: 世帯の仲間だけ（lib/access.ts の withHousehold。ほかの世帯は 404）。招くのは持ち主・共同の管理の人（/api/account/invite は household:admin）。
// - 母の記録の見せる範囲（招く時の showMother）は、まだ効いていない。読むだけの人（member）には、手帳は子の頁だけを渡す（/api/techo と /api/export が
//   lib/mother-records.ts で、ママの頁・妊娠中のワクチン・お産のしかたを外す。2026-11-05）。健診（api/visit）は開けない（403）。ほかの文字の記録（話した記録・一冊・手帳に聞く・下書きなど）には
//   本人（subject_id）が付かないので、読むだけの人にも、母の記録を含めて見える。写真・声は本人ごとに絞るが、選んだ項目は見ず、1つでも選べば母の分が全部見える
//   （proxies.scope を読む所が無い。lib/access.ts の visibleSubjects）。だから「選べます」とは書かず「準備中」と書く
// - 暗号: 写真・録音のファイルは世帯ごとの鍵で暗号にしてから置く（lib/media.ts の sealForHousehold）。文字の記録はまだ（RECORD_HONEST）
// - 書き出し: アカウントの画面の「書き出す」（/api/export・record:read と media:read）
// - 消す: 本人の分を消す（/api/account/subject の DELETE → lib/households.ts の purgeSubject）は、本人の付いた行（写真・声・同意・代理）だけを消す。
//   文字の記録には本人が付かないので残る。世帯の全部は持ち主が消せる（purgeHousehold）

export const RECORD_PROMISES = [
  "見られるのは、あなたと、あなたが招いた家族だけです（招いた祖父母などには、手帳のママの頁と健診の記録を見せません。ただし今は、話した記録や一冊などには母の記録も入ります。見せる範囲を選ぶ仕組みは準備中です）",
  "写真と録音（声）は、世帯ごとの鍵で暗号にして置きます（文字の記録の暗号化は準備中です）",
  "いつでも、アカウントの画面から書き出せます。あなたの写真と声は、いつでも消せます（文字の記録を本人の分だけ消す仕組みは準備中です）",
] as const;

/** 子の分を誰が押すかの説明（画面の言葉。「法定代理人」の語は版のある本文の中だけに残す） */
export function childConsentLine(canConsent: boolean, born: boolean): string {
  const child = born ? "子" : "おなかの子";
  return canConsent ? `${child}の分は、親のあなたが代わりに同意します` : `${child}の分は、世帯の持ち主・共同の管理の人が代わりに同意します`;
}

/** 同意の後に「パートナーを手帳に入れる」を出すか（世帯の中身の一部だけを見る） */
export interface InviteView {
  role: string;
  perms: string[];
  account: { id: string } | null;
  members: { accountId: string; role: string }[];
  invitations: { role: string; relation: string | null }[];
  /** 本人（母・パートナー）。パートナーが始めた手帳では、招く相手を「ママ」と言う */
  subjects?: { kind: string; mine: boolean }[];
}

/** 招く相手の呼び方: パートナーが始めた手帳では「ママ」、ほかは「パートナー」 */
export function inviteeWord(d: InviteView | null | undefined): "ママ" | "パートナー" {
  const iAmPartner = !!d?.subjects?.some((s) => s.kind === "partner" && s.mine);
  const iAmMother = !!d?.subjects?.some((s) => s.kind === "mother" && s.mine);
  return iAmPartner && !iAmMother ? "ママ" : "パートナー";
}

/**
 * 招ける人（household:admin。作った家族のログインなし＝guest は除く）で、
 * まだパートナー（共同の管理）が世帯にいない・パートナーへの招待も返事待ちでない時だけ出す。
 */
export function canInvitePartner(d: InviteView | null | undefined): boolean {
  if (!d || d.role === "guest" || !d.perms.includes("household:admin")) return false;
  const me = d.account?.id;
  const otherAdmin = d.members.some((m) => m.accountId !== me && m.role.split(",").some((r) => r === "admin" || r === "owner"));
  if (otherAdmin) return false;
  const waiting = d.invitations.some((i) => i.relation === "パートナー" || i.relation === "ママ" || (i.relation === null && i.role === "admin"));
  return !waiting;
}

/** 招待の画面への道 */
export function invitePartnerHref(familyId: string): string {
  return `/invite/new?familyId=${encodeURIComponent(familyId)}`;
}
