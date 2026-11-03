"use client";

// アカウントの画面: あなた（パスキー・ログアウト）・本人ごとの同意と撤回・同意の履歴・家族（仲間と招待）・書き出す・消す。
// 撤回は同意と同じく1回押すだけ（PHR 指針 3.2(2)④・3.3(2)①）。消す前に書き出しを勧める（PHR 指針 3.3(1)③）。
import { useEffect, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { authClient } from "@/lib/auth-client";
import { Btn, Fold, Pill, Why } from "@/components/ui";
import { Box, field, jpDateTime, Msg, ROLE_WORD, useHouseholdDetail, type HouseholdDetail, type SubjectView } from "@/components/settings/account-ui";
import { subjectLabel, useQuery } from "@/components/settings/ConsentScreen";
import { CONSENT_NAME } from "@/components/settings/consent-texts";

export default function AccountPage() {
  const { account, accountsEnabled, households, family, isHousehold, signOut, setFamilyId, reload } = useFamily();
  const q = useQuery();
  // どの世帯の画面か: URL の指定 → いま見ている家族（世帯なら）→ 最初の世帯 → いま見ている作った家族
  const familyId = q.ready ? (q.familyId ?? (isHousehold(family.id) ? family.id : (households[0]?.id ?? family.id))) : null;
  const { data, error, load } = useHouseholdDetail(familyId);

  if (!accountsEnabled)
    return (
      <main className="flex flex-col gap-4 px-4 pt-6">
        <h1 className="font-display text-2xl font-bold">アカウント</h1>
        <p className="rounded-xl bg-rose-soft px-4 py-3 text-base">このサーバでは、アカウントの仕組みをまだ動かしていません。</p>
      </main>
    );

  return (
    <main className="flex flex-col gap-4 px-4 pt-4 pb-10">
      <h1 className="font-display text-2xl font-bold">アカウントと同意</h1>

      {account ? (
        <Me email={account.email} onSignOut={signOut} />
      ) : (
        <Box>
          <p className="text-base">ログインしていません。いまは作った家族（デモ）を見ています。</p>
          <Btn href="/login?next=/account">ログイン・アカウントを作る</Btn>
        </Box>
      )}

      {account && households.length === 0 && (
        <Box title="世帯">
          <p className="text-base">まだ自分の世帯がありません。作ると、家族の手帳が始まります。招待を受けた人は、招待のリンクを開いてください。</p>
          <Btn href="/account/new">世帯を作る</Btn>
        </Box>
      )}

      {households.length > 1 && (
        <label className="flex flex-col gap-1 text-base">
          <span className="text-sm font-semibold text-muted">どの世帯の</span>
          <select
            className={field}
            value={familyId ?? ""}
            onChange={(e) => {
              const u = new URL(window.location.href);
              u.searchParams.set("familyId", e.target.value);
              window.location.href = u.toString();
            }}
          >
            {households.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name || "わが家"}（{ROLE_WORD[h.role]}）
              </option>
            ))}
          </select>
        </label>
      )}

      {error && <Msg msg={{ ok: false, text: error }} />}
      {data && (
        <>
          {data.role === "guest" && (
            <p role="note" className="rounded-xl bg-sky-soft px-4 py-3 text-base">
              いま見ているのは作った家族（デモ）です。同意の画面の動きを試せます。本物の家族の記録はここにはありません。
            </p>
          )}
          <Consents data={data} reload={load} />
          <History data={data} />
          {data.role !== "guest" && <Family data={data} reload={load} />}
          <Export familyId={data.household.id} />
          {data.role !== "guest" && (
            <Delete
              data={data}
              onDone={async (all) => {
                if (all) {
                  setFamilyId("demo-sato");
                  await reload();
                  window.location.href = "/account";
                } else {
                  await load();
                  await reload();
                }
              }}
            />
          )}
        </>
      )}
    </main>
  );
}

