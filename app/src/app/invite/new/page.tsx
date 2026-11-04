"use client";

// 家族を招く（世帯の持ち主・共同の管理の人）。役と見せる範囲を一緒に決める。
// 母の記録のどの項目を見せるかは母（本人）が選ぶ。既定は「子の記録だけ」（何も選ばない）。
// リンクは48時間で切れる。開発中はメールを送らないので、出たリンクをLINEなどで手渡しする。
import { useEffect, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { Btn, CopyButton, ShareButton, Why } from "@/components/ui";
import { Box, field, jpDateTime, Msg, useHouseholdDetail } from "@/components/settings/account-ui";
import { useQuery } from "@/components/settings/ConsentScreen";
import { RELATIONS, SHARE_ITEMS, type Relation, type ShareItem } from "@/components/settings/consent-texts";
import { inviteShareText, lineShareUrl } from "@/lib/invite-words";

export default function NewInvite() {
  const { family, households } = useFamily();
  const q = useQuery();
  const familyId = q.ready ? (q.familyId ?? (households.some((h) => h.id === family.id) ? family.id : (households[0]?.id ?? null))) : null;
  const { data, error } = useHouseholdDetail(familyId);
  const [email, setEmail] = useState("");
  const [relation, setRelation] = useState<Relation>("パートナー");
  const [show, setShow] = useState<Set<ShareItem>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [made, setMade] = useState<{ link: string; expiresAt: string; email: string } | null>(null);

  // ママとパートナーは共同の管理（記録を足せる）、ほかは読むだけ
  const role = relation === "パートナー" || relation === "ママ" ? "admin" : "member";
  const iAmMother = !!data?.subjects.some((s) => s.kind === "mother" && s.mine);
  const iAmPartner = !!data?.subjects.some((s) => s.kind === "partner" && s.mine);
  // 母の本人にまだだれも結びついていない手帳（パートナーが始めた）では「ママ」を招ける。自分の役は選び肢に出さない
  const motherFree = !!data?.subjects.some((s) => s.kind === "mother" && !s.accountId);
  const choices = RELATIONS.filter((r) => (r === "ママ" ? motherFree && !iAmMother : r === "パートナー" ? !iAmPartner : true));
  const mamaFirst = choices[0] === "ママ";
  useEffect(() => {
    if (mamaFirst) setRelation("ママ");
  }, [mamaFirst]);

  const send = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ link: string; expiresAt: string }>("/api/account/invite", {
        body: { familyId, email, role, relation, showMother: role === "member" ? [...show] : [] },
      });
      setMade({ link: `${window.location.origin}${r.link}`, expiresAt: r.expiresAt, email: email.trim() });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  if (!familyId) return <main className="px-4 pt-6 text-base">招く世帯がありません。先に世帯を作ってください。</main>;

  return (
    <main className="flex flex-col gap-4 px-4 pt-4 pb-10">
      <h1 className="font-display text-2xl font-bold">家族を招く</h1>
      {error && <Msg msg={{ ok: false, text: error }} />}

      {made ? (
        <Box title="招待のリンクができました">
          <p className="text-base">この文を、そのまま相手に送ってください。{jpDateTime(made.expiresAt)}まで（48時間）使えます。</p>
          <p id="invite-text" className="rounded-lg bg-paper px-3 py-2 text-base break-all whitespace-pre-line">
            {inviteShareText(made.email, made.link)}
          </p>
          <Btn href={lineShareUrl(inviteShareText(made.email, made.link))} full>
            LINE で送る
          </Btn>
          <div className="flex flex-wrap items-center gap-2">
            <CopyButton text={inviteShareText(made.email, made.link)} label="文をコピー" />
            <ShareButton title="母子手帳への招待" text={inviteShareText(made.email, made.link)} label="ほかのアプリで送る…" fallback={false} />
          </div>
          <Why label="リンクだけを送る時">
            <div className="flex items-center justify-between gap-2">
              <span>招待のリンク</span>
              <CopyButton text={made.link} />
            </div>
            <p id="invite-link" className="break-all">
              {made.link}
            </p>
          </Why>
          <Btn href={`/account?familyId=${encodeURIComponent(familyId)}`} kind="secondary">
            アカウントの画面へ
          </Btn>
        </Box>
      ) : (
        <>
          <Box title="だれを">
            <div className="flex flex-wrap gap-2">
              {choices.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={relation === r}
                  onClick={() => setRelation(r)}
                  className={`min-h-11 rounded-full px-5 text-base font-semibold ${relation === r ? "bg-rose text-white" : "bg-rose-soft text-rose"}`}
                >
                  {r}
                </button>
              ))}
            </div>
            <p className="text-sm text-muted">
              {role === "admin" ? "共同の管理: 記録を見て、足して、家族を招けます" : "読むだけ: 子の記録を見られます。足す・直すはできません"}
            </p>
            <label className="flex flex-col gap-1 text-base">
              相手のメール（このメールのコードで入った人だけが受けられます）
              <input type="email" inputMode="email" autoComplete="off" className={field} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="family@example.com" />
            </label>
          </Box>

          {role === "member" && (
            <Box title="母の記録から、見せる物">
              {iAmMother ? (
                <>
                  <p className="text-base">何も選ばなければ、子の記録だけを見せます。</p>
                  {SHARE_ITEMS.map((it) => (
                    <label key={it.id} className="flex min-h-11 items-center gap-3 text-base">
                      <input
                        type="checkbox"
                        className="size-5 accent-rose"
                        checked={show.has(it.id)}
                        onChange={(e) => {
                          const n = new Set(show);
                          if (e.target.checked) n.add(it.id);
                          else n.delete(it.id);
                          setShow(n);
                        }}
                      />
                      {it.label}
                    </label>
                  ))}
                </>
              ) : (
                <p className="text-base">母の記録を見せる範囲は、母本人が選びます。この招待では、子の記録だけを見せます。</p>
              )}
            </Box>
          )}

          <Btn onClick={() => void send()} disabled={busy || !email.trim() || !data} full>
            {busy ? "作っています…" : "招待のリンクを作る"}
          </Btn>
          <Msg msg={msg} />
          <Why label="なぜメールのコードで受けるの？">
            <p>リンクを他の人に転送されても、招待したメールの持ち主でなければ受けられないようにするためです。</p>
          </Why>
        </>
      )}
    </main>
  );
}
