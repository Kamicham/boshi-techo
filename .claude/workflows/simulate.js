export const meta = {
  name: 'simulate',
  description: '作った家族になりきった Claude が、シミュレーションのサーバの画面を iPhone の大きさで触り、詰まった所を集める（既定は1000組から6家族＋30家族から珍しい型1家族）',
  whenToUse: '画面や流れに関わる修正の後。「シミュレーションを回して」と言われた時',
  phases: [{ title: 'なりきり' }],
}
// args: { pick?: PickRound, families?: string[], change?: string }
//   pick: 既定の選び方。app/src/sim/pick.json の rounds[n]（{ round, families: [6家族の persona], rare: 'sim-xx' }）をそのまま渡す。
//         1000組（現実の割合から作った家族）から割合のまま6家族（同じ時期は2家族まで）＋30家族から珍しい型を1家族。
//         Workflow のスクリプトはファイルを読めないので、本体（呼ぶ側の Claude）が pick.json を読み、前回の次の round を渡す
//         （前回の round は報告の Artifact に書いておく。round は種から前もって作ってあり、毎回入れ替わる）。
//   families: なりきる家族の id を直接選ぶ（今まで通り。直した画面に関わる家族を先に入れる）。pick より優先
//   change: 今回の修正の一言（なりきり役は、そこを特によく触る）
// 前提: app/scripts/sim-server.sh が 3100番で動いている。
//   pop- の家族は、画面が /api/family?id= で1家族だけ引き、時計も進められる（シミュレーションのサーバだけ）。
const FALLBACK = ['sim-04', 'sim-06', 'sim-12', 'sim-16', 'sim-18', 'sim-22']
const pick = args && args.pick && Array.isArray(args.pick.families) ? args.pick : null
const ids = (args && args.families && args.families.length ? args.families : pick ? [...pick.families.map((f) => f.id), pick.rare] : FALLBACK).slice(0, 8)
if (!(args && args.families && args.families.length) && !pick) log('args.pick が無いので、30家族の6つで回します（既定は app/src/sim/pick.json の rounds[n] を args.pick で渡す）')
const change = (args && args.change) || '（指定なし。ふだん使う流れを一通り）'
/** pop- の家族の persona（ファイルに書かれていないので、ここで渡す） */
const personaOf = (id) => (pick ? pick.families.find((f) => f.id === id) : null)

const SCHEMA = {
  type: 'object',
  required: ['family', 'label', 'goals', 'findings', 'good'],
  properties: {
    family: { type: 'string' },
    label: { type: 'string' },
    goals: {
      type: 'array',
      items: {
        type: 'object',
        required: ['want', 'reached', 'taps'],
        properties: {
          want: { type: 'string' },
          reached: { type: 'boolean' },
          taps: { type: 'integer', description: '着くまで（諦めるまで）に押した数' },
          note: { type: 'string' },
        },
      },
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['level', 'screen', 'what'],
        properties: {
          level: { type: 'string', enum: ['重', '中', '軽'] },
          screen: { type: 'string', description: '画面の path と場所' },
          what: { type: 'string', description: 'この人として何が起きたか（その人の言葉で）' },
          why: { type: 'string', description: 'なぜこの人には困るのか（状況・言葉の力）' },
          idea: { type: 'string', description: '直し方の案（1行）' },
        },
      },
    },
    good: { type: 'array', items: { type: 'string' } },
  },
}

const step1 = (id) => {
  const p = personaOf(id)
  if (!p) return `1. まず /Users/zhang/boshi-techo/app/src/sim/families.ts から ${id} の家族と persona（label・who・literacy・goals・watch）を読む。読むのはこの家族の所だけ。アプリのソースコード（src/app・src/components・src/lib）は読まない。ふつうの使い手はコードを見られない。`
  return `1. この家族は、現実の割合（公的な統計）から作った1000組の1組（作った家族。実在の人物ではない）。persona は次のとおり（ファイルを読まなくてよい。アプリのソースコード（src/app・src/components・src/lib）は読まない。ふつうの使い手はコードを見られない）:
${JSON.stringify(p, null, 1)}`
}

const prompt = (id) => `あなたは、母子手帳アプリ（公開ハッカソン作品）を初めて使う家族の1人に、なりきります。家族の id は ${id} です。
${step1(id)}
2. 画面は道具でだけ触る（Mac の Chrome は使わない）:
   cd /Users/zhang/boshi-techo/app && node src/sim/drive.mjs ${id} setup <persona.meId> <goal の日付>
   そのあと see / click <番号> / type <番号> <文字> / scroll down / open </path> / shot。画面の文字と押せる物は see の出力だけで判断する。shot の画像は Read で見てよい（見た目が分からない時だけ）。
3. persona.goals を1つずつ、その日付で setup し直してから、その人として達成しようとする。1つの目的につき、押すのは25回まで。persona.literacy を守る（「やさしい日本語が要る」人は、難しい漢字の言葉が分からない前提で読む。「スマホが苦手」な人は、小さいボタンや隠れた所に気づけない前提）。今回の修正: ${change}。それに関わる所は特によく触る。
4. 外のアプリへ渡すリンク（メール・LINE・カレンダー・地図）は開かずに行き先が出る。行き先の中身（宛先・件名・本文が入っているか）も見る。
5. 記録する事: 着けたか・押した数、詰まった所、分からなかった言葉、探しても無かった物、小さくて押しにくい物、画面のエラー、この人の状況に合わない案内（例: パートナーがいないのに「パパの番」）、体の判断をしているように見える所、うれしかった所。
6. 書いてよいのはシミュレーションの DB（3100番のサーバ）だけ。下書きを作る・済んだにする・聞く事を足す等は、ふつうに押してよい（Claude の料金がかかる操作は、この家族で多くて5回まで）。本番（3210番）・わが家・ほかの家族には触らない。ファイルは直さない。
最後に、結果を形のとおりに返す。findings は重い順、その人の言葉で具体的に（どの画面のどこで、何を押して、どうなったか）。`

phase('なりきり')
const results = await parallel(ids.map((id) => () => agent(prompt(id), { label: `なりきり:${id}`, phase: 'なりきり', schema: SCHEMA, model: 'opus' })))
const ok = results.filter(Boolean)
if (ok.length < ids.length) log(`${ids.length - ok.length} 家族の結果が返りませんでした`)
return { families: ids, round: pick ? pick.round : null, change, results: ok }