function Me({ email, onSignOut }: { email: string; onSignOut: () => Promise<void> }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    authClient.passkey
      .listUserPasskeys()
      .then((r) => setCount(Array.isArray(r.data) ? r.data.length : null))
      .catch(() => setCount(null));
  }, []);
  const add = async () => {
    setMsg(null);
    const r = await authClient.passkey.addPasskey({ name: "この端末" });
    if (r?.error) return setMsg({ ok: false, text: "パスキーを登録できませんでした。メールのコードでは、いつでも入れます" });
    setCount((c) => (c ?? 0) + 1);
    setMsg({ ok: true, text: "登録しました。次から顔認証で入れます" });
  };
  return (
    <Box title="あなた">
      <p className="text-base break-all">{email}</p>
      <p className="text-sm text-muted">{count ? `パスキー: ${count}台の端末に登録しています` : "パスキーはまだ登録していません"}</p>
      <div className="flex flex-wrap gap-2">
        <Btn kind="secondary" onClick={() => void add()}>
          この端末にパスキーを登録
        </Btn>
        <Btn
          kind="secondary"
          onClick={() => {
            void onSignOut().then(() => (window.location.href = "/"));
          }}
        >
          ログアウト
        </Btn>
      </div>
      <p className="text-sm text-muted">ログアウトすると、この端末に覚えた家族の一覧も消えます。</p>
      <Msg msg={msg} />
    </Box>
  );
}

/** 本人ごとの同意。同意は説明の画面から、撤回はここで1回押すだけ */
function Consents({ data, reload }: { data: HouseholdDetail; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const hid = data.household.id;
  const revoke = async (s: SubjectView, kind: "record" | "claude_us") => {
    setBusy(`${s.id}:${kind}`);
    setMsg(null);
    try {
      await api("/api/account/consent", { method: "DELETE", body: { familyId: hid, subjectIds: [s.id], kind } });
      await reload();
      setMsg({ ok: true, text: `${subjectLabel(s)}の「${CONSENT_NAME[kind]}」を撤回しました` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };
  const row = (s: SubjectView, kind: "record" | "claude_us") => {
    const c = kind === "record" ? s.record : s.claude;
    const href = `/account/consent${kind === "claude_us" ? "/claude" : ""}?familyId=${encodeURIComponent(hid)}&next=/account`;
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-col">
          <span className="text-base">{CONSENT_NAME[kind]}</span>
          <span className="text-sm text-muted">{c ? `同意（${jpDateTime(c.grantedAt)}）` : "同意していません"}</span>
        </span>
        {s.canConsent &&
          (c ? (
            <Btn kind="secondary" onClick={() => void revoke(s, kind)} disabled={busy !== null}>
              {busy === `${s.id}:${kind}` ? "撤回しています…" : "撤回する"}
            </Btn>
          ) : (
            <Btn href={href}>読んで同意する</Btn>
          ))}
      </div>
    );
  };
  return (
    <Box title="本人ごとの同意">
      {data.subjects.length === 0 && <p className="text-base text-muted">見られる本人がいません。</p>}
      {data.subjects.map((s) => (
        <div key={s.id} className="flex flex-col gap-2 border-t border-line pt-3 first:border-0 first:pt-0">
          <p className="font-semibold">
            {subjectLabel(s)}
            {s.kind === "child" && <span className="ml-2 text-sm font-normal text-muted">親が法定代理人として</span>}
          </p>
          {row(s, "record")}
          {row(s, "claude_us")}
        </div>
      ))}
      <Msg msg={msg} />
      <Why label="撤回すると？">
        <p>「記録を残す」を撤回すると、その本人の新しい記録は残しません。今までの記録を消したい時は、下の「消す」から本人の分を消してください。</p>
        <p>「米国の Claude に送る」を撤回すると、その本人の分は Claude に送りません。送った分の Anthropic の側の写しは、30日以内に消えます。</p>
      </Why>
    </Box>
  );
}

function History({ data }: { data: HouseholdDetail }) {
  const name = new Map(data.subjects.map((s) => [s.id, subjectLabel(s)]));
  if (!data.history.length) return null;
  return (
    <Fold title="同意の履歴" count={data.history.length}>
      <ul className="flex flex-col gap-2">
        {data.history.map((c) => (
          <li key={c.id} className="rounded-xl bg-paper px-3 py-2 text-sm">
            <span className="font-semibold">{name.get(c.subjectId) ?? "本人"}</span>・{CONSENT_NAME[c.kind]}（版 {c.version}）
            <br />
            同意 {jpDateTime(c.grantedAt)}
            {c.revokedAt ? ` → 撤回 ${jpDateTime(c.revokedAt)}` : <Pill tone="ok">有効</Pill>}
          </li>
        ))}
      </ul>
    </Fold>
  );
}

/** 家族（仲間）と招待 */
function Family({ data, reload }: { data: HouseholdDetail; reload: () => Promise<void> }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const admin = data.perms.includes("household:admin");
  const hid = data.household.id;
  const cancel = async (id: string) => {
    try {
      await api("/api/account/invite", { method: "DELETE", body: { familyId: hid, invitationId: id } });
      await reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };
  return (
    <Box title="家族（世帯の仲間）">
      <ul className="flex flex-col gap-2">
        {data.members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 text-base">
            <span className="break-all">
              {m.name || m.email}
              {data.account?.id === m.accountId && "（あなた）"}
            </span>
            <Pill>{ROLE_WORD[m.role.split(",")[0]] ?? m.role}</Pill>
          </li>
        ))}
      </ul>
      {data.invitations.length > 0 && (
        <>
          <h3 className="pt-1 text-base font-bold">返事待ちの招待</h3>
          <ul className="flex flex-col gap-2">
            {data.invitations.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="break-all">
                  {i.email}・{i.relation ?? ROLE_WORD[i.role]}・{jpDateTime(i.expiresAt)}まで
                </span>
                <Btn kind="quiet" onClick={() => void cancel(i.id)}>
                  取り消す
                </Btn>
              </li>
            ))}
          </ul>
        </>
      )}
      {admin ? (
        <Btn href={`/invite/new?familyId=${encodeURIComponent(hid)}`}>家族を招く</Btn>
      ) : (
        <p className="text-sm text-muted">招くのは、世帯の持ち主と共同の管理の人です。</p>
      )}
      <Msg msg={msg} />
    </Box>
  );
}

