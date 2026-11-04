// 記録の同意の画面の、版の外の言葉と決まり（版のある本文は components/settings/consent-texts.ts。ここは変えても同意を取り直さない）。
// 画面を持たない純粋な関数だけ（試験は consent-screen.test.ts）。
//
// 「守っている事」の3行は、今のコードで本当にそうなっている事だけを書く（2026-11-04 に確かめた）:
// - 見られる人: 世帯の仲間（lib/access.ts の withHousehold）。招くのは持ち主・共同の管理の人（/api/account/invite は household:admin）。
//   パートナーは共同の管理（全部見える）、祖父母などは読むだけで、母の記録は招く時に選んだ項目だけ（app/invite/new の showMother）
// - 暗号: 写真・録音のファイルは世帯ごとの鍵で暗号にしてから置く（lib/media.ts の sealForHousehold）。文字の記録はまだ（RECORD_HONEST）
// - 書き出し: アカウントの画面の「書き出す」（/api/export・record:read）。消す: 自分の分は本人が、世帯の全部は持ち主が（app/account の Delete）

export const RECORD_PROMISES = [
  "見られるのは、あなたと、あなたが招いた家族だけです（祖父母などに母の記録のどこまでを見せるかは、招く時に選べます）",
  "写真と録音（声）は、世帯ごとの鍵で暗号にして置きます（文字の記録の暗号化は準備中です）",
  "いつでも、アカウントの画面から書き出せます。あなたの分は、いつでも消せます",
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
  const waiting = d.invitations.some((i) => i.relation === "パートナー" || (i.relation === null && i.role === "admin"));
  return !waiting;
}

/** 招待の画面への道 */
export function invitePartnerHref(familyId: string): string {
  return `/invite/new?familyId=${encodeURIComponent(familyId)}`;
}
