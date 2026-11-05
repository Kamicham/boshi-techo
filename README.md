# 母子手帳を、再発明する

[![検査（型・lint・試験・早送り・組み立て）](https://github.com/Kamicham/boshi-techo/actions/workflows/check.yml/badge.svg?branch=main)](https://github.com/Kamicham/boshi-techo/actions/workflows/check.yml)

> 1948年、日本は母子手帳を発明した。それは世界約40か国に広がった。
> 2026年、その次の形を作る。「読む手帳」から、「一緒に動く手帳」へ。

**Built with Claude: Japan 2026** の出品作（テーマ #2「本来、誰にでも届くべきものを。」）。
開発期間: 2026-11-02 12:30 〜 2026-11-08 20:00（JST）。このリポジトリは期間中にゼロから作っています。

[English below](#english)

## なぜ作るか

出産は一生に1〜2回。練習ができず、上達する前に終わります。役所は手続き、産院は体、会社は休業、親は手伝い。全体を持っている人がどこにもいなくて、つなぐのは一番経験の無い家族です。しかも、産後の眠れない数週間に、出生届（14日以内）・児童手当（15日以内）・保険・医療証が重なります。

足りないのは情報ではなく、**全体を持って先回りして動いてくれる誰か**。お金のある家は人を雇って手に入れています。それを、すべての家族に。詳しくは [docs/VISION.md](docs/VISION.md)。

## 「読む手帳」から「一緒に動く手帳」へ

紙の母子手帳も、今の電子版も、**家族が読みに行く手帳**です。いつ何をするかを読んで覚え、窓口を探し、書類を書くのは家族です。この手帳は、家族の時計（妊娠週数・生後日数）で自分から起き、**家族と一緒に動きます**。

| | 読む手帳（紙・今の電子版） | 一緒に動く手帳（これ） |
|---|---|---|
| 次にやる事 | 家族が読んで覚える | その日に手帳から声をかける。今やる1つだけ |
| 書く | 家族が書き写す | 話す・撮るだけ。候補を出し、家族の「OK」で入る |
| 町の手続き | 家族が自分の町のページを探す | どの町でも、窓口・持ち物・期限を公式ページから取ってくる（出典つき） |
| 書類・連絡 | 家族が一から書く | 職場へのメール・出生届の記入メモ・見学の予約文まで下書きする。外へは送らない |
| 家族の分担 | 手帳を持つ母に寄る | パートナーも同じ手帳を開き、自分の番と自分の名前の下書きが出る |
| 予定が崩れた時 | 家族が組み直す | 早く生まれた・引っ越した時に、気づいて組み直し案と渡せる文面を出す |
| 健診 | 15分の説明を覚えて帰る | 録音して、先生の言葉のまま残し、次に聞く質問にする。体の判断はしない |
| 1000日の後 | 手帳が残る | 記録と家族の言葉が、子どもへ語りかける一冊になる |

### 1000日のうちの、ある日

- **7週**: 「役所に妊娠を届ける」。住んでいる町の窓口・持ち物を公式ページから取ってきて、行く前に1枚で見せる
- **13週**: 「職場に伝える」。会社名と上司の名前の入ったメールの下書き。家族は読んで「OK」
- **28週**: 健診の前日に「先生の説明を録音しましょう」。帰り道には、先生が言った事・次までにやる事・次に聞く質問がそろっている
- **引っ越した日**: 新しい町の窓口で、健診の補助券や医療証がどう変わるかを調べて組み直す
- **生まれた日**: 予定より早く生まれたら、出生届（14日）・児童手当（15日）・保険証・育休の始まりを担当つきで並べ直し、パートナーの名前の文面を出す
- **1歳**: 寝返り・はじめての言葉・予防接種の控えが、国の様式と同じ並びで積み上がっている
- **2歳**: 1000日の記録と家族の言葉が、子どもへの一冊になる

### 今ある物との違い

| | 誰の側か | 範囲 | 動き方 | 家族で1冊 |
|---|---|---|---|---|
| 国の電子版（PMH・2026年度末から順次） | 自治体 | 全国・転居も引き継ぐ | 記録の保管と閲覧 | 父などは代理人として |
| 母子モ・ninaru・LINEヤフー「子育て」 | 自治体／民間 | 町ごと・全国一律 | 知らせる・やる事の一覧 | 閲覧の共有・別のアプリ |
| この手帳 | 家族 | おなかに宿った日から2歳まで・どの町でも | 下書きまで作り、家族は OK だけ | 同じ1冊に、自分の番と自分の名前の下書き |

国の電子版とは競わず、補い合います（記録が PMH に載れば、この手帳はそこから読む側になる）。出典と確認日: [docs/LANDSCAPE.md](docs/LANDSCAPE.md)

## 一緒に動くための7つの性質

| | 性質 | このアプリで動くもの |
|---|---|---|
| ① | 入力ゼロ、でも押し付けない | 話すだけ・撮るだけ（役所の封筒、健診の紙）で、日付つきの記録と期限になる。打つ方が早い物（体重・血圧・体温・日付・時刻・ひとこと）は、話す・撮ると同じ大きさの「打つ」でその場で打て、AI を通さずそのまま手帳に入る。読み取った値も OK の前に直せる。足りない事は1つだけ聞く |
| ② | 1000日を生きる | 家族の時計（妊娠週数・生後日数）で、その日にやる事が自分から出てくる。住んでいる町の窓口・持ち物・助成は、Claude が市の公式ページを web 検索で取りに行き、出典つきで残す |
| ③ | 答えずに、動く | 職場への連絡、出生届の記入メモ、保育園見学の予約文。家族がするのは「OK」だけ（外へは何も送らない） |
| ④ | 家族で1冊 | パートナーも合言葉で同じ手帳を開き、自分の番の事と、自分の名前の下書きが出る。担当は法と制度で決まる人（出生届・職場の事は働いている人）に振る |
| ⑤ | 医療は壁でなく橋 | **健診の1日を支える**: 前日に「先生の説明を録音しましょう」と声をかけ、アプリで録音 → 自宅の GPU で文字起こし → 先生が言った事・次までにやる事・次の予約・難しい言葉の言い換え（元の言葉を並べる）・次に聞く質問。大きな病院の案内図を撮ると、今日回る順番になる。**体の判断はしない** |
| ⑥ | 町の制度を取りに行く | どの町でも、その手続きの窓口・持ち物・期限を、Claude が公式ページから取ってくる（「どこへ行くか見る」） |
| ⑦ | 子どもへの贈り物 | 府令と同じ並びの記録（手帳のタブ）と1000日の言葉が、最後に子どもへ語りかける一冊になる |

### 母子手帳の魂を引き継ぐ

紙の母子手帳（府令様式）が78年かけて磨いた7つ（持つ・続く・突き合わせる・証明する・つなぐ・想いを残す・取り残さない）を壊さずに引き継ぎます。

- **手帳のタブ**: 国の様式と同じ並び（妊婦健診 → 出産 → 新生児 → 便色カード → 成長・できた日 → 予防接種 → 相談した記録 → 一冊）で記録を見る。発育曲線は国の調査の値、便色カードは国の7色から親が番号を選ぶ（アプリは判定しない。注意書きは手帳と同じ文言）
- **撮るだけ・話すだけで記録**: 紙の手帳のページを撮ると、Claude がどのページかを見分けて記録の候補を出す。「今日寝返りした」「BCG を受けた」と話しても候補になる。家族の「OK」で入る。紙の手帳が正本のまま、二重に書かせない
- **相談できる人**: 時期ごとに1回だけ「子育てについて気軽に相談できる人はいますか。」と聞く（紙の手帳の保護者の記録の毎回の問い。言葉もそのまま）。「いない」なら、町のこども家庭センター・産後ケア・#8000・児童相談所の相談ダイヤルへ橋をかける
- **急ぎの時**: 「迷ったら 119」と #8000、窒息の手当と心肺蘇生の要点（こども家庭庁の任意様式・日本蘇生協議会のガイドラインを元に短く）。電波が無くても開ける

作り手自身が、使う人の1号目です。家族の妊婦健診で、このアプリで先生の説明を録音して使っています（本物の記録は公開しません）。

## Claude の使い方

仕事ごとにモデルを分けています。毎日の仕事は Sonnet、深く読む仕事は Opus、見張りと整えは Haiku です。

| 仕事 | モデル | 理由 |
|---|---|---|
| 撮る・話す（声と写真の読み取り → 記録の候補。紙の手帳のページを見分ける） | Sonnet 5.5（`EVERYDAY_MODEL`） | 毎日の仕事。単価は Opus の半分 |
| 下書き（職場へのメール・出生届の記入メモなど） | Sonnet 5.5（`EVERYDAY_MODEL`） | 毎日の仕事 |
| 手帳に聞く（道具を自分で選ぶ。最大8手）と、見張りに言われた時の書き直し | Sonnet 5.5（`EVERYDAY_MODEL`） | 毎日の仕事 |
| 調べ物（町の窓口・持ち物・期限。手帳に聞くの公式ページの検索と、引っ越しの時の前の町との差も） | Sonnet 5.5（`RESEARCH_MODEL`） | 1回に検索の結果を約8万トークン読む。書き出した文は後で整え、出典の URL も残すので、Sonnet で質を保てる |
| 参謀の気づき（早く・遅く生まれた・町が変わった時の組み直し）と、時期ごとの見渡し | Opus 5.5（`MODEL`） | 深い仕事。家族の形・予定・記録を突き合わせて、決まりに無い事を見つける |
| 健診の整理（先生が言った事・次までにやる事・次に聞く質問）と、院内の案内図から回る順番 | Opus 5.5（`MODEL`） | 深い仕事。先生の言葉を崩さずに分ける |
| 一冊（1000日の記録と家族の言葉から、子どもへの本） | Opus 5.5（`MODEL`） | 深い仕事。一度きりの長い文 |
| 手帳に聞くの見張り（体・心・栄養の判断の言葉を探す） | Haiku 5.5（`LIGHT_MODEL`） | 返事のたびに1回。軽い仕事 |
| 調べ物の整え（調べた文を、窓口・持ち物・期限の形に） | Haiku 5.5（`LIGHT_MODEL`） | 形を整えるだけの軽い仕事 |

正本は [`app/src/lib/claude.ts`](app/src/lib/claude.ts) の4つの定数（`MODEL`・`EVERYDAY_MODEL`・`LIGHT_MODEL`・`RESEARCH_MODEL`）です。Opus の仕事だけ、断られた時の呼び直し（server-side fallbacks）を付けています。

- 決まった形は Structured Outputs と zod で受け取る。写真は画像入力。調べ物は web 検索のツールで、答えの中で引用されたページを出典に残す（市区町村の公式サイトを優先するよう頼む）
- **手帳に聞く**（どの画面からも右下の「聞く」）: 道具（予定・手帳の記録・町の公式ページ・画面の地図・下書き・済みにする・健診で聞く・記録する・渡す文）を自分で選んで使い、答えるだけでなく返事の下に動きを添える。書き込む動きは家族が押すまで何も変えない。体・心・栄養は判断せず、記録・健診で聞く事・連絡先への橋に変える（急ぎ・心の危機の言葉には機械で必ず電話の案内を付け、返事は Haiku の見張りが判断の言葉を探し、あれば書き直させる）
- 体の判断をしない約束を、すべての呼び出しの共通の決まり（`CHARTER`）として持つ
- 使い過ぎ止め: 呼ぶたびに使った額を記録し（`lib/spend.ts`）、`BOSHI_DAILY_USD`（サーバ全体の1日）と `BOSHI_HOUSEHOLD_DAILY_USD`（1つの世帯の1日）を超えた日は、Claude の仕事だけを止める。予定表・期限・急ぎの時はそのまま使える
- 鍵が無い時と、上限に達した日は、見本の家族は [`lib/samples.ts`](app/src/lib/samples.ts) の「見本の答え」（札つき）で動く。町の調べ物だけは見本を作らない
- 公開版（体験）は、ハッカソンの間は Claude を呼ばない（鍵が入っていても呼ばない歯止めが `lib/claude.ts` にある）。体験の写しは、1つの住所から1日に作れる数（`BOSHI_TRIALS_PER_IP_DAY`。既定 10・公開版の設定は 100）と、1つの写しに置ける写真と声（20件・50MB）に上限がある
- 作る過程は **Claude Code** で進めた（計画 → 承認 → 実装を、機能ごとに並列のエージェントで）。コミットの履歴がその記録

## 動かし方

```bash
cd app
npm install
cp .env.example .env.local   # 頭の BOSHI_DATA_DIR=./try-data が試す時の置き場。ANTHROPIC_API_KEY と ASR_URL は空でも動く
npm run dev                  # http://localhost:3000
```

- `BOSHI_DATA_DIR` を消すと、`app/data/` を本物の家族の置き場として守り、アカウント・思い出・手紙・映画が止まる（作り手の家族の本番だけの形）
- **動かし方は4つ**: わが家の本番（home）・公開版の体験（public）・シミュレーション（sim）・手元の試し（dev）。置き場と環境変数の表は [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#動かし方)。公開版やシミュレーションが本物の家族の置き場を開くなど、危ない組み合わせはサーバが立つ時に止まる（`app/src/lib/mode.ts`）
- **鍵が無くても動く**: `ANTHROPIC_API_KEY` が空の時、予定表・期限・急ぎの時の連絡先はそのまま動き、デモの家族は Claude の仕事（撮る・下書き・気づき・聞く・一冊）を「見本の答え」で一通り触れる。町の窓口を調べる所だけは鍵が要る
- Claude の使い過ぎ止め: `BOSHI_DAILY_USD`（サーバ全体の1日）と `BOSHI_HOUSEHOLD_DAILY_USD`（1つの世帯の1日）。鍵は月の上限を付けたワークスペースで作る
- 文字起こし（健診の録音）は [asr/](asr/) の小さなサーバ（faster-whisper large-v3）を GPU の機械で動かし、`ASR_URL` で指す。音声は家のネットワークの外に出ない
- `ASR_URL` が無い時、見本の家族（作った家族）は用意したデモの文字起こしに切り替わる（画面に「デモの文字起こし」と出る）。GPU が無くても、健診の1日を最後まで試せる。本物の世帯の「話す」の記録は、デモの文を入れずに止める（`lib/asr.ts`）。わが家の本番は `ASR_URL` が無いと立たない
- スマホのマイクは https でないと使えない。家の機械で動かす時は Tailscale Serve などで https の住所を付ける
- 家族が毎日使う時は、組み立て済みの本番で動かす（`app/scripts/serve-prod.sh`）。更新は `app/scripts/release-prod.sh`: GitHub の main のきれいな写しから組み立て、3211番で確かめてから差し替え、だめなら前の版に戻す。開発サーバのままだと、コードを直した時に録音中の画面が読み直される
- デモの家族（すべて架空・町だけ実在のさいたま市）は上の切り替えで選べる。時計を早送りできる

```bash
npm test          # 試験のすべて（Claude は呼ばない・鍵も使わない）
npm run sim       # 早送りの検査（1000組＋30家族 × 1000日）
npm run typecheck
```

## 公開版（体験）

だれでも、作った家族の手帳を自分だけの写しで触れる版です（`BOSHI_PUBLIC=1`）。

- 開いた人ごとに、見本の家族の写しを1つ作る（札＝クッキーの持ち主だけが開ける。7日で消える）。ほかの人の書き込みは見えない
- 本物の家族の登録・招待・書き出しは閉じてある。健診の録音は、公開版ではまだ読むだけ
- **ハッカソンの間は、Claude を呼ばない**（Claude の鍵を入れない。鍵がうっかり入っても、公開版では呼ばない歯止めがある）。Claude の出番は、前に Claude が書いた一冊と、「見本の答え」の札が付いた答えで見せる。話した声は文字にせず、決まった見本の文が入る

自分で立てる（Fly.io の東京・月 $5 ほど）:

```bash
cd app
fly launch --no-deploy --copy-config --name <好きな名前>   # fly.toml の app を書き換える
fly volumes create boshi_data --region nrt --size 3
# 秘密は2つだけ。命令の引数に載せず、標準入力で渡す（値は画面にも出さない）
{ printf 'BETTER_AUTH_SECRET=%s\n' "$(openssl rand -hex 32)"; printf 'BOSHI_KEK=%s\n' "$(openssl rand -hex 32)"; } | fly secrets import --stage
fly deploy --remote-only   # 組み立ては Fly の機械で。像は、きれいな main の写しの app/ から組む
```

見本の素材は、すべて期間中に作った物で、実在の人ではありません。写真は Z-Image-Turbo（Apache-2.0）で生成。声は AivisSpeech の音声モデル「まお」「阿井田 茂」「ろてじん（長老ボイス）」（ACML 1.0）と、Qwen3-TTS 1.7B VoiceDesign（Apache-2.0・ばあばの声）で合成。映画の音楽は、端末で鳴らす自作のオルゴールです。

## しくみ

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)（層の図・4つの動かし方・記録の種類・全国へ広げる時の置き場）

### 確かめ方

- **試験 103ファイル・1154件**（2026-11-05 時点・`npm test`）。Claude は呼ばず、鍵も使わない。main への push と PR のたびに、GitHub Actions（`.github/workflows/check.yml`）が型・lint・試験・早送り・組み立て（next build）を回す
- **早送り: 22の決まり（a〜v）× 1030家族 × 1000日**（`npm run sim`）。公的な統計から作った1000組（のべ 1,035,345日）と、珍しい型の30家族（のべ 28,767日）の毎日を、「今日」の画面と同じ関数に通す。手帳の記録の決まり t1〜t9 は、見本の家族を足した1031家族で確かめる。今はすべて守れている
- **世帯をまたぐ試験**: 家族Aのログインで家族Bの記録・済んだ事・手帳・写真の id を叩くと、どれも 404（`app/src/sim/cross-household.test.ts`）。API の口が（健診の口も）すべて、関所（`withHousehold`）か理由つきの公開の口を通るかを、コードを読んで確かめる（`app/src/sim/api-guard.test.ts`）

修正のたびに、公的な統計の割合から作った1000家族（すべて作った家族）でアプリの1000日を早送りしています。使った割合と出典: [docs/SIM_STATS.md](docs/SIM_STATS.md)

- 結果（早送りの決まり・なりきりで見つかった事と直したコミット・アンケートの前回比）: [docs/SIMULATION_RESULTS.md](docs/SIMULATION_RESULTS.md)
- Claude Code でどう作ったか（統計 → 1000組 → 早送り → Opus のなりきり → Sonnet のアンケート → 直す）: [docs/BUILT_WITH_CLAUDE_CODE.md](docs/BUILT_WITH_CLAUDE_CODE.md)

## License

MIT

---

<a id="english"></a>

# Reinventing the Maternal and Child Health Handbook

> In 1948, Japan invented the Maternal and Child Health Handbook (Boshi Techo), which has since spread to around 40 countries.
> In 2026, we build what comes next: from a handbook you read, to an agent that walks the first 1,000 days with your family.

An entry to **Built with Claude: Japan 2026** (Theme #2: "What should reach everyone"). Built from scratch between 2026-11-02 and 2026-11-08 (JST).

## Why

Most people give birth once or twice in a lifetime, so nobody gets to practice. The city office handles paperwork, the clinic handles the body, the employer handles leave, and grandparents help where they can. Nobody holds the whole picture except the family, who have the least experience. And the heaviest paperwork (birth registration within 14 days, child allowance within 15) lands in the sleepless weeks after birth.

What is missing is not information. It is **someone who holds the whole picture and moves ahead of you**. Wealthy families hire that person. We want every family to have one.

## From a handbook you read to a handbook that moves with you

The paper handbook, and today's digital versions, are handbooks the family reads. The family memorizes what comes next, looks up the city office, and fills in the forms. This handbook wakes up on the family's own clock (weeks of pregnancy, days since birth) and moves with them:

- **What's next**: it speaks up on the day, one thing at a time, instead of waiting to be read.
- **Writing**: talk or take a photo; it proposes entries and the family taps OK.
- **City procedures**: for any city, it fetches the office, what to bring and the deadline from official pages, with sources.
- **Paperwork**: it drafts the email to your boss, the birth-registration notes, the daycare visit request. Nothing is sent.
- **Sharing the load**: the partner opens the same handbook and sees their own turn, with drafts in their own name.
- **When plans break**: born early, moved to a new city: it notices, replans, and writes the message to hand over.
- **Checkups**: record the doctor's explanation, keep the doctor's own words, and turn them into questions for next time. It never judges health.
- **After 1,000 days**: the records and the family's words become a book that speaks to the child.

Compared with what exists: the national digital handbook (PMH) stores and shows records for municipalities, and apps such as Boshimo, ninaru and LINE Yahoo "Kosodate" notify and list tasks. This handbook takes the family's side, spans any city for the first 1,000 days, and drafts the paperwork for an OK. It complements PMH rather than competing with it ([docs/LANDSCAPE.md](docs/LANDSCAPE.md), in Japanese).

## The seven qualities behind it

1. **Zero input, never forced**: talk or take a photo (a letter from the city, a checkup slip); it becomes dated records and deadlines. When typing is faster (weight, blood pressure, temperature, a date, a time, a short note), a "Type" button of the same size lets you enter it on the spot — it goes straight into the techo without AI. Values read from photos or speech can be corrected before you tap OK. It asks at most one question.
2. **Lives through 1,000 days**: a family clock (weeks of pregnancy, days since birth) surfaces what to do today. Local rules for your own city are researched with Claude's web search, with sources.
3. **Acts instead of answering**: drafts of the message to your employer, birth-registration notes, daycare visit requests. The family only says "OK". Nothing is sent.
4. **One handbook for the family**: the partner opens the same handbook (with a family passcode) and sees their own tasks and drafts written in their own name. Tasks go to whoever the law and the system name (for work matters, the parent who is employed).
5. **A bridge to medicine, not a wall**: the day of a prenatal checkup. The app reminds you to ask the doctor to record, records in the app, transcribes on a home GPU, and turns it into what the doctor said, what to do next, the next appointment, plain-language notes for jargon (always next to the doctor's own words) and questions for next time. Photograph a big hospital's floor map and get today's route. **It never judges health.**
6. **Fetches your city's rules**: for any city, the office, what to bring and the deadline for each procedure are fetched from the official pages.
7. **A gift to the child**: the 1,000 days of records become a book that speaks to the child.

### Carrying the soul of the paper handbook

The national handbook format has been refined for 78 years. We keep its seven qualities: the family holds it, it continues from pregnancy onward, parent and doctor records sit side by side, vaccination records serve as proof, it asks every time whether you have someone to talk to, it keeps the family's own words, and it leaves no one behind.

- **Handbook tab**: records in the same order as the national format (prenatal checkups, birth, newborn, stool color card, growth and milestones, vaccinations, consultations, and finally the book). Growth charts use national survey values; for the stool color card the parent picks one of the seven official colors (the app never judges; the notes are the handbook's own wording).
- **Record by photo or voice**: photograph a page of the paper handbook and Claude identifies the page and proposes entries; saying "rolled over today" or "got the BCG shot" works too. Nothing is saved until the family taps OK. The paper handbook stays the original.
- **Someone to talk to**: once per stage, the app asks the handbook's recurring question (kept word for word in Japanese), "Is there someone you can casually talk to about raising your child?" If not, it links to the city's child and family center, postpartum care, the #8000 pediatric line and the child guidance hotline.
- **Emergency page**: "When in doubt, call 119" plus #8000, and short steps for choking and CPR (based on the Children and Families Agency's handbook pages and the Japan Resuscitation Council guidelines). It opens even offline.

The author is user #1, using it at a family member's real prenatal checkups (real records are never published).

## How Claude is used

Each job uses the model that fits it: everyday jobs run on Sonnet, deep reading runs on Opus, and the guard and formatting run on Haiku.

| Job | Model | Why |
|---|---|---|
| Capture: turn voice and photos into proposed entries; identify a page of the paper handbook | Sonnet 5.5 (`EVERYDAY_MODEL`) | Everyday job; half Opus's price |
| Drafts (the email to the employer, birth-registration notes, ...) | Sonnet 5.5 (`EVERYDAY_MODEL`) | Everyday job |
| "Ask the handbook" agent (picks its own tools, up to 8 steps) and rewrites when the guard flags a reply | Sonnet 5.5 (`EVERYDAY_MODEL`) | Everyday job |
| Research with web search (city offices, what to bring, deadlines; also the agent's official-page search and the old-vs-new city comparison after a move) | Sonnet 5.5 (`RESEARCH_MODEL`) | Each call reads about 80k tokens of search results; the text is reshaped afterwards and the source URLs are kept, so Sonnet holds the quality |
| Advisor: replanning when the baby comes early or late or the family moves, and a once-per-stage look across the family's records | Opus 5.5 (`MODEL`) | Deep work: cross-checks the family's situation, schedule and records to find what no fixed rule covers |
| Checkup notes (what the doctor said, what to do next, questions for next time) and a route from a hospital floor map | Opus 5.5 (`MODEL`) | Deep work: keeps the doctor's own words intact |
| The book for the child (1,000 days of records and the family's words) | Opus 5.5 (`MODEL`) | Deep work: one long piece of writing |
| Guard on every "Ask" reply (looks for medical, mental-health and nutrition judgments) | Haiku 5.5 (`LIGHT_MODEL`) | Light job, once per reply |
| Reshaping research into office / what to bring / deadline fields | Haiku 5.5 (`LIGHT_MODEL`) | Light job, formatting only |

The source of truth is the four constants in [`app/src/lib/claude.ts`](app/src/lib/claude.ts) (`MODEL`, `EVERYDAY_MODEL`, `LIGHT_MODEL`, `RESEARCH_MODEL`). Only the Opus jobs add server-side fallbacks for refusals.

- Structured outputs with zod, image input for photos, and the web search tool with citations (the pages cited in the answer are kept as sources).
- "Ask the handbook" (the floating button on every screen) looks up the family's schedule, records, official town pages and an in-app screen map, then answers and attaches actions (open the right screen, draft, mark done, add a checkup question, record, a ready-to-send message). Nothing is written until the family taps. Body, mental-health and nutrition questions get no judgment, only a bridge: a dated record, a question for the doctor, and phone numbers; urgent words always add 119/#8000 by rule, and the Haiku guard has any judgment rewritten.
- A shared charter (`CHARTER`) forbids medical judgment in every call.
- Spend caps: every call is metered (`lib/spend.ts`); past `BOSHI_DAILY_USD` (whole server per day) or `BOSHI_HOUSEHOLD_DAILY_USD` (one household per day), only the Claude jobs stop. The schedule, deadlines and emergency page keep working.
- Without an API key, or once a cap is reached, the demo family answers with clearly labeled sample answers ([`lib/samples.ts`](app/src/lib/samples.ts)); city research has no samples.
- The public trial does not call Claude during the hackathon, and it limits trial copies per IP address per day (`BOSHI_TRIALS_PER_IP_DAY`, default 10, 100 in the public config) and photos and voice per copy (20 items, 50 MB).
- The whole project was built with Claude Code, with parallel agents per feature; the commit history is the record.

## Tests

- **1,154 tests in 103 files** (as of 2026-11-05, `npm test`). No Claude calls and no keys. GitHub Actions (`.github/workflows/check.yml`) runs types, lint, tests, the fast-forward and `next build` on every push to main and every PR.
- **Fast-forward: 22 rules (a–v) × 1,030 families × 1,000 days** (`npm run sim`). 1,000 synthetic families drawn from public statistics (1,035,345 family-days) and 30 hand-made rare cases (28,767 family-days) pass every day through the same functions as the Today screen. The 9 handbook-record rules (t1–t9) are checked on 1,031 families (adding the demo family). All pass today.
- **Cross-household tests**: with family A's login, every record, done item, handbook entry and photo id of family B returns 404 (`app/src/sim/cross-household.test.ts`). A source-reading test checks that every API route (including the checkup routes) goes through the household gate (`withHousehold`) or is a public route with a stated reason (`app/src/sim/api-guard.test.ts`).

Every change is fast-forwarded through 1,000 days with 1,000 synthetic families drawn from Japanese public statistics (sources: [docs/SIM_STATS.md](docs/SIM_STATS.md), in Japanese). Results: [docs/SIMULATION_RESULTS.md](docs/SIMULATION_RESULTS.md). How it was built with Claude Code: [docs/BUILT_WITH_CLAUDE_CODE.md](docs/BUILT_WITH_CLAUDE_CODE.md). Architecture, run modes and where it would live at national scale: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (in Japanese). After the hackathon it would move to a major cloud (Google Cloud or AWS) together with a rewrite to a managed database, object storage and KMS; of the docs we checked on 2026-11-05, only Amazon Bedrock (Tokyo and Osaka) confirms in-Japan processing for Claude, and it has no web search tool, so city research would need rework there.

## Run

See the Japanese section above (`cd app && npm install && cp .env.example .env.local && npm run dev`). `.env.example` starts with `BOSHI_DATA_DIR=./try-data`; without it the app treats `app/data/` as a real family's store and keeps accounts, memories, letters and films closed. Without `ANTHROPIC_API_KEY`, the schedule, deadlines and emergency contacts still work, and the demo family shows clearly labeled sample answers for the Claude features. Without `ASR_URL`, the demo families use a bundled demo transcript, so the whole visit flow still works without a GPU; a real household's voice notes get an error instead of demo text, and the home server refuses to start without `ASR_URL`. There are four run modes (home production, public trial, simulation, local dev; `app/src/lib/mode.ts`), and unsafe combinations, such as the public trial or the simulation opening the real family's store, stop the server at startup. The home production server is rebuilt from a clean checkout of main, checked on port 3211, then swapped in, with rollback (`app/scripts/release-prod.sh`).

## Public trial

`BOSHI_PUBLIC=1` runs a version anyone can try: each visitor gets a private copy of the demo family (bound to a cookie, deleted after 7 days). Sign-up, invites and export are closed. **During the hackathon the public trial does not call Claude**: no API key is set, and the public build refuses to call Claude even if one is. Claude's part is shown with a book Claude wrote earlier and with clearly labeled sample answers; spoken notes are not transcribed (a fixed sample sentence is used). To host it yourself on Fly.io (Tokyo), see `app/Dockerfile` and `app/fly.toml` (`fly launch --no-deploy --copy-config`, create a 3 GB `boshi_data` volume, pass only `BETTER_AUTH_SECRET` and `BOSHI_KEK` through stdin with `fly secrets import`, then `fly deploy --remote-only` from a clean checkout of main).

Sample media were all made during the hackathon and show no real people: photos generated with Z-Image-Turbo (Apache-2.0); voices synthesized with the AivisSpeech models 「まお」, 「阿井田 茂」 and 「ろてじん（長老ボイス）」 (ACML 1.0) and with Qwen3-TTS 1.7B VoiceDesign (Apache-2.0); the film music is a music box played in the browser.

## License

MIT
