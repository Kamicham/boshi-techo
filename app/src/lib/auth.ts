// ログイン（サーバ側）。Better Auth を、今の SQLite のファイル（lib/db.ts の DATA_DIR/boshi.db）に載せる。
// - 入り方: メールの6桁コード（emailOTP・5分で切れる・3回まちがえると無効）＋パスキー
// - 世帯: organization のプラグイン。organization の id ＝ 世帯の id（households.id・docs.family_id）
// - セッションの期限は30日（健診の録音の途中で切れないよう長く）
// - Better Auth の表（user・session・account・verification・organization・member・invitation・passkey）は、
//   初めて使う時に getMigrations().runMigrations() で同じファイルに作る（authReady）。手で migrate は打たなくてよい
// - メールの送り手は差し口だけ（setMailSender）。決めるまではサーバの記録（console）にコードを出す
// 画面からは lib/auth-client.ts を使う。API での確かめは lib/access.ts の withHousehold を通す。
import "server-only";
import { betterAuth } from "better-auth";
import { emailOTP, organization } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { getMigrations } from "better-auth/db/migration";
import { passkey } from "@better-auth/passkey";
import { ensureAccountSchema } from "./db";
import { ensureHousehold, purgeHousehold } from "./households";
import { requireSecret } from "./secrets";

// ───────── メールの送り手（差し口） ─────────

export type Mail = { to: string; subject: string; text: string };
export type MailSender = (m: Mail) => Promise<void>;

/** 決めるまでの送り手: サーバの記録に出すだけ（作った家族だけなので送らない。設計 ⑨の2） */
const logSender: MailSender = async (m) => {
  console.info(`📧 [メール・送らずに記録だけ] 宛先 ${m.to}／${m.subject}\n${m.text}`);
};

let sender: MailSender = logSender;

/** 本番の送り手（Resend など）を差し込む。試験では送った物を集める関数を差す */
export function setMailSender(fn: MailSender | null): void {
  sender = fn ?? logSender;
}

const SUBJECT_BY_TYPE: Record<string, string> = {
  "sign-in": "ログインのコード",
  "email-verification": "メールの確かめのコード",
  "forget-password": "コード",
  "change-email": "メールを変えるコード",
};

// ───────── 組み立て ─────────

const DAY = 60 * 60 * 24;

function build() {
  const opts = {
    appName: "母子手帳",
    secret: requireSecret("BETTER_AUTH_SECRET"),
    // Tailscale の https の住所・localhost の開発（3000）・シミュレーション（3100）・本番（3210）のどれでも動くよう、届いた住所から組む
    baseURL: process.env.BETTER_AUTH_URL || {
      allowedHosts: ["localhost", "localhost:*", "127.0.0.1", "127.0.0.1:*", "*.ts.net"],
      fallback: "http://localhost:3000",
      protocol: "auto" as const,
    },
    trustedOrigins: ["http://localhost:*", "http://127.0.0.1:*", "https://*.ts.net"],
    database: ensureAccountSchema(),
    session: { expiresIn: 30 * DAY, updateAge: DAY },
    advanced: { trustedProxyHeaders: true, cookiePrefix: "boshi" },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
        storeOTP: "hashed" as const,
        async sendVerificationOTP({ email, otp, type }) {
          // 待たない（届くまでの時間で、登録があるかを漏らさない）
          void sender({
            to: email,
            subject: `母子手帳 ${SUBJECT_BY_TYPE[type] ?? "コード"}`,
            text: `コード: ${otp}\n5分で使えなくなります。心当たりが無ければ、このメールは捨ててください。`,
          }).catch((e) => console.error("メールを送れませんでした", e));
        },
      }),
      passkey({
        rpName: "母子手帳",
        // パスキーは住所（ドメイン）に結びつく。Tailscale の住所で使う時は BOSHI_PASSKEY_RP_ID に入れる
        ...(process.env.BOSHI_PASSKEY_RP_ID ? { rpID: process.env.BOSHI_PASSKEY_RP_ID } : {}),
      }),
      organization({
        creatorRole: "owner",
        organizationLimit: 5,
        invitationExpiresIn: 2 * DAY, // 招待は48時間
        requireEmailVerificationOnInvitation: true, // ログインした人のメールが招待先と一致しないと受け付けない
        cancelPendingInvitationsOnReInvite: true,
        async sendInvitationEmail(data) {
          void sender({
            to: data.email,
            subject: `母子手帳 「${data.organization.name}」への招待`,
            text:
              `${data.inviter.user.name || data.inviter.user.email} さんから、母子手帳の世帯への招待が届きました。\n` +
              `招待の番号: ${data.id}\n48時間で使えなくなります。\n` +
              `iPhone では Safari で開き、「ホーム画面に追加」をしてから、アプリの中でメールのコードを入れて受けてください。`,
          }).catch((e) => console.error("招待のメールを送れませんでした", e));
        },
        organizationHooks: {
          // 世帯を作った時: 世帯の行（kind = real）と世帯の鍵を作る
          async afterCreateOrganization({ organization: org }) {
            ensureHousehold(org.id, "real");
          },
          // 世帯を消した時: ファイル・鍵・記録をまとめて消す
          async afterDeleteOrganization({ organization: org, user }) {
            await purgeHousehold(org.id, user?.id ?? null);
          },
        },
      }),
      nextCookies(), // 最後に置く（サーバの処理からクッキーを返すため）
    ],
  };
  return { opts, auth: betterAuth(opts) };
}

export type Auth = ReturnType<typeof build>["auth"];

let built: ReturnType<typeof build> | null = null;
let ready: Promise<void> | null = null;

/** Better Auth の本体（表がまだ無いかもしれない。ふつうは authReady を使う） */
export function getAuth(): Auth {
  built ??= build();
  return built.auth;
}

/** 表を作り終えた Better Auth を返す（1つの処理の中で1回だけ migrate する） */
export async function authReady(): Promise<Auth> {
  const auth = getAuth();
  ready ??= getMigrations(built!.opts)
    .then((m) => m.runMigrations())
    .catch((e) => {
      ready = null;
      throw e;
    });
  await ready;
  return auth;
}

export type SessionInfo = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;

/** 届いたクッキーからセッションを引く（無ければ null） */
export async function getSession(headers: Headers): Promise<SessionInfo | null> {
  const auth = await authReady();
  return (await auth.api.getSession({ headers })) ?? null;
}
