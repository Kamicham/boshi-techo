"use client";

// ② 町の調べ: 一番上に「どこへ・何を持って」。窓口は地図で開け、家族へ LINE で渡せる。
// 出典・根拠・確かめる事は「なぜ？」の奥へ。
import { useState } from "react";
import type { LocalInfo } from "@/lib/local";
import { Btn, HandoffRow, Why } from "../ui";
import { ErrorLine, Working } from "./Working";

/** 役所のページ（.lg.jp・.go.jp など）か */
function isOfficial(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return /\.(lg|go)\.jp$/.test(h) || /^(www\.)?(city|town|vill|pref)\./.test(h);
  } catch {
    return false;
  }
}

function mdDate(s: string) {
  const [, m, d] = s.slice(0, 10).split("-").map(Number);
  return `${m}月${d}日`;
}

/** 地図で探す言葉: 住所 → 役所の名前 → 町の役所 */
function placeOf(l: LocalInfo): string {
  if (l.address) return `${l.office} ${l.address}`.trim();
  if (l.office) return l.office.startsWith(l.prefecture) || l.office.startsWith(l.city) ? l.office : `${l.prefecture}${l.office}`;
  return `${l.prefecture}${l.city}${/[市区]$/.test(l.city) ? "役所" : "役場"}`;
}

export function LocalPanel(p: { city: string; title: string; local: LocalInfo | null; busy: boolean; err: string; onRetry: () => void; onRefresh: () => void }) {
  const { local } = p;
  return (
    <section aria-label={`${p.city}での手続き`} className="flex flex-col gap-3 rounded-2xl bg-sky-soft/60 p-4">
      {p.busy && (
        <Working
          steps={[
            { at: 0, text: `${p.city}の公式サイトを探しています` },
            { at: 15, text: "見つけたページを読み比べています" },
            { at: 45, text: "窓口・持ち物・期限を拾っています" },
            { at: 75, text: "短く整えています（もう少し）" },
          ]}
          then="できたら、ここに「どこへ・何を持って」が出ます"
        />
      )}
      {p.err && <ErrorLine text={p.err} onRetry={p.onRetry} />}
      {local && !p.busy && <LocalBody local={local} title={p.title} onRefresh={p.onRefresh} />}
    </section>
  );
}

function LocalBody({ local, title, onRefresh }: { local: LocalInfo; title: string; onRefresh: () => void }) {
  const [allWhere, setAllWhere] = useState(false);
  const place = placeOf(local);
  const text = [
    `${title}（${local.city}）`,
    `どこへ: ${local.where}`,
    local.bring.length ? `持ち物: ${local.bring.join("、")}` : "",
    `いつまで: ${local.deadline}`,
    local.address ? `${local.office} ${local.address}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-muted">どこへ</p>
        <p className={`font-display text-xl leading-snug font-bold ${allWhere ? "" : "line-clamp-3"}`}>{local.where}</p>
        {!allWhere && local.where.length > 60 && (
          <button type="button" onClick={() => setAllWhere(true)} className="min-h-11 self-start text-sm text-muted underline">
            全部見る
          </button>
        )}
      </div>

      {local.bring.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-muted">何を持って</p>
          <ul className="flex flex-col gap-1">
            {local.bring.map((b) => (
              <li key={b} className="flex gap-2 text-base">
                <span className="text-sky" aria-hidden>
                  ●
                </span>
                <span className="line-clamp-2 min-w-0">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-base">
        <span className="mr-2 text-sm font-semibold text-muted">いつまで</span>
        {local.deadline}
      </p>

      <HandoffRow place={place} line={text} share={{ title, text }} />

      <Why label="ネットで出す・町だけの事">
        <p>ネットで: {local.online}</p>
        <p>
          {local.city}だけの事: {local.extras}
        </p>
      </Why>

      <Why label="出典・確かめる事">
        <p>{local.summary}</p>
        {local.caution && <p>{local.caution}</p>}
        {local.sources.length === 0 && <p>出典のページが取れませんでした。窓口で確かめてください。</p>}
        <ul className="flex flex-col gap-1">
          {local.sources.map((s) => (
            <li key={s.url} className="min-w-0">
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="break-all text-sky underline underline-offset-2">
                {s.title || s.url}
              </a>
              {isOfficial(s.url) && <span className="ml-1 text-xs font-semibold text-ok">役所のページ</span>}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="tabular">{mdDate(local.researchedAt)}に調べた・制度は変わる事があります</span>
          <Btn kind="quiet" onClick={onRefresh}>
            調べ直す
          </Btn>
        </div>
      </Why>
    </>
  );
}
