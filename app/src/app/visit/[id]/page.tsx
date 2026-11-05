"use client";

// ⑤ 健診の日を段の流れに: 着く → 受付・道案内 → 診察で録音 → 帰り道に読む → 家族に送る。
// 上に細い段の帯、今の段の「やる1つ」だけを大きく。録音中は段を動かさない（録音を止めないため）。
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { recordingBusy, recordingBusyServer, subscribeRecording } from "@/lib/recording-state";
import { api, useFamily } from "@/components/FamilyProvider";
import { jpDate } from "@/components/Techo";
import { Btn, CopyField, Fold, NextStep, Notice, Pill, plainError, ShareButton, Why } from "@/components/ui";
import { lineUrl } from "@/lib/handoff";
import { Guide } from "@/components/visit/Guide";
import { Recorder } from "@/components/visit/Recorder";
import { Results } from "@/components/visit/Results";
import { currentLang, HTML_LANG, LANG_NAMES, t, withLang, type Lang } from "@/lib/i18n";
import {
  STAGES,
  autoStage,
  bringList,
  familyMessage,
  familySendTexts,
  lineMessage,
  looksStuck,
  nextOfVisit,
  relabelVisit,
  sendLangChoice,
  type VisitStage,
  type VisitView,
} from "@/lib/visit";

const STAGE_KEY = (id: string) => `boshi.visitStage:${id}`;

function readStage(id: string): { stage: VisitStage; status: string } | null {
  try {
    const v = localStorage.getItem(STAGE_KEY(id));
    return v ? (JSON.parse(v) as { stage: VisitStage; status: string }) : null;
  } catch {
    return null;
  }
}

