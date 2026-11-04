"use client";

// 家族の形を聞く欄（母とパートナーの働き方・パートナーの育休・上の子・生まれる子の数・里帰り）。
// どの問いも「わからない・答えない」を選べる（小さな文字で列の最後）。答えない欄は、今までどおりの予定が出る。
// 押す所は 44px 以上。iPhone の 390px で横にはみ出さないよう、選びは折り返す。
import { useState } from "react";
import { MAX_OLDER_KIDS, OLDER_CARES, RETURN_ATS, type Leave, type MotherWork, type OlderKid, type Situation, type Work } from "@/lib/situation";

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

/**
 * disabled: 見るだけ（シミュレーションの作った家族は、家族の形を保存できないので押せなくする）
 * born: 生まれた後。妊娠中の働き方・生まれる子の数・里帰りは「生まれる前の事」に畳む（値は消さない）
 */
export function SituationForm({ value, onChange, hasPartner, disabled, born }: { value: Situation; onChange: (s: Situation) => void; hasPartner: boolean; disabled?: boolean; born?: boolean }) {
  const set = (patch: Partial<Situation>) => onChange({ ...value, ...patch });

  const motherWork = (
    <Ask label="ママの働き方（妊娠中）">
      <Choice options={MOTHER_WORKS} value={value.motherWork} onPick={(v) => set({ motherWork: v })} name="mother-work" />
    </Ask>
  );
  // 保育園の4月入園を逆算する（第2波④）。ママが働き続ける時だけ聞く（辞める・仕事なしは聞かない）
  const mw = value.motherWork;
  const askReturn = mw === undefined || mw === "会社員・公務員" || mw === "パート・派遣" || mw === "自営・フリー";
  const beforeBirth = (
    <>
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
    </>
  );

  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-5 disabled:opacity-80">
      {!born && motherWork}

      {askReturn && (
        <Ask label="ママが仕事に戻りたい時期（保育園の申し込みの時期が決まります）">
          <Choice options={RETURN_ATS.map((r) => (r === "1歳まで" ? "1歳になるまでに" : "1歳を過ぎてから")) as ("1歳になるまでに" | "1歳を過ぎてから")[]} value={value.returnAt === "1歳まで" ? "1歳になるまでに" : value.returnAt === "1歳を過ぎて" ? "1歳を過ぎてから" : undefined} onPick={(v) => set({ returnAt: v === "1歳になるまでに" ? "1歳まで" : v === "1歳を過ぎてから" ? "1歳を過ぎて" : undefined })} name="return-at" />
          <p className="text-sm text-muted">育休は原則1歳まで。1歳を過ぎてからは、保育園に入れなかった時に延ばせます（育児・介護休業法）</p>
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
        </>
      ) : (
        <p className="text-sm text-muted">一緒に育てる人を「家族は？」で足すと、その人の働き方も聞きます</p>
      )}

      {/* 生まれた日の届けの行き先が変わる2問（第1波②）: 児童手当は公務員なら勤め先、赤ちゃんの保険が国保なら役所に14日以内 */}
      <Ask label="ママかパートナーは公務員？（公務員だと、児童手当の申し込み先が町ではなく職場になります）">
        <YesNo yes="はい" no="いいえ" value={value.publicServant} onPick={(v) => set({ publicServant: v })} name="public-servant" />
      </Ask>
      <Ask label="赤ちゃんの保険証は、どれになりそう？">
        <Choice options={["勤め先", "国保"] as const} labels={{ 勤め先: "親の勤め先の保険", 国保: "国民健康保険（町の保険）" }} value={value.babyInsurance} onPick={(v) => set({ babyInsurance: v })} name="baby-insurance" />
      </Ask>

      <Ask label="上の子は？">
        <YesNo yes="いる" no="いない" value={value.olderChildren} onPick={(v) => set({ olderChildren: v, ...(v === true ? {} : { olderKids: undefined }) })} name="older" />
      </Ask>
      {value.olderChildren === true && <OlderKids kids={value.olderKids ?? []} onChange={(k) => set({ olderKids: k.length ? k : undefined })} />}

      {born ? (
        <details className="group">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-base text-muted">
            <span className="underline underline-offset-2">生まれる前の事（妊娠中の働き方・生まれた子の数・里帰り）</span>
            <span className="transition-transform group-open:rotate-90" aria-hidden>›</span>
          </summary>
          <div className="flex flex-col gap-5 pt-2">
            {motherWork}
            {beforeBirth}
          </div>
        </details>
      ) : (
        beforeBirth
      )}

      {/* 静かにする（安心のデザイン #5）。目立たせず、一番下に畳んでおく */}
      <details className="group" open={value.quiet !== undefined}>
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-base text-muted">
          <span className="underline underline-offset-2">赤ちゃんの事で、伝えたい事がある時</span>
          <span className="transition-transform group-open:rotate-90" aria-hidden>›</span>
        </summary>
        <div className="flex flex-col gap-3 pt-2">
          <p className="text-base text-muted">選ぶと、今日の画面の日数・週数・お知らせを止めて、静かにします。手帳の記録は消えません。いつでもここで戻せます。</p>
          <div className="flex flex-wrap gap-2" role="group">
            <Chip on={value.quiet === "nicu"} onClick={() => set({ quiet: value.quiet === "nicu" ? undefined : "nicu" })} id="quiet-nicu" quiet>
              赤ちゃんが入院している
            </Chip>
            <Chip on={value.quiet === "loss"} onClick={() => set({ quiet: value.quiet === "loss" ? undefined : "loss" })} id="quiet-loss" quiet>
              つらい別れがあった
            </Chip>
            {value.quiet !== undefined && (
              <Chip on={false} onClick={() => set({ quiet: undefined })} id="quiet-off" quiet>
                いつもの画面に戻す
              </Chip>
            )}
          </div>
        </div>
      </details>
    </fieldset>
  );
}

