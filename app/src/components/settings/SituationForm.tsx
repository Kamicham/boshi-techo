"use client";

// 家族の形を聞く欄（母とパートナーの働き方・パートナーの育休・上の子・生まれる子の数・里帰り）。
// どの問いも「わからない・答えない」を選べる。答えない欄は、今までどおりの予定が出る。
// 押す所は 44px 以上。iPhone の 390px で横にはみ出さないよう、選びは折り返す。
import type { Leave, MotherWork, Situation, Work } from "@/lib/situation";

const MOTHER_WORKS: MotherWork[] = ["会社員・公務員", "パート・派遣", "自営・フリー", "仕事なし", "出産で辞める"];
const WORKS: Work[] = ["会社員・公務員", "パート・派遣", "自営・フリー", "仕事なし"];
const LEAVES: Leave[] = ["取る", "取らない", "未定"];

/** 育休の問いを出すか（雇われて働く時と、まだ答えていない時） */
const employed = (w: Work | undefined) => w === undefined || w === "会社員・公務員" || w === "パート・派遣";

/** 保存の前に、もう意味の無い答えを外す（例: 仕事なしを選んだのに残っている育休） */
export function tidySituation(s: Situation, hasPartner: boolean): Situation {
  const out: Situation = { ...s };
  if (!hasPartner) {
    delete out.partnerWork;
    delete out.partnerLeave;
  } else if (!employed(out.partnerWork)) delete out.partnerLeave;
  return out;
}

/** disabled: 見るだけ（シミュレーションの作った家族は、家族の形を保存できないので押せなくする） */
export function SituationForm({ value, onChange, hasPartner, disabled }: { value: Situation; onChange: (s: Situation) => void; hasPartner: boolean; disabled?: boolean }) {
  const set = (patch: Partial<Situation>) => onChange({ ...value, ...patch });

  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-5 disabled:opacity-80">
      <Ask label="ママの働き方（妊娠中）">
        <Choice options={MOTHER_WORKS} value={value.motherWork} onPick={(v) => set({ motherWork: v })} name="mother-work" />
      </Ask>

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
        </>
      ) : (
        <p className="text-sm text-muted">パートナーの呼び名を入れると、パートナーの働き方も聞きます</p>
      )}

      <Ask label="上の子は？">
        <YesNo yes="いる" no="いない" value={value.olderChildren} onPick={(v) => set({ olderChildren: v })} name="older" />
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
        <YesNo yes="する" no="しない" value={value.satogaeri} onPick={(v) => set({ satogaeri: v })} name="satogaeri" />
      </Ask>
    </fieldset>
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

/** はい・いいえの選び（わからない = undefined） */
function YesNo<Y extends string, N extends string>({ yes, no, value, onPick, name }: { yes: Y; no: N; value: boolean | undefined; onPick: (v: boolean | undefined) => void; name: string }) {
  return (
    <Choice<Y | N>
      options={[yes, no]}
      value={value === undefined ? undefined : value ? yes : no}
      onPick={(v) => onPick(v === undefined ? undefined : v === yes)}
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