export default function VisitDay() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { family: shown, families, today: shownToday } = useFamily();
  const [visit, setVisit] = useState<VisitView | null>(null);
  const [err, setErr] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** 本人が選んだ段（記録の状態が変わったら、状態に合う段へ戻す） */
  const [picked, setPicked] = useState<{ stage: VisitStage; status: string } | null>(() => (typeof window === "undefined" ? null : readStage(id)));
  /** 本人が選んだ送る文の言葉（家族の言葉でもまとめを書いた健診だけ選べる。選ぶ前は lib/visit.ts の sendLangChoice が決める） */
  const [sendPick, setSendPick] = useState<Lang | null>(null);
  const recording = useSyncExternalStore(subscribeRecording, recordingBusy, recordingBusyServer);

  const load = useCallback(async () => {
    try {
      const r = await api<{ visit: VisitView }>(`/api/visit/${id}`);
      setVisit(r.visit);
      setErr("");
    } catch (e) {
      setErr(plainError(e));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // 文字起こし・整理の間は3秒ごとに見に行く
  const processing = visit?.status === "transcribing" || visit?.status === "organizing";
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [processing, load]);

  const retry = async () => {
    try {
      await api(`/api/visit/${id}/finish`, { body: {} });
      await load();
    } catch (e) {
      setErr(plainError(e));
    }
  };

  const markAsked = async (itemId: string, asked: boolean) => {
    if (!visit) return;
    setVisit({ ...visit, agenda: visit.agenda?.map((a) => (a.id === itemId ? { ...a, asked } : a)) });
    try {
      await api(`/api/visit/${id}`, { method: "PATCH", body: { asked: { id: itemId, asked } } });
    } catch (e) {
      setErr(plainError(e));
    }
  };

  const del = async () => {
    try {
      await api(`/api/visit/${id}`, { method: "DELETE" });
      router.push("/visit");
    } catch (e) {
      setErr(plainError(e));
    }
  };

  if (!visit) {
    return (
      <main className="flex flex-col gap-4 px-4 pt-4">
        <Link href="/visit" className="inline-flex min-h-11 items-center text-base text-muted">
          ← {t("健診")}
        </Link>
        {err ? (
          <Notice title={t("健診の記録を開けませんでした")} safe={t("記録は消えていません。電波のある所で開き直してください")} detail={err}>
            <Btn kind="secondary" onClick={() => void load()}>
              {t("もう一度開く")}
            </Btn>
          </Notice>
        ) : (
          <p className="text-base text-muted">{t("読み込んでいます…")}</p>
        )}
      </main>
    );
  }

  // この健診の家族（上で選んでいる家族と違う時も、持ち物・あと◯日はこの家族で）
  const family = families.find((f) => f.id === visit.familyId) ?? shown;
  const today = family.id === shown.id ? shownToday : new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const stage: VisitStage = picked && picked.status === visit.status ? picked.stage : autoStage(visit);
  const go = (s: VisitStage) => {
    // 録音中は段を動かさない（画面が変わっても録音は続くが、止めるボタンを見失わないため）
    if (recording) return;
    const p = { stage: s, status: visit.status };
    setPicked(p);
    try {
      localStorage.setItem(STAGE_KEY(id), JSON.stringify(p));
    } catch {}
    window.scrollTo({ top: 0 });
  };
  const stageIdx = STAGES.findIndex((s) => s.key === stage);

  const stuck = processing && !visit.running && looksStuck(visit, Date.now(), 3);
  /** 録音（か文字起こし）が手帳に届いているか。届いていれば、まとめだけ作り直せる */
  const hasAudio = !!visit.transcript || !!visit.takes?.some((t) => t.chunks > 0);
  const canRecord = visit.status === "ready" || visit.status === "recording" || (visit.status === "failed" && !visit.transcript);
  const agenda = visit.agenda ?? [];
  const asked = agenda.filter((a) => a.asked).length;
  // 送る文に入る次の健診は、本人が確かめた日だけ（lib/visit.ts）。聞こえただけの日がある時は、確かめると入る事を添える
  // 家族に送る文は、中身の3行（Claude のまとめ）が日本語なので、枠（lib/visit.ts が組む）・日付・共有の題も日本語にそろえる
  // （画面が中文・English でも、送る文に言葉を混ぜない）
  const message = withLang("ja", () => familyMessage(visit, jpDate));
  const lineText = withLang("ja", () => lineMessage(visit));
  // 訳さない: 家族に送る文の題（上の送る文と同じく日本語）
  const shareTitle = `${visit.label}の健診`;
  // 家族の言葉（作り手の決め事②・切り替えの印 CLAUDE_LANG.visit の裏）: まとめを家族の言葉でも書いた健診だけ、送る文の言葉を
  // 日本語と家族の言葉から選べる。家族の言葉の文は、まとめの行も枠（日付・次の健診）もその言葉で組む（枠の言葉は健診の API の sendWords）
  const familyText = familySendTexts(visit, visit.sendWords ?? {}, jpDate);
  const sendLang = sendLangChoice(familyText?.lang, currentLang(), sendPick);
  const out = sendLang.lang !== "ja" && familyText ? familyText : { message, line: lineText, title: shareTitle };
  const bring = bringList(family, visit.date);
  const unchecked = nextOfVisit(visit)?.checked === false || (!!visit.result?.nextAppointment && !visit.nextCheck);

  return (
    <main className="flex flex-col gap-4 px-4 pt-3 pb-6">
      {/* 上の1行: 戻る・何の健診か（録音中は戻れない） */}
      <div className="flex min-h-11 items-center justify-between gap-2">
        {recording ? (
          <span className="text-base font-semibold text-rose">{t("録音中")}</span>
        ) : (
          <Link href="/visit" className="inline-flex min-h-11 shrink-0 items-center text-base whitespace-nowrap text-muted">
            ← {t("健診")}
          </Link>
        )}
        {/* 中文・English は言葉が長いので、日付と呼び名をそれぞれ1つの塊で折り返す（日本語は今までどおり1行） */}
        <span className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-sm text-muted">
          {visit.demo && <Pill tone="sky">{t("デモ")}</Pill>}
          <span className="tabular whitespace-nowrap">{jpDate(visit.date)}</span>
          <span className="whitespace-nowrap text-sky">{relabelVisit(visit.label)}</span>
        </span>
      </div>

      {/* 段の帯（録音中は出さない＝止めるボタンを一番上に） */}
      {!recording && (
        <nav aria-label={t("健診の段")} className="grid grid-cols-5 gap-1">
          {STAGES.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => go(s.key)}
              aria-current={i === stageIdx ? "step" : undefined}
              className="flex min-h-11 flex-col items-center justify-end gap-1"
            >
              <span className={`text-sm ${i === stageIdx ? "font-bold text-rose" : "text-muted"}`}>{t(s.label)}</span>
              <span className={`h-1.5 w-full rounded-full ${i < stageIdx ? "bg-rose/40" : i === stageIdx ? "bg-rose" : "bg-line"}`} />
            </button>
          ))}
        </nav>
      )}

      {err && <Notice title={t("今の操作が、まだ手帳に届いていません")} safe={t("録音と記録は消えていません。電波のある所でもう一度押してください")} detail={err} />}

      {/* ① 着く */}
      {stage === "arrive" && (
        <NextStep eyebrow={relabelVisit(visit.label)} title={t("病院に着いたら、押す")}>
          <Btn onClick={() => go("guide")}>{t("着いた")}</Btn>
          <Why label={t("持ち物 {n}", { n: bring.length })}>
            <ul className="flex flex-col gap-1 text-base text-ink">
              {bring.map((b) => (
                <li key={b}>・{t(b)}</li>
              ))}
            </ul>
          </Why>
        </NextStep>
      )}

      {/* ② 受付・院内の道案内 */}
      {stage === "guide" && <Guide visit={visit} onChange={(guide) => setVisit({ ...visit, guide })} onDone={() => go("record")} />}

      {/* ③ 診察で録音（録音の部品は段を移っても消さない＝途中の状態を守る） */}
      {canRecord && (
        <div className={stage === "record" ? "flex flex-col gap-3" : "hidden"}>
          {visit.status === "failed" && visit.error && (
            <Notice
              title={hasAudio ? t("まとめを作れませんでした") : t("録音が手帳に届きませんでした")}
              safe={hasAudio ? t("録音は消えていません。まとめは「読む」から作り直せます") : t("もう一度録音してください")}
              detail={visit.error}
            />
          )}
          <Recorder visit={visit} onFinished={() => void load()} />
          {agenda.length > 0 && !recording && (
            <Fold title={t("今日聞く事")} count={agenda.length}>
              {agenda.map((a) => (
                <label key={a.id} className="flex min-h-11 items-start gap-3 text-base">
                  <input
                    type="checkbox"
                    checked={!!a.asked}
                    onChange={(e) => void markAsked(a.id, e.target.checked)}
                    className="mt-1 h-6 w-6 shrink-0 accent-[var(--rose)]"
                  />
                  <span className={a.asked ? "text-muted line-through" : ""}>{a.text}</span>
                </label>
              ))}
              <Why>
                <p>
                  {t("聞けたら印を付けると、整理の時に先生の答えを探します。")}
                  {asked > 0 ? t("（{n}件 聞けた）", { n: asked }) : ""}
                </p>
              </Why>
            </Fold>
          )}
        </div>
      )}
      {stage === "record" && !canRecord && (
        <NextStep title={t("録音は済みました")} tone="ok">
          <Btn onClick={() => go("read")}>{t("まとめを読む")}</Btn>
        </NextStep>
      )}

      {/* ④ 帰り道に読む */}
      {stage === "read" && (
        <>
          {processing && (
            <section aria-live="polite" className="flex flex-col gap-3 rounded-2xl bg-sky-soft p-5">
              <p className="text-sm font-semibold text-muted">{visit.status === "transcribing" ? t("1/2 文字にしています") : t("2/2 整理しています")}</p>
              <h2 className="font-display text-2xl leading-snug font-bold">{t("まとめを作っています")}</h2>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                <div className={`h-full animate-pulse rounded-full bg-sky ${visit.status === "transcribing" ? "w-1/2" : "w-full"}`} />
              </div>
              <p className="text-base">{visit.status === "transcribing" ? t("閉じても大丈夫。1〜2分ほどで出ます") : t("閉じても大丈夫。1分ほどで出ます")}</p>
              {stuck && <Btn onClick={() => void retry()}>{t("止まっているので、やり直す")}</Btn>}
            </section>
          )}
          {visit.status === "failed" && (
            <Notice
              title={t("まとめを作れませんでした")}
              safe={hasAudio ? t("録音は消えていません。まとめだけ作り直します") : t("録音が手帳に届いていません。もう一度録音してください")}
              detail={visit.error ?? undefined}
            >
              {hasAudio ? <Btn onClick={() => void retry()}>{t("まとめを作り直す")}</Btn> : <Btn onClick={() => go("record")}>{t("録音へ")}</Btn>}
            </Notice>
          )}
          {visit.status === "done" && <Results visit={visit} today={today} family={family} onSend={() => go("send")} onChange={setVisit} />}
          {(visit.status === "ready" || visit.status === "recording") && (
            <NextStep title={t("まだ録音していません")} tone="sky">
              <Btn onClick={() => go("record")}>{t("録音へ")}</Btn>
            </NextStep>
          )}
        </>
      )}

      {/* ⑤ 家族に送る */}
      {stage === "send" &&
        (visit.status === "done" && visit.result ? (
          <>
            {/* 送る文の言葉（家族の言葉でもまとめを書いた健診だけ。日本語と家族の言葉の2つ。招待の「送る文の言葉」と同じ形） */}
            {sendLang.choices.length > 0 && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-base font-semibold">{t("送る文の言葉")}</legend>
                <div className="flex flex-wrap gap-2">
                  {sendLang.choices.map((l) => (
                    <button
                      key={l}
                      type="button"
                      lang={HTML_LANG[l]}
                      aria-pressed={sendLang.lang === l}
                      onClick={() => setSendPick(l)}
                      className={`min-h-11 rounded-full px-5 text-base font-semibold ${sendLang.lang === l ? "bg-rose text-white" : "bg-rose-soft text-rose"}`}
                    >
                      {LANG_NAMES[l]}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            {/* 主は1つ（LINE）。共有とコピーは添えるだけ。LINE には短い文、共有・コピーは3行の全文 */}
            <NextStep title={t("一緒に読んでもらう")} tone="rose">
              <Btn href={lineUrl(out.line)}>{t("LINE で家族に送る")}</Btn>
              <ShareButton title={out.title} text={out.message} label={t("ほかのアプリで")} />
            </NextStep>
            <CopyField label={t("3行の全文")} value={out.message} long />
            {unchecked && (
              <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
                <span>{t("次の健診の日を確かめると、送る文にも入ります")}</span>
                <button type="button" onClick={() => go("read")} className="min-h-11 underline underline-offset-2">
                  {t("確かめる")}
                </button>
              </p>
            )}
          </>
        ) : (
          <NextStep title={t("まとめができたら送れます")} tone="sky">
            <Btn onClick={() => go("read")}>{t("戻る")}</Btn>
          </NextStep>
        ))}

      {/* 前後の段へ小さく */}
      {!recording && (
        <div className="flex justify-between">
          {stageIdx > 0 ? (
            <Btn kind="quiet" onClick={() => go(STAGES[stageIdx - 1].key)}>
              ← {t(STAGES[stageIdx - 1].label)}
            </Btn>
          ) : (
            <span />
          )}
          {stageIdx < STAGES.length - 1 && (
            <Btn kind="quiet" onClick={() => go(STAGES[stageIdx + 1].key)}>
              {t(STAGES[stageIdx + 1].label)} →
            </Btn>
          )}
        </div>
      )}

      <div className={`flex justify-end ${recording ? "hidden" : ""}`}>
        {confirmDelete ? (
          <div className="flex items-center gap-2 text-sm">
            <span>{t("録音も一緒に消えます")}</span>
            <button type="button" onClick={() => void del()} className="min-h-11 rounded-full bg-alert px-4 font-semibold text-white">
              {t("消す")}
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="min-h-11 px-3 text-muted">
              {t("やめる")}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="min-h-11 text-sm text-muted underline">
            {t("この健診の記録を消す")}
          </button>
        )}
      </div>
    </main>
  );
}