function Export({ familyId }: { familyId: string }) {
  return (
    <Box title="書き出す">
      <p className="text-base">記録（JSON と CSV）・家族の設定・同意の履歴・写真と録音の原本を、1つの zip で受け取れます。</p>
      <a
        href={`/api/export?familyId=${encodeURIComponent(familyId)}`}
        download
        className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/20 bg-card px-5 text-base font-semibold"
      >
        zip を受け取る
      </a>
      <p className="text-sm text-muted">紙の母子手帳の並びで見たい時は、「手帳」→「一冊」から印刷して PDF にできます。</p>
    </Box>
  );
}

/** 消す: 本人の分・世帯の全部。「消す」と入れてから押す */
function Delete({ data, onDone }: { data: HouseholdDetail; onDone: (all: boolean) => Promise<void> }) {
  const [target, setTarget] = useState<string>("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const owner = data.perms.includes("household:delete");
  const hid = data.household.id;
  const choices = [
    ...data.subjects.filter((s) => s.mine || owner).map((s) => ({ id: s.id, label: `${subjectLabel(s)}の分` })),
    ...(owner ? [{ id: "__all__", label: "世帯の全部（家族全員の分）" }] : []),
  ];
  if (!choices.length) return null;

  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      if (target === "__all__") await api("/api/account/household", { method: "DELETE", body: { familyId: hid, confirm } });
      else await api("/api/account/subject", { method: "DELETE", body: { familyId: hid, subjectId: target, confirm } });
      setMsg({ ok: true, text: "消しました" });
      setConfirm("");
      await onDone(target === "__all__");
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box title="消す" tone="alert">
      <p className="text-base">消す前に、上の「zip を受け取る」で書き出しておくと安心です。消した物は戻せません。</p>
      <label className="flex flex-col gap-1 text-base">
        何を消しますか
        <select className={field} value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">選んでください</option>
          {choices.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      {target && (
        <>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
            <li>{target === "__all__" ? "記録・写真・録音・同意・世帯の鍵を、まとめて消します。鍵を消すので、残ったファイルも読めなくなります" : "その本人の記録・写真・録音・同意・代理の印を消します。本人の付いていない世帯全体の記録は残ります"}</li>
            <li>Claude に送った分の Anthropic の側の写しは、30日以内に自動で消えます</li>
            <li>サーバのバックアップに残る写しは、バックアップが入れ替わるまで残ります（日数はまだ決めていません）</li>
          </ul>
          <label className="flex flex-col gap-1 text-base">
            確かめのため「消す」と入れてください
            <input className={field} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          </label>
          <button
            type="button"
            disabled={busy || confirm !== "消す"}
            onClick={() => void run()}
            className="min-h-12 rounded-full bg-alert px-5 text-base font-bold text-white disabled:opacity-50"
          >
            {busy ? "消しています…" : "消す"}
          </button>
        </>
      )}
      <Msg msg={msg} />
    </Box>
  );
}
