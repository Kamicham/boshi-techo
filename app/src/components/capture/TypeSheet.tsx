"use client";

// 打つ（VISION ①「入力ゼロ、でも押し付けない」2026-11-04・子どもを産んだ事のある家族の声「入力ゼロは逆に使いづらい」）。
// 話す・撮ると同じ重さで並べる3つ目の入れ方。打つ方が早い物（体重・血圧・体温・身長・日付・時刻・短い一言）を、その場で打つ。
// 打った物は家族が自分で書いた物なので、Claude を通さず、OK 待ちにもせず、そのまま手帳と記録に入る。
// 数字は数字のキーボード、日付は日付の選び、予定は時刻も。週数・医療機関などは手帳が知っている値を先に入れておく（lib/techo-prefill.ts）。
import Link from "next/link";
import { useMemo, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { useTecho } from "@/components/techo/useTecho";
import { Btn, plainError } from "@/components/ui";
import { MANUAL_KINDS, type ManualKind } from "@/lib/manual-entry";
import { TECHO_FORMS } from "@/lib/techo-fields";
import { techoPrefill } from "@/lib/techo-prefill";

type Pick = "checkup" | "size" | "temp" | "note" | "plan";

const field = "min-h-11 w-full rounded-lg border border-line bg-card px-3 text-base text-ink";

/** 数の欄（単位は欄の右に出したまま） */
function NumberField({ label, unit, value, onChange, placeholder }: { label: string; unit?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-muted">
      {label}
      <span className="flex items-center gap-2">
        <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={field} />
        {unit && <span className="shrink-0 text-base text-ink">{unit}</span>}
      </span>
    </label>
  );
}

function DateField({ label, value, onChange, min, max }: { label: string; value: string; onChange: (v: string) => void; min?: string; max?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-muted">
      {label}
      <input type="date" value={value} min={min} max={max} onChange={(e) => onChange(e.target.value)} className={field} />
    </label>
  );
}

export function TypeSheet({ onClose, onSaved }: { onClose: () => void; onSaved: (message: string) => void }) {
  const { family, today, me } = useFamily();
  const { items, add } = useTecho();
  const born = !!family.birthDate && family.birthDate <= today;
  const child = family.childName ?? "赤ちゃん";
  const mama = family.members.find((m) => m.role === "母");
  const mamaCall = mama?.callName ?? mama?.name ?? "ママ";
  const [pick, setPick] = useState<Pick | null>(null);
  const [date, setDate] = useState(today);
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [kind, setKind] = useState<ManualKind>("できごと");
  const [time, setTime] = useState("");
  const [deadline, setDeadline] = useState(false);
  const [who, setWho] = useState(me?.name ?? "");
  // 生まれた後の気がかり: だれの健診で聞くか（1回だけ選ぶ）
  const [about, setAbout] = useState<"mother" | "child" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // 時期に合わせて「よく打つ物」を上に並べる
  const picks: { key: Pick; label: string; sub: string }[] = [
    born ? { key: "size", label: "体重・身長", sub: `${child}・kg・cm` } : { key: "checkup", label: "健診の体重・血圧", sub: "週数は入っています" },
    { key: "temp", label: "体温", sub: "℃" },
    { key: "note", label: "ひとこと", sub: "できごと・気がかり・メモ" },
    { key: "plan", label: "予定・期限", sub: "日付と時刻" },
  ];
  const checkupFields = useMemo(() => (TECHO_FORMS["pregnancy-checkup"]?.fields ?? []).filter((f) => ["week", "weightKg", "bpHigh", "bpLow", "facility"].includes(f.key)), []);

  const open = (p: Pick) => {
    setPick(p);
    setError("");
    setDate(today);
    setTime("");
    setDeadline(false);
    setKind(p === "plan" ? "予定" : "できごと");
    setAbout(null);
    setRaw(p === "checkup" ? techoPrefill("pregnancy-checkup", family, today, items) : {});
    if (p === "temp") setWho(born ? child : (me?.name ?? ""));
  };

  const set = (k: string) => (v: string) => setRaw((cur) => ({ ...cur, [k]: v }));

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      if (pick === "checkup" || pick === "size") {
        const keys = pick === "checkup" ? checkupFields.map((f) => f.key) : ["weightKg", "heightCm", "headCm"];
        const values = Object.fromEntries(keys.map((k) => [k, (raw[k] ?? "").trim()]).filter(([, v]) => v));
        // 週数と医療機関は先に入っているので、体の数字が1つも無い時は止める
        if (!Object.keys(values).some((k) => !["week", "facility"].includes(k))) throw new Error("数字を1つ入れてください");
        if (pick === "checkup") await add({ page: "pregnancy-checkup", date, title: TECHO_FORMS["pregnancy-checkup"]!.title(values), values });
        else await add({ page: "growth", date, title: "身長・体重など", values });
        onSaved(pick === "checkup" ? "妊娠中の経過（妊婦健診）のページに入れました" : "成長のページに入れました（曲線に点が付きます）");
      } else if (pick === "temp") {
        await api("/api/capture/manual", { body: { familyId: family.id, today, temperature: raw.temp ?? "", date, who } });
        onSaved("体温を記録に入れました");
      } else {
        const asking = kind === "気がかり" && born;
        if (asking && !about) throw new Error(`${mamaCall}の事か、${child}の事かを選んでください`);
        const r = await api<{ agenda?: "mother" | "child" | null }>("/api/capture/manual", {
          body: { familyId: family.id, today, kind, title: raw.title ?? "", date, time, deadline, who: me?.name, concernFor: asking ? about : undefined },
        });
        onSaved(
          kind === "予定"
            ? deadline
              ? "期限として入れました（いまのやる事に並びます）"
              : "予定に入れました"
            : r.agenda === "child"
              ? `記録に入れ、${child}の次の健診で聞く事にも並べました`
              : r.agenda === "mother"
                ? "記録に入れ、次の健診の『先生に聞く事』にも並べました"
                : "記録に入れました",
        );
      }
      setPick(null);
      setRaw({});
    } catch (e) {
      setError(plainError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="打って入れる" className="flex flex-col gap-3 rounded-2xl border-2 border-ink/15 bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">{pick ? picks.find((p) => p.key === pick)?.label : "打って入れる"}</h2>
        <button type="button" onClick={pick ? () => setPick(null) : onClose} className="min-h-11 px-2 text-base text-muted">
          {pick ? "‹ 選び直す" : "閉じる"}
        </button>
      </div>

      {!pick && (
        <>
          <p className="text-sm text-muted">打った物は、そのまま手帳に入ります（AI には送りません）</p>
          <ul className="grid grid-cols-2 gap-2">
            {picks.map((p) => (
              <li key={p.key}>
                <button type="button" onClick={() => open(p.key)} className="flex min-h-20 w-full flex-col items-start justify-center gap-0.5 rounded-xl border border-line bg-paper px-3 py-2 text-left">
                  <span className="text-base font-semibold">{p.label}</span>
                  <span className="text-sm text-muted">{p.sub}</span>
                </button>
              </li>
            ))}
          </ul>
          <Link href="/techo" className="inline-flex min-h-11 items-center self-start text-base font-semibold text-sky">
            ほかの欄に打つ（検査・接種・できた日） ›
          </Link>
        </>
      )}

      {pick === "checkup" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <DateField label="健診の日" value={date} onChange={setDate} max={today} />
          </div>
          {checkupFields.map((f) =>
            f.unit || f.key.startsWith("bp") ? (
              <NumberField key={f.key} label={f.label} unit={f.unit} value={raw[f.key] ?? ""} onChange={set(f.key)} />
            ) : (
              <label key={f.key} className={`flex flex-col gap-1 text-sm text-muted ${f.key === "facility" ? "col-span-2" : ""}`}>
                {f.label}
                <input value={raw[f.key] ?? ""} onChange={(e) => set(f.key)(e.target.value)} placeholder={f.hint} className={field} />
              </label>
            ),
          )}
        </div>
      )}

      {pick === "size" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <DateField label="測った日" value={date} onChange={setDate} min={family.birthDate} max={today} />
          </div>
          <NumberField label="体重" unit="kg" value={raw.weightKg ?? ""} onChange={set("weightKg")} placeholder="例 6.2" />
          <NumberField label="身長" unit="cm" value={raw.heightCm ?? ""} onChange={set("heightCm")} />
          <NumberField label="頭囲" unit="cm" value={raw.headCm ?? ""} onChange={set("headCm")} />
        </div>
      )}

      {pick === "temp" && (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="体温" unit="℃" value={raw.temp ?? ""} onChange={set("temp")} placeholder="例 36.8" />
          <DateField label="測った日" value={date} onChange={setDate} max={today} />
          <div className="col-span-2 flex flex-wrap gap-2" role="group" aria-label="だれの体温">
            {[...(born ? [child] : []), ...family.members.map((m) => m.name)].map((n) => (
              <button key={n} type="button" aria-pressed={who === n} onClick={() => setWho(n)} className={`min-h-11 rounded-full border px-4 text-base ${who === n ? "border-rose bg-rose text-white" : "border-line bg-paper"}`}>
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {(pick === "note" || pick === "plan") && (
        <div className="flex flex-col gap-2">
          {pick === "note" && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="何の記録">
              {MANUAL_KINDS.filter((k) => k !== "予定").map((k) => (
                <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`min-h-11 rounded-full border px-4 text-base ${kind === k ? "border-rose bg-rose text-white" : "border-line bg-paper"}`}>
                  {k}
                </button>
              ))}
            </div>
          )}
          <label className="flex flex-col gap-1 text-sm text-muted">
            {pick === "plan" ? "何の予定・期限" : "ひとこと"}
            <input
              value={raw.title ?? ""}
              onChange={(e) => set("title")(e.target.value)}
              maxLength={80}
              placeholder={pick === "plan" ? "例: 保育園の見学" : kind === "気がかり" ? "例: 夜に足がつる" : "例: 初めて声を出して笑った"}
              className={field}
            />
          </label>
          {kind === "気がかり" && born && (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="だれの事">
              <span className="text-sm text-muted">だれの事？</span>
              {(
                [
                  ["mother", `${mamaCall}の事`],
                  ["child", `${child}の事`],
                ] as const
              ).map(([k, label]) => (
                <button key={k} type="button" aria-pressed={about === k} onClick={() => setAbout(k)} className={`min-h-11 rounded-full border px-4 text-base ${about === k ? "border-rose bg-rose text-white" : "border-line bg-paper"}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {kind === "気がかり" && (
            <p className="text-sm text-muted">
              書いた事は、次の健診の「先生に聞く事」にも並びます。急ぎに見える時は、書くより先に電話を（<Link href="/emergency" className="font-semibold text-sky underline">急ぎの時</Link>）
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <DateField label={pick === "plan" ? "日付" : "その日"} value={date} onChange={setDate} max={pick === "plan" ? undefined : today} />
            {pick === "plan" && (
              <label className="flex flex-col gap-1 text-sm text-muted">
                時刻（あれば）
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} />
              </label>
            )}
          </div>
          {pick === "plan" && (
            <label className="flex min-h-11 items-center gap-2 text-base">
              <input type="checkbox" checked={deadline} onChange={(e) => setDeadline(e.target.checked)} className="h-5 w-5" />
              期限にする（いまの「やる事」に並ぶ）
            </label>
          )}
        </div>
      )}

      {pick && (
        <>
          {error && <p className="text-sm text-alert">{error}</p>}
          <div className="flex gap-2">
            <Btn onClick={() => void save()} disabled={busy}>
              {busy ? "入れています…" : "手帳に入れる"}
            </Btn>
          </div>
        </>
      )}
    </section>
  );
}
