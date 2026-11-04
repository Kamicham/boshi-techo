"use client";

// 同意の画面の共通部分: 本人ごとに選んで「同意する」。子の分は親が法定代理人として押す。
// 中身の文（何に同意するか）は呼ぶ側が children で渡す。撤回はアカウントの画面から同じ手軽さで。
import { useEffect, useMemo, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { Btn } from "@/components/ui";
import { CHILD_NOTE, CONSENT_NAME, type ScreenConsentKind } from "./consent-texts";
import { Box, Msg, SUBJECT_WORD, useHouseholdDetail, jpDateTime, safeNext, type SubjectView } from "./account-ui";

/** URL の ?familyId= と ?next=（読み終えるまで ready は false） */
export function useQuery(): { ready: boolean; familyId: string | null; next: string | null } {
  const [q, setQ] = useState<{ ready: boolean; familyId: string | null; next: string | null }>({ ready: false, familyId: null, next: null });
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setQ({ ready: true, familyId: p.get("familyId"), next: safeNext(p.get("next")) });
  }, []);
  return q;
}

export function subjectLabel(s: SubjectView): string {
  const who = SUBJECT_WORD[s.kind];
  return `${who}${s.name && s.name !== who ? `（${s.name}）` : ""}${s.mine ? "・あなた" : ""}`;
}

export function ConsentScreen({
  kind,
  title,
  lead,
  children,
  after,
}: {
  kind: ScreenConsentKind;
  title: string;
  lead: string;
  children: React.ReactNode;
  /** 同意した後に出す物（次の画面への入口など） */
  after?: (next: string | null, familyId: string) => React.ReactNode;
}) {
  const { family, reload } = useFamily();
  const q = useQuery();
  const familyId = q.familyId ?? family.id;
  const { data, error, load } = useHouseholdDetail(q.ready ? familyId : null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [done, setDone] = useState(false);

  const current = (s: SubjectView) => (kind === "record" ? s.record : s.claude);
  const open = useMemo(() => (data?.subjects ?? []).filter((s) => s.canConsent && !current(s)), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  // はじめは押せる本人を全員選んでおく（外したい人だけ外す）
  useEffect(() => setPicked(new Set(open.map((s) => s.id))), [open]);

  const grant = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/account/consent", { body: { familyId, kind, subjectIds: [...picked] } });
      await load();
      setDone(true);
      // 上の「同意してください」の帯を消す（世帯の一覧を読み直す）
      void reload();
      setMsg({ ok: true, text: "同意しました。アカウントの画面から、いつでも撤回できます" });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const hasChild = open.some((s) => s.kind === "child");
  const waiting = (data?.subjects ?? []).filter((s) => !s.canConsent && !current(s));

  return (
    <main className="flex flex-col gap-4 px-4 pt-4 pb-10">
      <p className="text-sm font-semibold text-muted">同意: {CONSENT_NAME[kind]}</p>
      <h1 className="font-display text-2xl font-bold text-balance">{title}</h1>
      <p className="text-base">{lead}</p>
      {children}

      {error && <Msg msg={{ ok: false, text: error }} />}
      {data && (
        <Box title="だれの分に同意しますか">
          {data.subjects.map((s) => {
            const c = current(s);
            const can = s.canConsent && !c;
            return (
              <label key={s.id} className={`flex min-h-11 items-start gap-3 text-base ${can ? "" : "opacity-70"}`}>
                <input
                  type="checkbox"
                  className="mt-1 size-5 shrink-0 accent-rose"
                  disabled={!can || busy}
                  checked={!!c || picked.has(s.id)}
                  onChange={(e) => {
                    const n = new Set(picked);
                    if (e.target.checked) n.add(s.id);
                    else n.delete(s.id);
                    setPicked(n);
                  }}
                />
                <span className="flex flex-col">
                  <span className="font-semibold">{subjectLabel(s)}</span>
                  <span className="text-sm text-muted">
                    {c
                      ? `同意済み（${jpDateTime(c.grantedAt)}）`
                      : s.kind === "child"
                        ? s.canConsent
                          ? "親が法定代理人として同意します"
                          : "世帯の持ち主・共同の管理の人が、法定代理人として押します"
                        : s.canConsent
                          ? s.mine || data.role === "guest"
                            ? ""
                            : "本人にこの画面を見せて、本人が決めてから押してください"
                          : "本人がログインして押します"}
                  </span>
                </span>
              </label>
            );
          })}
          {hasChild && <p className="rounded-xl bg-sky-soft px-3 py-2 text-sm">{CHILD_NOTE}</p>}
          {waiting.length > 0 && <p className="text-sm text-muted">{waiting.map(subjectLabel).join("・")}の分は、本人（子は管理の人）が押すまで、その人の記録は残しません。</p>}
          {open.length > 0 ? (
            <Btn onClick={() => void grant()} disabled={busy || picked.size === 0} full>
              {busy ? "記録しています…" : "読んだうえで、同意する"}
            </Btn>
          ) : (
            !done && <p className="text-base">押せる本人の分は、もう同意しています。</p>
          )}
          <Btn href={`/account?familyId=${encodeURIComponent(familyId)}`} kind="quiet">
            同意しない（アカウントの画面へ）
          </Btn>
        </Box>
      )}
      <Msg msg={msg} />
      {(done || (data && open.length === 0)) && after?.(q.next, familyId)}
    </main>
  );
}
