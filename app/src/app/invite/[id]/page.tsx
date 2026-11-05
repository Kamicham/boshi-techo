"use client";

// 招待を受ける（/invite/<招待の id>）。ログインしていなければ、ログインの画面を通ってからここへ戻る。
// iPhone では Safari で開き、「ホーム画面に追加」をしてから、アプリの中でコードを入れて受ける（ホーム画面のアプリと Safari ではログインが別々）。
// ログイン前も、何の招待か（招いた人の呼び名・時期・役・伏せたメール）を出す。メールそのものや世帯の中身は出さない（api/account/invite の GET）。
import { use, useEffect, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { Btn, Why } from "@/components/ui";
import { Box, jpDateTime, Msg } from "@/components/settings/account-ui";
import { SHARE_ITEMS } from "@/components/settings/consent-texts";
import { inviteCanLines, inviteHeadline, inviteMotherItemsLine, inviteSeeLine } from "@/lib/invite-words";

type Inv = { id: string; headline: string; role: string; relation: string | null; maskedEmail: string; expiresAt: string; signedIn: boolean; showMother?: string[] };

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
  const motherNote = full ? inviteMotherItemsLine(full.role, motherItems) : null;
  return (
    <main className="flex flex-col gap-4 px-4 pt-10 pb-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold">母子手帳への招待</h1>
        {(preview || full || (previewFailed && !account)) && <p className="text-base">{inv?.headline ?? inviteHeadline(null, null)}</p>}
      </div>
      {!accountsEnabled && ready && <p className="rounded-xl bg-rose-soft px-4 py-3 text-base">このサーバでは、アカウントの仕組みをまだ動かしていません。</p>}

      {accountsEnabled && !account && (
        <Box>
          {preview && (
            <ul className="flex list-disc flex-col gap-1 pl-5 text-base">
              {inviteCanLines(preview.role).map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
          <p className="text-base break-all">
            {preview?.maskedEmail ? `招待されたメール（${preview.maskedEmail}）に届くコードで入ります。` : "招待されたメールに届くコードで入ります。"}
          </p>
          <Btn href={`/login?next=${encodeURIComponent(here)}`} full>
            メールのコードで入る
          </Btn>
          {preview && <p className="text-sm text-muted">{jpDateTime(preview.expiresAt)}まで</p>}
        </Box>
      )}

      {full && (
        <Box>
          <p className="text-base">{inviteSeeLine(full.role, motherItems)}</p>
          {motherNote && <p className="text-sm text-muted">{motherNote}</p>}
          <p className="text-sm text-muted">{jpDateTime(full.expiresAt)}まで</p>
          <Btn onClick={() => void accept()} disabled={busy} full>
            {busy ? "受けています…" : "招待を受ける"}
          </Btn>
        </Box>
      )}
      <Msg msg={msg} />
      {account && msg && !msg.ok && (
        <p className="text-sm text-muted break-all">
          いま {account.email} で入っています。招待されたメールが違う時は、アカウントの画面からログアウトして入り直してください。
        </p>
      )}
      <Why label="iPhone では、先にホーム画面に追加">
        <ol className="flex list-decimal flex-col gap-1 pl-5">
          <li>Safari の共有ボタンから「ホーム画面に追加」</li>
          <li>ホーム画面のアプリでこのリンクを開き直す（または、アプリの中でメールのコードで入る）</li>
        </ol>
        <p>ホーム画面に置いたアプリと Safari では、ログインが別々です。ふだん使うのはホーム画面のアプリなので、そちらで入ってください。</p>
      </Why>
      <Btn href="/" kind="quiet">
        手帳に戻る
      </Btn>
    </main>
  );
}
