"use client";

// ログイン: メール → 6桁のコード → 入った後にパスキー（顔認証）の登録を勧める。
// メールのリンクでは入らない（iPhone のホーム画面のアプリと Safari ではクッキーが分かれるので、リンクだと Safari だけが入った状態になる）。
// パスキーはホーム画面のアプリで黙って閉じる報告があるので、コードの入口をいつも残す。
// 開発では、コードはメールで送らずサーバの記録（next dev を動かしている端末）に出る。
// 字は画面の言葉で出す（t()。辞書は lib/i18n/dict/account.ts）
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Btn, Why } from "@/components/ui";
import { authMessage, field, Msg, safeNext } from "@/components/settings/account-ui";
import { t } from "@/lib/i18n";

type Step = "email" | "code" | "passkey";

const nextPath = () => (typeof window === "undefined" ? null : safeNext(new URLSearchParams(window.location.search).get("next")));

/** 入った後の行き先: 招待などから来た時はそこへ。世帯が無ければ世帯を作る画面へ */
async function goAfterLogin() {
  const next = nextPath();
  if (next) return void (window.location.href = next);
  try {
    const r = await fetch("/api/account");
    const j = (await r.json()) as { households?: unknown[] };
    window.location.href = j.households?.length ? "/" : "/start";
  } catch {
    window.location.href = "/";
  }
}

export default function Login() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/account")
      .then((r) => r.json())
      .then((j: { enabled?: boolean; account?: unknown }) => {
        setEnabled(!!j.enabled);
        // もう入っている人は、そのまま先へ
        if (j.enabled && j.account) void goAfterLogin();
      })
      .catch(() => setEnabled(false));
  }, []);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: "sign-in" });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: authMessage(error, t("コードを送れませんでした。メールを確かめて、もう一度押してください")) });
    setOtp("");
    setStep("code");
    setMsg({ ok: true, text: t("{email} にコードを送りました。5分のうちに入れてください", { email: email.trim() }) });
  };

  const verify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = await authClient.signIn.emailOtp({ email: email.trim(), otp: otp.trim() });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: authMessage(error, t("入れませんでした。コードを確かめてください")) });
    // 入った直後にパスキーを聞かない（手帳に着くまでの1枚を減らす）。パスキーはアカウントの画面から登録できる（自分の手帳の入口 2026-11-04）
    await goAfterLogin();
  };

  const addPasskey = async () => {
    setBusy(true);
    setMsg(null);
    // 訳さない: パスキーの名前（サーバに残す値）
    const r = await authClient.passkey.addPasskey({ name: "この端末" });
    setBusy(false);
    if (r?.error) return setMsg({ ok: false, text: t("パスキーを登録できませんでした。あとでアカウントの画面からもできます") });
    await goAfterLogin();
  };

  const passkeyLogin = async () => {
    setBusy(true);
    setMsg(null);
    const r = await authClient.signIn.passkey();
    setBusy(false);
    if (r?.error) return setMsg({ ok: false, text: t("パスキーで入れませんでした。メールのコードで入ってください") });
    await goAfterLogin();
  };

  if (enabled === false)
    return (
      <main className="flex flex-col gap-4 px-4 pt-10">
        <h1 className="font-display text-2xl font-bold">{t("ログイン")}</h1>
        <p className="rounded-xl bg-rose-soft px-4 py-3 text-base">{t("このサーバでは、アカウントの仕組みをまだ動かしていません。いまは今までどおり使えます。")}</p>
        <Btn href="/" kind="secondary">
          {t("手帳に戻る")}
        </Btn>
      </main>
    );

  return (
    <main className="flex flex-col gap-4 px-4 pt-10 pb-10">
      <h1 className="font-display text-2xl font-bold">{step === "passkey" ? t("入りました") : t("ログイン・アカウントを作る")}</h1>

      {step === "email" && (
        <>
          <p className="text-base text-muted">{t("メールに届く6桁のコードで入ります。はじめての人は、そのままアカウントができます。")}</p>
          <form onSubmit={send} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-base">
              {t("メール")}
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                className={field}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <button disabled={busy || enabled === null || !email.trim()} className="min-h-12 rounded-full bg-rose font-display text-lg font-bold text-white disabled:opacity-60">
              {busy ? t("送っています…") : t("コードを送る")}
            </button>
          </form>
          <div className="flex flex-col gap-2 pt-2">
            <p className="text-sm text-muted">{t("パスキーを登録した端末なら")}</p>
            <Btn kind="secondary" onClick={() => void passkeyLogin()} disabled={busy || enabled === null}>
              {t("パスキー（顔認証）で入る")}
            </Btn>
          </div>
        </>
      )}

      {step === "code" && (
        <form onSubmit={verify} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-base">
            {t("メールに届いた6桁のコード")}
            <input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              required
              className={`${field} text-center text-2xl tracking-[0.5em]`}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </label>
          <button disabled={busy || otp.length !== 6} className="min-h-12 rounded-full bg-rose font-display text-lg font-bold text-white disabled:opacity-60">
            {busy ? t("確かめています…") : t("入る")}
          </button>
          <div className="flex flex-wrap gap-2">
            <Btn kind="quiet" onClick={() => void send()} disabled={busy}>
              {t("コードをもう一度送る")}
            </Btn>
            <Btn kind="quiet" onClick={() => (setStep("email"), setMsg(null))} disabled={busy}>
              {t("メールを直す")}
            </Btn>
          </div>
        </form>
      )}

      {step === "passkey" && (
        <>
          <p className="text-base">{t("次から、顔認証（パスキー）だけで入れるようにしますか？")}</p>
          <Btn onClick={() => void addPasskey()} disabled={busy} full>
            {busy ? t("登録しています…") : t("パスキーを登録する")}
          </Btn>
          <Btn kind="secondary" onClick={() => void goAfterLogin()} disabled={busy} full>
            {t("あとで")}
          </Btn>
          <p className="text-sm text-muted">{t("登録しなくても、いつでもメールのコードで入れます")}</p>
        </>
      )}

      <Msg msg={msg} />

      <Why label={t("メールのリンクで入らないのは？")}>
        <p>{t("iPhone のホーム画面に置いたアプリと Safari では、ログインの札が別々です。リンクで入ると Safari だけが入った状態になるので、コードを入れる形にしています。")}</p>
        <p>{t("コードは5分で切れ、3回まちがえると使えなくなります。")}</p>
      </Why>
      {step !== "passkey" && (
        <div className="flex flex-wrap gap-2">
          <Btn href="/" kind="quiet">
            {t("ログインせずにデモを見る")}
          </Btn>
          <Btn href="/unlock" kind="quiet">
            {t("家族の合言葉で入る")}
          </Btn>
        </div>
      )}
    </main>
  );
}
