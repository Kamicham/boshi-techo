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
import { STAGES, autoStage, bringList, familyMessage, lineMessage, looksStuck, type VisitStage, type VisitView } from "@/lib/visit";

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
          ← 健診
        </Link>
        {err ? (
          <Notice title="健診の記録を開けませんでした" safe="記録は消えていません。電波のある所で開き直してください" detail={err}>
            <Btn kind="secondary" onClick={() => void load()}>
              もう一度開く
            </Btn>
          </Notice>
        ) : (
          <p className="text-base text-muted">読み込んでいます…</p>
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
  const message = familyMessage(visit, jpDate);
  const lineText = lineMessage(visit);

  return (
    <main className="flex flex-col gap-4 px-4 pt-3 pb-6">
      {/* 上の1行: 戻る・何の健診か（録音中は戻れない） */}
      <div className="flex min-h-11 items-center justify-between gap-2">
        {recording ? (
          <span className="text-base font-semibold text-rose">録音中</span>
        ) : (
          <Link href="/visit" className="inline-flex min-h-11 items-center text-base text-muted">
            ← 健診
          </Link>
        )}
        <span className="flex items-center gap-2 text-sm text-muted">
          {visit.demo && <Pill tone="sky">デモ</Pill>}
          <span className="tabular">{jpDate(visit.date)}</span>
          <span className="text-sky">{visit.label}</span>
        </span>
      </div>

      {/* 段の帯（録音中は出さない＝止めるボタンを一番上に） */}
      {!recording && (
        <nav aria-label="健診の段" className="grid grid-cols-5 gap-1">
          {STAGES.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => go(s.key)}
              aria-current={i === stageIdx ? "step" : undefined}
              className="flex min-h-11 flex-col items-center justify-end gap-1"
            >
              <span className={`text-sm ${i === stageIdx ? "font-bold text-rose" : "text-muted"}`}>{s.label}</span>
              <span className={`h-1.5 w-full rounded-full ${i < stageIdx ? "bg-rose/40" : i === stageIdx ? "bg-rose" : "bg-line"}`} />
            </button>
          ))}
        </nav>
      )}

      {err && <Notice title="今の操作が、まだ手帳に届いていません" safe="録音と記録は消えていません。電波のある所でもう一度押してください" detail={err} />}

      {/* ① 着く */}
      {stage === "arrive" && (
        <NextStep eyebrow={visit.label} title="病院に着いたら、押す">
          <Btn onClick={() => go("guide")}>着いた</Btn>
          <Why label={`持ち物 ${bringList(family, visit.date).length}`}>
            <ul className="flex flex-col gap-1 text-base text-ink">
              {bringList(family, visit.date).map((b) => (
                <li key={b}>・{b}</li>
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
              title={hasAudio ? "まとめを作れませんでした" : "録音が手帳に届きませんでした"}
              safe={hasAudio ? "録音は消えていません。まとめは「読む」から作り直せます" : "もう一度録音してください"}
              detail={visit.error}
            />
          )}
          <Recorder visit={visit} onFinished={() => void load()} />
          {agenda.length > 0 && !recording && (
            <Fold title="今日聞く事" count={agenda.length}>
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
                <p>聞けたら印を付けると、整理の時に先生の答えを探します。{asked > 0 ? `（${asked}件 聞けた）` : ""}</p>
              </Why>
            </Fold>
          )}
        </div>
      )}
      {stage === "record" && !canRecord && (
        <NextStep title="録音は済みました" tone="ok">
          <Btn onClick={() => go("read")}>まとめを読む</Btn>
        </NextStep>
      )}

      {/* ④ 帰り道に読む */}
      {stage === "read" && (
        <>
          {processing && (
            <section aria-live="polite" className="flex flex-col gap-3 rounded-2xl bg-sky-soft p-5">
              <p className="text-sm font-semibold text-muted">{visit.status === "transcribing" ? "1/2 文字にしています" : "2/2 整理しています"}</p>
              <h2 className="font-display text-2xl leading-snug font-bold">まとめを作っています</h2>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                <div className={`h-full animate-pulse rounded-full bg-sky ${visit.status === "transcribing" ? "w-1/2" : "w-full"}`} />
              </div>
              <p className="text-base">閉じても大丈夫。{visit.status === "transcribing" ? "1〜2分" : "1分"}ほどで出ます</p>
              {stuck && <Btn onClick={() => void retry()}>止まっているので、やり直す</Btn>}
            </section>
          )}
          {visit.status === "failed" && (
            <Notice
              title="まとめを作れませんでした"
              safe={hasAudio ? "録音は消えていません。まとめだけ作り直します" : "録音が手帳に届いていません。もう一度録音してください"}
              detail={visit.error ?? undefined}
            >
              {hasAudio ? <Btn onClick={() => void retry()}>まとめを作り直す</Btn> : <Btn onClick={() => go("record")}>録音へ</Btn>}
            </Notice>
          )}
          {visit.status === "done" && <Results visit={visit} today={today} onSend={() => go("send")} />}
          {(visit.status === "ready" || visit.status === "recording") && (
            <NextStep title="まだ録音していません" tone="sky">
              <Btn onClick={() => go("record")}>録音へ</Btn>
            </NextStep>
          )}
        </>
      )}

      {/* ⑤ 家族に送る */}
      {stage === "send" &&
        (visit.status === "done" && visit.result ? (
          <>
            {/* 主は1つ（LINE）。共有とコピーは添えるだけ。LINE には短い文、共有・コピーは3行の全文 */}
            <NextStep title="一緒に読んでもらう" tone="rose">
              <Btn href={lineUrl(lineText)}>LINE で家族に送る</Btn>
              <ShareButton title={`${visit.label}の健診`} text={message} label="ほかのアプリで" />
            </NextStep>
            <CopyField label="3行の全文" value={message} long />
          </>
        ) : (
          <NextStep title="まとめができたら送れます" tone="sky">
            <Btn onClick={() => go("read")}>戻る</Btn>
          </NextStep>
        ))}

      {/* 前後の段へ小さく */}
      {!recording && (
        <div className="flex justify-between">
          {stageIdx > 0 ? (
            <Btn kind="quiet" onClick={() => go(STAGES[stageIdx - 1].key)}>
              ← {STAGES[stageIdx - 1].label}
            </Btn>
          ) : (
            <span />
          )}
          {stageIdx < STAGES.length - 1 && (
            <Btn kind="quiet" onClick={() => go(STAGES[stageIdx + 1].key)}>
              {STAGES[stageIdx + 1].label} →
            </Btn>
          )}
        </div>
      )}

      <div className={`flex justify-end ${recording ? "hidden" : ""}`}>
        {confirmDelete ? (
          <div className="flex items-center gap-2 text-sm">
            <span>録音も一緒に消えます</span>
            <button type="button" onClick={() => void del()} className="min-h-11 rounded-full bg-alert px-4 font-semibold text-white">
              消す
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="min-h-11 px-3 text-muted">
              やめる
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="min-h-11 text-sm text-muted underline">
            この健診の記録を消す
          </button>
        )}
      </div>
    </main>
  );
}
