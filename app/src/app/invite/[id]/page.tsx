"use client";

// 招待を受ける（/invite/<招待の id>）。ログインしていなければ、ログインの画面を通ってからここへ戻る。
// iPhone では Safari で開き、「ホーム画面に追加」をしてから、アプリの中でコードを入れて受ける（ホーム画面のアプリと Safari ではログインが別々）。
// ログイン前も、何の招待か（招いた人の呼び名・時期・役・伏せたメール）を出す。メールそのものや世帯の中身は出さない（api/account/invite の GET）。
// 字は画面の言葉で出す（t()。辞書は lib/i18n/dict/account.ts）。招待の言葉は lib/invite-words.ts が日本語で組み、出す所で t() で引く
import { use, useEffect, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { Btn, Why } from "@/components/ui";
import { Box, jpDateTime, Msg } from "@/components/settings/account-ui";
import { SHARE_ITEMS } from "@/components/settings/consent-texts";
import { relabel } from "@/lib/clock";
import { currentLang, listOf, t } from "@/lib/i18n";
import { nameIn } from "@/lib/i18n/names";
import { inviteCanLines, inviteHeadline, inviteMotherItemsLine, inviteSeeLine } from "@/lib/invite-words";

type Inv = { id: string; headline: string; role: string; relation: string | null; maskedEmail: string; expiresAt: string; signedIn: boolean; showMother?: string[] };

/**
 * 見出し（サーバが日本語で組んだ inviteHeadline の文）を、今の言葉に直す。呼び名と時期に分けて組み直す。
 * 形が読めない時は、そのまま日本語で出す。日本語の画面では何もしない
 */
function headlineIn(ja: string): string {
  if (currentLang() === "ja") return ja;
  const m = /^(.+)から、(?:(妊娠\d+週|生後\d+日|生後\d+か月|\d+歳(?:\d+か月)?)の)?母子手帳への招待です$/.exec(ja);
  if (!m) return ja;
  // 呼び名が無い・役の名前のままの時の言葉（inviteHeadline）は訳し、家族が入れた呼び名は nameIn に通す
  const who = ["ご家族", "ママ", "パートナー"].includes(m[1]) ? t(m[1]) : nameIn(m[1]);
  if (!m[2]) return t("{who}から、母子手帳への招待です", { who });
  const week = /^妊娠(\d+)週$/.exec(m[2]);
  const period = week ? t("妊娠{w}週", { w: Number(week[1]) }) : relabel(m[2]);
  return t("{who}から、{period}の母子手帳への招待です", { who, period });
}

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
    <main className="flex flex-col gap-4 px-4 pt-10 pb-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold">{t("母子手帳への招待")}</h1>
        {(preview || full || (previewFailed && !account)) && <p className="text-base">{headlineIn(inv?.headline ?? inviteHeadline(null, null))}</p>}
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
