"use client";

// 招待を受ける（/invite/<招待の id>）。ログインしていなければ、ログインの画面を通ってからここへ戻る。
// iPhone では Safari で開き、「ホーム画面に追加」をしてから、アプリの中でコードを入れて受ける（ホーム画面のアプリと Safari ではログインが別々）。
import { use, useEffect, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { Btn, Why } from "@/components/ui";
import { Box, jpDateTime, Msg, ROLE_WORD } from "@/components/settings/account-ui";
import { SHARE_ITEMS } from "@/components/settings/consent-texts";

type Inv = { id: string; householdName: string; inviterEmail: string; role: string; expiresAt: string; relation: string | null; showMother: string[] };

export default function AcceptInvite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { account, accountsEnabled, ready, reload, setFamilyId } = useFamily();
  const [inv, setInv] = useState<Inv | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready || !account) return;
    api<Inv>(`/api/account/invite?id=${encodeURIComponent(id)}`)
      .then(setInv)
      .catch((e: Error) => setMsg({ ok: false, text: e.message }));
  }, [ready, account, id]);

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
  return (
    <main className="flex flex-col gap-4 px-4 pt-10 pb-10">
      <h1 className="font-display text-2xl font-bold">母子手帳への招待</h1>
      {!accountsEnabled && ready && <p className="rounded-xl bg-rose-soft px-4 py-3 text-base">このサーバでは、アカウントの仕組みをまだ動かしていません。</p>}

      {accountsEnabled && !account && (
        <Box>
          <p className="text-base">招待されたメールで入ると、招待を受けられます。</p>
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
            <li>iPhone では、先に Safari の共有ボタンから「ホーム画面に追加」</li>
            <li>ホーム画面のアプリでこのリンクを開き直す（または、アプリの中でメールのコードで入る）</li>
          </ol>
          <Btn href={`/login?next=${encodeURIComponent(here)}`} full>
            メールのコードで入る
          </Btn>
        </Box>
      )}

      {inv && (
        <Box title={inv.householdName || "家族の世帯"}>
          <p className="text-base break-all">{inv.inviterEmail ? `${inv.inviterEmail} さんから` : ""}</p>
          <p className="text-base">
            役: {inv.relation ?? ""}（{ROLE_WORD[inv.role] ?? inv.role}）
          </p>
          <p className="text-base">
            見られる物: 子の記録
            {inv.showMother.length > 0 && `、${inv.showMother.map((x) => SHARE_ITEMS.find((s) => s.id === x)?.label ?? x).join("、")}`}
          </p>
          <p className="text-sm text-muted">{jpDateTime(inv.expiresAt)}まで</p>
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
      <Why label="ホーム画面に追加するのは？">
        <p>ホーム画面に置いたアプリと Safari では、ログインが別々です。ふだん使うのはホーム画面のアプリなので、そちらで入ってください。</p>
      </Why>
      <Btn href="/" kind="quiet">
        手帳に戻る
      </Btn>
    </main>
  );
}
