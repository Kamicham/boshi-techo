// 辞書: 招待で相手に送る文と、その題（app/invite/new/page.tsx）。11/5 UX「招待のリンクの言葉」。
// 送る文の言葉は、送る人の画面の言葉と別に選べる（日本語の画面の人が中国の家族を招く・中文の画面の人が日本の祖父母を招く）。
// 画面は今の言葉の辞書しか持たないので、この3つの鍵だけを lib/invite-words.ts が言葉ごとに持つ（画面の荷物に、ほかの辞書を入れない）。
// AREAS（dicts.ts）にも入れる（招待を受ける画面の見出し「母子手帳への招待」も同じ鍵）。
// 鍵は lib/invite-words.ts の inviteShareText が組む文そのもの（メールとリンクを差し込む）。書き方は lib/i18n/index.ts の頭
import type { Entries } from "..";

export default {
  母子手帳への招待: { zh: "母子健康手册的邀请", en: "Invitation to the Maternal and Child Health Handbook" },
  "母子手帳のアプリに一緒に入ってほしい。このリンクを Safari で開いて、このメール（{email}）に届くコードで入ってね。48時間で切れます。\n{link}": {
    zh: "想请你一起用母子健康手册的应用。用 Safari 打开这个链接，再用发到这个邮箱（{email}）的验证码登录吧。48小时后失效。\n{link}",
    en: "I'd like you to join me in the Maternal and Child Health Handbook app. Open this link in Safari and sign in with the code sent to this email ({email}). It expires in 48 hours.\n{link}",
  },
  "母子手帳のアプリに一緒に入ってほしい。このリンクを Safari で開いて、招待したメールに届くコードで入ってね。48時間で切れます。\n{link}": {
    zh: "想请你一起用母子健康手册的应用。用 Safari 打开这个链接，再用发到受邀邮箱的验证码登录吧。48小时后失效。\n{link}",
    en: "I'd like you to join me in the Maternal and Child Health Handbook app. Open this link in Safari and sign in with the code sent to the invited email. It expires in 48 hours.\n{link}",
  },
} satisfies Entries;