/**
 * 上の子の一人ずつ（第2波①）。生まれた日から、上の子の健診・予防接種を赤ちゃんと同じ表に出す。
 * 年月だけでもよい（1日と見なして近似）。呼び名は任意。
 */
function OlderKids({ kids, onChange }: { kids: OlderKid[]; onChange: (k: OlderKid[]) => void }) {
  const put = (i: number, patch: Partial<OlderKid>) => onChange(kids.map((k, j) => (j === i ? { ...k, ...patch } : k)));
  const list = kids.length ? kids : [];
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line p-3">
      <p className="text-base text-muted">上の子の生まれた日を入れると、上の子の健診・予防接種も「いま」に一緒に出します。園に通っていれば、育休中も通い続けられるかの確かめも出します。</p>
      {list.map((k, i) => (
        <fieldset key={i} className="flex min-w-0 flex-col gap-2 border-t border-line pt-3 first:border-t-0 first:pt-0">
          <legend className="pb-1 text-base font-bold">{list.length > 1 ? `上の子 ${i + 1}人目` : "上の子"}</legend>
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor={`older-${i}-birth`}>
            生まれた日{k.monthOnly ? "（年と月）" : ""}
            <input
              id={`older-${i}-birth`}
              type={k.monthOnly ? "month" : "date"}
              value={k.monthOnly ? k.birthDate.slice(0, 7) : k.birthDate}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                put(i, { birthDate: k.monthOnly ? `${v}-01` : v });
              }}
              className="min-h-11 rounded-lg border border-line bg-card px-2 text-base text-ink"
            />
          </label>
          <label className="inline-flex min-h-11 items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={!!k.monthOnly} onChange={(e) => put(i, { monthOnly: e.target.checked || undefined, birthDate: e.target.checked ? `${k.birthDate.slice(0, 7)}-01` : k.birthDate })} />
            年と月だけで答える（日は1日として数えます）
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor={`older-${i}-name`}>
            呼び名（なくても大丈夫）
            <input id={`older-${i}-name`} value={k.name ?? ""} maxLength={20} onChange={(e) => put(i, { name: e.target.value || undefined })} className="min-h-11 rounded-lg border border-line bg-card px-2 text-base text-ink" placeholder="例: はるくん" />
          </label>
          <p className="text-sm text-muted">日中は</p>
          <Choice options={OLDER_CARES} value={k.care} onPick={(v) => put(i, { care: v })} name={`older-${i}-care`} />
          <button type="button" onClick={() => onChange(kids.filter((_, j) => j !== i))} className="min-h-11 self-start text-sm text-muted underline underline-offset-2">
            この子を外す
          </button>
        </fieldset>
      ))}
      {kids.length < MAX_OLDER_KIDS && (
        <button
          type="button"
          onClick={() => onChange([...kids, { birthDate: "" }])}
          className="min-h-11 self-start rounded-full bg-rose-soft px-4 text-base font-semibold text-rose"
        >
          {kids.length ? "上の子をもう1人足す" : "上の子の生まれた日を入れる"}
        </button>
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

/**
 * 選び（最後に「わからない・答えない」がいつも付く。保存する値は、わからない = 未回答 = undefined のまま）。
 * 未回答と「わからない」は値で見分けられないので、この画面で押したかどうかで見分ける。
 * まだ答えていない問いは、どれも同じ薄い色（答え済みに見せない）。押した物だけ濃くする。
 */
/** labels: 保存する値とは別に、画面に出す言葉（制度の略語を、初めての人に分かる言葉で） */
function Choice<T extends string>({ options, labels, value, onPick, name }: { options: readonly T[]; labels?: Partial<Record<T, string>>; value: T | undefined; onPick: (v: T | undefined) => void; name: string }) {
  const [saidUnknown, setSaidUnknown] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2" role="group">
      {options.map((o) => (
        <Chip
          key={o}
          on={value === o}
          onClick={() => {
            setSaidUnknown(false);
            onPick(o);
          }}
          id={`${name}-${o}`}
        >
          {labels?.[o] ?? o}
        </Chip>
      ))}
      <button
        type="button"
        id={`${name}-unknown`}
        aria-pressed={value === undefined && saidUnknown}
        onClick={() => {
          setSaidUnknown(true);
          onPick(undefined);
        }}
        className={`min-h-11 rounded-full px-3 text-sm ${value === undefined && saidUnknown ? "bg-rose font-semibold text-white" : "text-muted underline underline-offset-2"}`}
      >
        わからない・答えない
      </button>
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
  const look = on && quiet && id.startsWith("quiet-") ? "bg-ink text-paper" : on ? "bg-rose text-white" : quiet ? "border border-line bg-card text-muted" : "bg-rose-soft text-rose";
  return (
    <button type="button" id={id} aria-pressed={on} onClick={onClick} className={`min-h-11 rounded-full px-4 text-base font-semibold ${look}`}>
      {children}
    </button>
  );
}
