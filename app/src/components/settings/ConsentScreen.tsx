"use client";

// 同意の画面の共通部分: 本人ごとに選んで「同意する」。子の分は親が代わりに押す（法定代理人。画面の言葉は lib/consent-screen.ts）。
// 中身の文（何に同意するか）は呼ぶ側が children で渡す。撤回はアカウントの画面から同じ手軽さで。
// 字は画面の言葉で出す（t()。同意の文は日本語が正本で、中文・English の画面だけ、同意の文の下に「訳は参考」の1行を出す＝統括 2026-11-05）
import { useEffect, useMemo, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { Btn } from "@/components/ui";
import { currentLang, listOf, t } from "@/lib/i18n";
import { nameIn } from "@/lib/i18n/names";
import { CHILD_NOTE, CONSENT_NAME, type ScreenConsentKind } from "./consent-texts";
import { childConsentLine } from "@/lib/consent-screen";
import { Box, Msg, SUBJECT_WORD, useHouseholdDetail, jpDateTime, safeNext, type HouseholdDetail, type SubjectView } from "./account-ui";

/** 本人の仮の名前（世帯を作る時、名前が空ならサーバが入れる既定＝app/api/account/household・lib/households.ts）。家族が入れた名前ではないので訳す */
const PLACEHOLDER_NAMES = new Set(["母", "ママ", "パートナー", "子", "おなかの子"]);

/** URL の ?familyId= と ?next=（読み終えるまで ready は false） */
export function useQuery(): { ready: boolean; familyId: string | null; next: string | null } {
  const [q, setQ] = useState<{ ready: boolean; familyId: string | null; next: string | null }>({ ready: false, familyId: null, next: null });
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setQ({ ready: true, familyId: p.get("familyId"), next: safeNext(p.get("next")) });
  }, []);
  return q;
}

/** 「母（美咲）・あなた」。中文・English は役の言葉を訳し、名前は nameIn に通す（仮の名前は訳す）。日本語は前と同じ字 */
export function subjectLabel(s: SubjectView): string {
  const who = SUBJECT_WORD[s.kind];
  const name = s.name && s.name !== who ? (PLACEHOLDER_NAMES.has(s.name) ? t(s.name) : nameIn(s.name)) : "";
  const label = `${t(who)}${name ? t("（{x}）", { x: name }) : ""}`;
  return s.mine ? t("{who}・あなた", { who: label }) : label;
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
  /** 同意した後に出す物（次の画面への入口など）。detail は世帯の中身（招けるかを見る） */
  after?: (next: string | null, familyId: string, detail: HouseholdDetail | null) => React.ReactNode;
}) {
  const { family, families, reload } = useFamily();
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
      setMsg({ ok: true, text: t("同意しました。アカウントの画面から、いつでも撤回できます") });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const hasChild = open.some((s) => s.kind === "child");
  // 子がもう生まれているか（「おなかの子」と「子」の言い分け）
  const born = !!(families.find((f) => f.id === familyId) ?? family).birthDate;
  const waiting = (data?.subjects ?? []).filter((s) => !s.canConsent && !current(s));

  return (
    <main className="flex flex-col gap-4 px-4 pt-4 pb-10">
      {/* 押した後の次の一手は、押した所（画面の下）でなく一番上にも出す（長い画面の下に隠れないように） */}
      {done && after?.(q.next, familyId, data ?? null)}
      <p className="text-sm font-semibold text-muted">{t("同意: {name}", { name: t(CONSENT_NAME[kind]) })}</p>
      <h1 className="font-display text-2xl font-bold text-balance">{title}</h1>
      <p className="text-base">{lead}</p>
      {children}
      {/* 中文・English の画面だけ: 同意の文は日本語が正本（日本語の画面には出さない） */}
      {currentLang() !== "ja" && <p className="text-sm text-muted">{t("日本語の文が正本です。この訳は参考です。")}</p>}

      {error && <Msg msg={{ ok: false, text: error }} />}
      {data && (
        <Box title={t("だれの分に同意しますか")}>
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
                      ? t("同意済み（{date}）", { date: jpDateTime(c.grantedAt) })
                      : s.kind === "child"
                        ? t(childConsentLine(s.canConsent, born))
                        : s.canConsent
                          ? s.mine || data.role === "guest"
                            ? ""
                            : t("本人にこの画面を見せて、本人が決めてから押してください")
                          : s.kind === "mother"
                            ? t("ママが手帳に入った時に、ママ本人が押します")
                            : t("本人がログインして押します")}
                  </span>
                </span>
              </label>
            );
          })}
          {hasChild && <p className="rounded-xl bg-sky-soft px-3 py-2 text-sm">{t(CHILD_NOTE)}</p>}
          {waiting.length > 0 && (
            <p className="text-sm text-muted">{t("{who}の分は、本人（子は管理の人）が押すまで、その人の記録は残しません。", { who: listOf(waiting.map(subjectLabel)) })}</p>
          )}
          {open.length > 0 ? (
            <Btn onClick={() => void grant()} disabled={busy || picked.size === 0} full>
              {busy ? t("記録しています…") : t("読んだうえで、同意する")}
            </Btn>
          ) : (
            !done && <p className="text-base">{t("押せる本人の分は、もう同意しています。")}</p>
          )}
          <Btn href={`/account?familyId=${encodeURIComponent(familyId)}`} kind="quiet">
            {t("同意しない（アカウントの画面へ）")}
          </Btn>
        </Box>
      )}
      <Msg msg={msg} />
      {!done && data && open.length === 0 && after?.(q.next, familyId, data)}
    </main>
  );
}
