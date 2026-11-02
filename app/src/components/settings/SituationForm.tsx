"use client";

// 家族の形を聞く欄（働き方・育休・上の子・生まれる子の数・里帰り・祖父母）。
// どの問いも「わからない・答えない」を選べる。答えない欄は、今までどおりの予定が出る。
// 押す所は 44px 以上。iPhone の 390px で横にはみ出さないよう、選びは折り返す。
import type { GrandparentPlace, Leave, MotherWork, Situation, Work } from "@/lib/situation";

const field = "min-h-12 w-full min-w-0 rounded-xl border border-line bg-card px-3 text-base";

const MOTHER_WORKS: MotherWork[] = ["会社員・公務員", "パート・派遣", "自営・フリー", "仕事なし", "出産で辞める"];
const WORKS: Work[] = ["会社員・公務員", "パート・派遣", "自営・フリー", "仕事なし"];
const LEAVES: Leave[] = ["取る", "取らない", "未定"];
const PLACES: GrandparentPlace[] = ["同居", "近く", "遠く", "いない"];

/** 育休の問いを出すか（雇われて働く時と、まだ答えていない時） */
const employed = (w: Work | MotherWork | undefined) => w === undefined || w === "会社員・公務員" || w === "パート・派遣";

/** 保存の前に、もう意味の無い答えを外す（例: 仕事なしを選んだのに残っている育休） */
export function tidySituation(s: Situation, hasPartner: boolean): Situation {
  const out: Situation = { ...s };
  if (!employed(out.motherWork)) delete out.motherLeave;
  if (!hasPartner) {
    delete out.partnerWork;
    delete out.partnerLeave;
    delete out.partnerNightShift;
    delete out.partnerAway;
    if (out.grandparents) out.grandparents = { mother: out.grandparents.mother };
  } else if (!employed(out.partnerWork)) delete out.partnerLeave;
  return out;
}

