"use client";

// 健診で見せる記録（家族の声②の C・2026-11-05・作り手が承認したプラン https://claude.ai/artifact/3XseGBAg5LzK2UWgvoCJRK ）。
// 健診の時に、からだの記録の表と線・健診で聞きたい事などを、1枚にして見せる・渡す。渡し方は3つ:
//   画面でそのまま見せる ／ A4 で印刷する（一冊の印刷と同じ型）／ 共有シートで送る（既定は要約の1行。表の全部は選んだ時だけ）。
// 上の段（選ぶ所・ボタン）は画面の言葉で、下の1枚は病院あてなので日本語で描く（LocaleScope）。
// 何を出してよいか・ママの欄を誰が選べるかは lib/share-view.ts（API: /api/techo/share）。名前は出さず、手で書く欄を置く。
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { LocaleScope } from "@/components/LocaleProvider";
import { ShareSheetView } from "@/components/techo/ShareSheet";
import { Btn, plainError, ShareButton } from "@/components/ui";
import { t } from "@/lib/i18n";
import { shareFull, shareSummary } from "@/lib/share-text";
import { SHARE_BUNDLES, type ShareBundle, type ShareSheet, type ShareViewer } from "@/lib/share-view";

type Resp = { viewer: ShareViewer; choices: { id: ShareBundle; on: boolean }[]; sheet: ShareSheet };

/** 束の名前（画面の言葉で訳す） */
const BUNDLE_LABEL: Record<ShareBundle, string> = {
  body: "ママの体重・血圧など（妊婦健診と家で測った物）",
  growth: "子の身長・体重・頭囲",
  checkups: "健診の日",
  vaccines: "予防接種",
  next: "次の予約",
  questions: "健診で聞きたい事",
  motherHealth: "妊婦の健康状態（これまでの病気・アレルギー・薬など）",
};

/** 1枚は日本語の辞書（空＝鍵の日本語のまま） */
const JA: Record<string, never> = {};

// 印刷は一冊（app/book/print）と同じ型で A4。大きな束（表の続く所）はページをまたいでよい。図・表の行・小さな束・足元は切らない
const CSS = `
@page { size: A4; margin: 12mm; }
@media print {
  body * { visibility: hidden; }
  .print-root, .print-root * { visibility: visible; }
  .print-root { position: absolute; left: 0; top: 0; width: 100%; }
  .no-print { display: none !important; }
  html, body { background: #fff !important; }
  .share-sheet { border: 0 !important; border-radius: 0 !important; padding: 0 !important; background: #fff !important; }
  .share-sheet figure, .share-sheet tr, .share-sheet .keep, .share-sheet footer { break-inside: avoid; }
  .share-sheet h3 { break-after: avoid; }
  .share-sheet svg { max-height: 85mm; }
}
`;

export default function TechoSharePage() {
  const { family, today } = useFamily();
  const at = `${family.id}|${today}`;
  // 家族が選び直した束（まだ選んでいなければ、はじめの入り切り）。家族や日を替えたら、はじめに戻る
  const [pick, setPick] = useState<{ at: string; ids: ShareBundle[] } | null>(null);
  const sel = pick && pick.at === at ? pick.ids : null;
  const want = sel ? sel.join(",") : null;
  const [data, setData] = useState<Resp | null>(null);
  const [state, setState] = useState<"load" | "ok" | "error">("load");
  const [error, setError] = useState("");
  const [full, setFull] = useState(false);
  const [showing, setShowing] = useState(false);

  useEffect(() => {
    let alive = true;
    const q = `/api/techo/share?familyId=${encodeURIComponent(family.id)}&today=${today}${want !== null ? `&bundles=${want}` : ""}`;
    api<Resp>(q)
      .then((r) => {
        if (!alive) return;
        setData(r);
        setState("ok");
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(plainError(e));
        setState("error");
      });
    return () => {
      alive = false;
    };
  }, [family.id, today, want]);

  const on = sel ?? data?.choices.filter((c) => c.on).map((c) => c.id) ?? [];
  const toggle = (id: ShareBundle) => {
    const next = on.includes(id) ? on.filter((x) => x !== id) : [...on, id];
    setPick({ at, ids: SHARE_BUNDLES.map((b) => b.id).filter((b) => next.includes(b)) });
  };
  const sheet = data?.sheet ?? null;
  const text = sheet ? (full ? shareFull(sheet, today) : shareSummary(sheet, today)) : "";
  const show = () => {
    setShowing(true);
    window.scrollTo({ top: 0 });
  };

  return (
    <main className="flex flex-col gap-4 px-4 pt-4 pb-8">
      <style>{CSS}</style>
      {showing ? (
        <div className="no-print flex items-center justify-between gap-3">
          <p className="text-sm text-muted">{t("この画面を、そのまま見せてください。")}</p>
          <Btn kind="secondary" onClick={() => setShowing(false)}>
            {t("閉じる")}
          </Btn>
        </div>
      ) : (
        <div className="no-print flex flex-col gap-3">
          <Link href="/techo#body" className="inline-flex min-h-11 items-center self-start text-sm text-muted underline-offset-2 hover:underline">
            {t("‹ 手帳へ")}
          </Link>
          <h1 className="font-display text-xl font-bold">{t("健診で見せる記録")}</h1>
          <p className="text-base text-muted">{t("健診の時に、この1枚を見せたり、印刷して渡したりできます。下の1枚は、病院で読めるように日本語で作っています。")}</p>
          {data && data.choices.length > 0 && (
            <fieldset className="flex flex-col gap-1 rounded-2xl border border-line bg-card p-4">
              <legend className="px-1 text-sm font-semibold text-muted">{t("1枚に入れる物")}</legend>
              {data.choices.map((c) => (
                <label key={c.id} className="flex min-h-11 items-center gap-3 text-base">
                  <input type="checkbox" className="size-5 shrink-0 accent-rose" checked={on.includes(c.id)} onChange={() => toggle(c.id)} />
                  <span>{t(BUNDLE_LABEL[c.id])}</span>
                </label>
              ))}
            </fieldset>
          )}
          {state === "ok" && sheet && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <Btn onClick={show}>{t("画面でそのまま見せる")}</Btn>
                <Btn kind="secondary" onClick={() => window.print()}>
                  {t("A4 で印刷する")}
                </Btn>
                {/* 訳さない: 送る文は病院あてなので、題も日本語（lib/share-text.ts） */}
                <ShareButton title="健診で見せる記録" text={text} label={t("共有シートで送る")} />
              </div>
              <label className="flex min-h-11 items-center gap-3 text-base">
                <input type="checkbox" className="size-5 shrink-0 accent-rose" checked={full} onChange={(e) => setFull(e.target.checked)} />
                <span>{t("送る文に、表の全部を入れる（入れない時は要約の1行）")}</span>
              </label>
              <p className="text-sm text-muted">{t("渡した紙と送った文は、取り消せません。")}</p>
            </div>
          )}
          {state === "load" && <p className="text-base text-muted">{t("開いています…")}</p>}
          {state === "error" && <p className="rounded-xl bg-alert/10 px-4 py-3 text-base text-alert">{error}</p>}
        </div>
      )}

      {sheet && (
        <div className="print-root">
          <LocaleScope lang="ja" dict={JA}>
            <ShareSheetView sheet={sheet} today={today} />
          </LocaleScope>
        </div>
      )}
    </main>
  );
}
