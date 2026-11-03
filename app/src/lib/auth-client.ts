// ログイン（画面側）。lib/auth.ts と同じプラグインを並べる。
// 使い方の例:
//   await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });   // コードを送る（開発ではサーバの記録に出る）
//   await authClient.signIn.emailOtp({ email, otp });                            // コードで入る
//   await authClient.passkey.addPasskey();                                       // 入った後にパスキーを登録
//   await authClient.signIn.passkey();                                           // 次からはパスキーで入る
//   await authClient.organization.create({ name: "わが家", slug: "..." });        // 世帯を作る（作った人が owner）
//   await authClient.organization.inviteMember({ email, role: "admin", organizationId });
//   await authClient.organization.acceptInvitation({ invitationId });
//   const { data: session } = useSession();
// iPhone のホーム画面のアプリでは、メールのリンクで入らない（クッキーが Safari 側に残る）。コードを入れる形だけを使う。
"use client";
import { createAuthClient } from "better-auth/react";
import { emailOTPClient, organizationClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({
  plugins: [emailOTPClient(), passkeyClient(), organizationClient()],
});

export const { useSession, signOut } = authClient;