export function SituationForm({ value, onChange, hasPartner }: { value: Situation; onChange: (s: Situation) => void; hasPartner: boolean }) {
  const set = (patch: Partial<Situation>) => onChange({ ...value, ...patch });
  const older = value.olderChildren;
  const sato = value.satogaeri;

  return (
    <div className="flex flex-col gap-5">
      <Ask label="ママの働き方（妊娠中）">
        <Choice options={MOTHER_WORKS} value={value.motherWork} onPick={(v) => set({ motherWork: v })} name="mother-work" />
      </Ask>
      {employed(value.motherWork) && (
        <Ask label="ママの育休">
          <Choice options={LEAVES} value={value.motherLeave} onPick={(v) => set({ motherLeave: v })} name="mother-leave" />
        </Ask>
      )}

      {hasPartner ? (
        <>
          <Ask label="パートナーの働き方">
            <Choice options={WORKS} value={value.partnerWork} onPick={(v) => set({ partnerWork: v })} name="partner-work" />
          </Ask>
          {employed(value.partnerWork) && (
            <Ask label="パートナーの育休">
              <Choice options={LEAVES} value={value.partnerLeave} onPick={(v) => set({ partnerLeave: v })} name="partner-leave" />
            </Ask>
          )}
          <Ask label="パートナーに夜勤は？">
            <YesNo value={value.partnerNightShift} onPick={(v) => set({ partnerNightShift: v })} name="partner-night" />
          </Ask>
          <Ask label="パートナーは単身赴任中？">
            <YesNo value={value.partnerAway} onPick={(v) => set({ partnerAway: v })} name="partner-away" />
          </Ask>
        </>
      ) : (
        <p className="text-sm text-muted">パートナーの呼び名を入れると、パートナーの働き方も聞きます</p>
      )}

      <Ask label="上の子は？">
        <Choice
          options={["いない", "いる"] as const}
          value={older === undefined ? undefined : older.length ? "いる" : "いない"}
          onPick={(v) => set({ olderChildren: v === undefined ? undefined : v === "いない" ? [] : older?.length ? older : [""] })}
          name="older"
        />
        {!!older?.length && (
          <div className="flex flex-col gap-2">
            {older.map((ym, i) => (
              <div key={i} className="flex items-end gap-2">
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-muted">
                  {i + 1}人目の生まれた年月
                  <input
                    id={`older-${i}`}
                    type="month"
                    className={field}
                    value={ym}
                    onChange={(e) => set({ olderChildren: older.map((x, j) => (j === i ? e.target.value : x)) })}
                  />
                </label>
                <button
                  type="button"
                  aria-label={`${i + 1}人目を消す`}
                  onClick={() => {
                    const next = older.filter((_, j) => j !== i);
                    set({ olderChildren: next.length ? next : [] });
                  }}
                  className="min-h-12 min-w-12 shrink-0 rounded-xl border border-line text-base text-muted"
                >
                  消す
                </button>
              </div>
            ))}
            <button type="button" onClick={() => set({ olderChildren: [...older, ""] })} className="min-h-11 self-start rounded-full bg-rose-soft px-5 text-base font-semibold text-rose">
              ＋ もう1人
            </button>
          </div>
        )}
      </Ask>

      <Ask label="生まれる子は何人？">
        <Choice
          options={["1人", "双子", "三つ子"] as const}
          value={value.babies === undefined ? undefined : value.babies === 2 ? "双子" : value.babies === 3 ? "三つ子" : "1人"}
          onPick={(v) => set({ babies: v === undefined ? undefined : v === "双子" ? 2 : v === "三つ子" ? 3 : 1 })}
          name="babies"
        />
      </Ask>

      <Ask label="里帰り出産は？">
        <Choice
          options={["する", "しない"] as const}
          value={sato === undefined ? undefined : sato === null ? "しない" : "する"}
          onPick={(v) => set({ satogaeri: v === undefined ? undefined : v === "しない" ? null : (sato ?? { prefecture: "", city: "" }) })}
          name="satogaeri"
        />
        {sato && (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[2fr_3fr] gap-2">
              <input id="sato-pref" aria-label="里帰り先の都道府県" className={field} value={sato.prefecture} onChange={(e) => set({ satogaeri: { ...sato, prefecture: e.target.value } })} placeholder="鹿児島県" />
              <input id="sato-city" aria-label="里帰り先の市区町村" className={field} value={sato.city} onChange={(e) => set({ satogaeri: { ...sato, city: e.target.value } })} placeholder="霧島市" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex min-w-0 flex-col gap-1 text-sm text-muted">
                帰る日（目安）
                <input id="sato-from" type="date" className={field} value={sato.from ?? ""} onChange={(e) => set({ satogaeri: { ...sato, from: e.target.value || undefined } })} />
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-sm text-muted">
                戻る日（目安）
                <input id="sato-until" type="date" className={field} value={sato.until ?? ""} onChange={(e) => set({ satogaeri: { ...sato, until: e.target.value || undefined } })} />
              </label>
            </div>
            {!sato.city && <p className="text-sm text-muted">先の町を入れると、その町の病院や手続きも調べます</p>}
          </div>
        )}
      </Ask>

      <Ask label="ママの親は？">
        <Choice options={PLACES} value={value.grandparents?.mother} onPick={(v) => set({ grandparents: { ...value.grandparents, mother: v } })} name="gp-mother" />
      </Ask>
      {hasPartner && (
        <Ask label="パートナーの親は？">
          <Choice options={PLACES} value={value.grandparents?.partner} onPick={(v) => set({ grandparents: { ...value.grandparents, partner: v } })} name="gp-partner" />
        </Ask>
      )}
    </div>
  );
}

/** 小さな問い1つ */
function Ask({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="pb-2 text-base font-bold">{label}</legend>
      {children}
    </fieldset>
  );
}

/** 選び（最後に「わからない」がいつも付く。わからない = undefined） */
function Choice<T extends string>({ options, value, onPick, name }: { options: readonly T[]; value: T | undefined; onPick: (v: T | undefined) => void; name: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="group">
      {options.map((o) => (
        <Chip key={o} on={value === o} onClick={() => onPick(o)} id={`${name}-${o}`}>
          {o}
        </Chip>
      ))}
      <Chip on={value === undefined} onClick={() => onPick(undefined)} id={`${name}-unknown`} quiet>
        わからない・答えない
      </Chip>
    </div>
  );
}

function YesNo({ value, onPick, name }: { value: boolean | undefined; onPick: (v: boolean | undefined) => void; name: string }) {
  return (
    <Choice
      options={["ある・はい", "ない・いいえ"] as const}
      value={value === undefined ? undefined : value ? "ある・はい" : "ない・いいえ"}
      onPick={(v) => onPick(v === undefined ? undefined : v === "ある・はい")}
      name={name}
    />
  );
}

function Chip({ on, onClick, children, id, quiet }: { on: boolean; onClick: () => void; children: React.ReactNode; id: string; quiet?: boolean }) {
  const look = on ? "bg-rose text-white" : quiet ? "border border-line bg-card text-muted" : "bg-rose-soft text-rose";
  return (
    <button type="button" id={id} aria-pressed={on} onClick={onClick} className={`min-h-11 rounded-full px-4 text-base font-semibold ${look}`}>
      {children}
    </button>
  );
}
