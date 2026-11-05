"use client";

// 招待を受ける（/invite/<招待の id>）。ログインしていなければ、ログインの画面を通ってからここへ戻る。
// iPhone では Safari で開き、「ホーム画面に追加」をしてから、アプリの中でコードを入れて受ける（ホーム画面のアプリと Safari ではログインが別々）。
// ログイン前も、何の招待か（招いた人の呼び名・時期・役・伏せたメール）を出す。メールそのものや世帯の中身は出さない（api/account/invite の GET）。
// 字は画面の言葉で出す（t()。辞書は lib/i18n/dict/account.ts）。招待の言葉は lib/invite-words.ts が日本語で組み、出す所で t() で引く
// 言葉: リンクに送る人の選んだ言葉の印（?lang=zh）があれば、その言葉で開き直す（本人のクッキー → リンクの言葉 → ブラウザの言葉の順。
// lib/invite-words.ts の inviteLangToSwitch）。上の帯が無い画面なので、言葉の1行（🌐 日本語｜中文｜English）を上に置く
import { use, useEffect, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { LangRow } from "@/components/LangSwitch";
import { switchLang } from "@/components/LocaleProvider";
import { Btn, Why } from "@/components/ui";
import { Box, jpDateTime, Msg } from "@/components/settings/account-ui";
import { SHARE_ITEMS } from "@/components/settings/consent-texts";
import { currentLang, langFromCookieHeader, listOf, t } from "@/lib/i18n";
import { INVITE_LANG_PARAM, inviteCanLines, inviteHeadlineShown, inviteLangToSwitch, inviteMotherItemsLine, inviteSeeLine } from "@/lib/invite-words";

/** who・period: 見出しの呼び名と時期の言葉（日本語。api/account/invite の GET が headline と分けて返す。画面は inviteHeadlineShown で組む） */
type Inv = {
  id: string;
  headline: string;
  who?: string;
  period?: string | null;
  role: string;
  relation: string | null;
  maskedEmail: string;
  expiresAt: string;
  signedIn: boolean;
  showMother?: string[];
};

export default function AcceptInvite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { account, accountsEnabled, ready, reload, setFamilyId } = useFamily();
  const [inv, setInv] = useState<Inv | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // ログイン前の中身が取れなかった時（門の前など）は、作らずに「ご家族から」だけを言う
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    if (!ready || !accountsEnabled) return;
    api<Inv>(`/api/account/invite?id=${encodeURIComponent(id)}`)
      .then((r) => {
        setInv(r);
        setPreviewFailed(false);
      })
      .catch((e: Error) => {
        setInv(null);
        if (account) setMsg({ ok: false, text: e.message });
        else setPreviewFailed(true);
      });
  }, [ready, accountsEnabled, account, id]);

  // リンクの言葉で開き直すか。ログインしているかは、招待の中身の返し（signedIn）で確かめてから決める
  // （家族の一覧の控えがある端末は、アカウントを読み終える前に開くので、account だけでは送った本人を見分けられない）
  const signedIn = inv ? inv.signedIn : previewFailed && !account ? false : null;
  useEffect(() => {
    if (signedIn === null) return;
    const want = inviteLangToSwitch(new URLSearchParams(window.location.search).get(INVITE_LANG_PARAM), langFromCookieHeader(document.cookie), signedIn, currentLang());
    if (want) switchLang(want);
  }, [signedIn]);

  const accept = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ householdId: string }>("/api/account/invite/accept", { body: { invitationId: id } });
      await reload();
      setFamilyId(r.householdId);
      window.location.href = `/account/consent?familyId=${encodeURIComponent(r.householdId)}&next=/`;
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
      setBusy(false);
    }
  };

  const here = `/invite/${encodeURIComponent(id)}`;
  const preview = inv && !inv.signedIn ? inv : null;
  const full = inv && inv.signedIn ? inv : null;
  // 母が選んだ見せる項目（読むだけの招待）。項目ごとの選び分けはまだ効かないので、項目の名前は「準備中」の注に入れる（lib/invite-words.ts）
  const motherItems = (full?.showMother ?? []).map((x) => SHARE_ITEMS.find((s) => s.id === x)?.label ?? x);
  // 注を出すかは inviteMotherItemsLine で決め、文は画面の言葉で組む（日本語は「」を続けて並べる＝inviteMotherItemsLine と同じ字）
  const quoted = motherItems.map((x) => t("「{text}」", { text: t(x) }));
  const motherNote =
    full && inviteMotherItemsLine(full.role, motherItems)
      ? t("母が選んだ{items}だけを見せる仕組みは準備中です", { items: currentLang() === "ja" ? quoted.join("") : listOf(quoted) })
      : null;
  return (
    <main className="flex flex-col gap-4 px-4 pt-3 pb-10">
      <LangRow className="-mr-2 self-end" />
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold">{t("母子手帳への招待")}</h1>
        {(preview || full || (previewFailed && !account)) && <p className="text-base">{inviteHeadlineShown(inv?.who, inv?.period)}</p>}
      </div>
      {!accountsEnabled && ready && <p className="rounded-xl bg-rose-soft px-4 py-3 text-base">{t("このサーバでは、アカウントの仕組みをまだ動かしていません。")}</p>}

      {accountsEnabled && !account && (
        <Box>
          {preview && (
            <ul className="flex list-disc flex-col gap-1 pl-5 text-base">
              {inviteCanLines(preview.role).map((l) => (
                <li key={l}>{t(l)}</li>
              ))}
            </ul>
          )}
          <p className="text-base break-all">
            {preview?.maskedEmail
              ? t("招待されたメール（{email}）に届くコードで入ります。", { email: preview.maskedEmail })
              : t("招待されたメールに届くコードで入ります。")}
          </p>
          <Btn href={`/login?next=${encodeURIComponent(here)}`} full>
            {t("メールのコードで入る")}
          </Btn>
          {preview && <p className="text-sm text-muted">{t("{date}まで", { date: jpDateTime(preview.expiresAt) })}</p>}
        </Box>
      )}

      {full && (
        <Box>
          <p className="text-base">{t(inviteSeeLine(full.role, motherItems))}</p>
          {motherNote && <p className="text-sm text-muted">{motherNote}</p>}
          <p className="text-sm text-muted">{t("{date}まで", { date: jpDateTime(full.expiresAt) })}</p>
          <Btn onClick={() => void accept()} disabled={busy} full>
            {busy ? t("受けています…") : t("招待を受ける")}
          </Btn>
        </Box>
      )}
      <Msg msg={msg} />
      {account && msg && !msg.ok && (
        <p className="text-sm text-muted break-all">
          {t("いま {email} で入っています。招待されたメールが違う時は、アカウントの画面からログアウトして入り直してください。", { email: account.email })}
        </p>
      )}
      <Why label={t("iPhone では、先にホーム画面に追加")}>
        <ol className="flex list-decimal flex-col gap-1 pl-5">
          <li>{t("Safari の共有ボタンから「ホーム画面に追加」")}</li>
          <li>{t("ホーム画面のアプリでこのリンクを開き直す（または、アプリの中でメールのコードで入る）")}</li>
        </ol>
        <p>{t("ホーム画面に置いたアプリと Safari では、ログインが別々です。ふだん使うのはホーム画面のアプリなので、そちらで入ってください。")}</p>
      </Why>
      <Btn href="/" kind="quiet">
        {t("手帳に戻る")}
      </Btn>
    </main>
  );
}
