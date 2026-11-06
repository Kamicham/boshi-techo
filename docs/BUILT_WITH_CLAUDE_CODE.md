# Claude Code でどう作ったか

> **English summary**
> One maker built this with Claude Code. The work was not done in one long chat. Several Claude Code sessions ran side by side, each with its own role. A coordinator session keeps the whole picture and hands out work. Work sessions (usability, memories, the ask-the-handbook feature, audit, demo, and others) each run in their own git worktree. The sessions talk to each other through cross-session messages, and every commit lands on `main`. When CI passes on `main`, the new version ships every 30 minutes to the public trial and to the maker's own instance, with a health check and automatic rollback.
> Every change goes through one loop: 41 public statistics → 1,000 synthetic families → a 1,000-day fast-forward test on every change → Opus role-playing families on an iPhone-sized screen → Sonnet answering a survey as all 1,000 families → findings → commits.
> A Workflow-based audit read `main` through 8 lenses, and a separate refuter checked every finding. It produced 89 findings, and the maker picked 8 to fix that same day.
> The maker's own family used the app at a real prenatal checkup, and a date in the recording was misheard. Since then, a heard date stays a candidate until the person confirms it with "OK".
> So far: 6 recorded role-play rounds (36 family sessions, 377 findings) and 2 surveys (1,007 answers each). The fixes can be traced in the git history.
> API spend is metered per call (`app/scripts/spend.mjs`). By default a simulation run stops at $21 and a single family at $3. Only synthetic families are used in tests, so the maker's real family records never enter any test.

作り手は、自分の家族が使う1号目です。でも、2人だけで確かめても、日本で子を迎える家族の多くは見えません。そこで、Claude Code で「作った家族の国」を作り、修正のたびにその中でアプリを使ってもらいました。

**ここに出てくる家族は、すべて作った家族です。** 公的な統計から作った近似で、実在の人物ではありません。結果の数字は [SIMULATION_RESULTS.md](SIMULATION_RESULTS.md) にあります。

## 1人と、役を分けた Claude Code の会話たち

作り手は1人です。Claude Code の会話を1本で使い続けるのではなく、11/4 から役ごとに分けて、同時に動かしました。

```mermaid
flowchart TB
  M["作り手<br/>方向を決めて OK を出す"] --> H["統括の会話<br/>全体・次の一手・割り振り"]
  H -->|仕事を渡す| W["作業の会話<br/>使い心地・思い出・手帳に聞くなど"]
  H -->|仕事を渡す| A["全体監査の会話"]
  H -->|仕事を渡す| D["デモの会話"]
  W -->|コミットのたびに| G["main（GitHub）"]
  A -->|コミットのたびに| G
  D -->|コミットのたびに| G
  G --> CI["検査（CI）<br/>型・lint・試験・早送り・組み立て"]
  CI -->|30分ごと| T["体験版（Fly.io）"]
  CI -->|30分ごと| P["本番（作り手の家族の手帳）"]
```

- **統括の会話**は、全体の状態を持ち、次の一手を考えて、作業の会話へ仕事を渡します。渡す文には、目的・範囲・触らない所・終わりの形を書きます。会話どうしは、Claude Code の会話の間のメッセージでやり取りします
- **作業の会話**は、それぞれ自分の git の worktree（`~/boshi-<名前>`）とブランチで作ります。どの会話でも、作り手が承認する順は同じです。プランのページを出し、作り手が「OK」と言ったら、最後まで一気に作ります
- **ぶつからない仕掛け**は次のとおりです
  - コミットのたびに main へ上げる git のフック（`scripts/git-hooks/post-commit`）。main が先に進んでいたら、取り込むように知らせます
  - 会話を始めた時に、main とのずれを1行で出すフック（`scripts/git-sync-status.sh`）
  - 複数の会話が触るファイルの一覧と、会話ごとに分けたサーバの番号と組み立ての置き場
- **出すのは仕掛けと統括だけ**です。CI が通った main を、launchd が30分ごとに体験版と本番へ出します（`app/scripts/sync-deploy.sh`）。本番は、作り手の家族の記録の写しで確かめてから入れ替えます。応えなければ前の版に戻します
- 11/6 朝の時点で、main には 376 のコミットがあります。どれも期間中に作った物です

## 流れ

```mermaid
flowchart TD
  S["公的な統計 41項目<br/>出典と年つき<br/>app/src/sim/stats.ts"] --> P["1000組の家族を作る<br/>1組 = 年に約671家族<br/>population.ts"]
  F["珍しい型の30家族<br/>families.ts"] --> FF
  P --> FF["早送りの検査<br/>1000組 × 1000日・決まり a〜w<br/>npm run sim（修正のたびに毎回）"]
  P --> R["なりきり<br/>Opus が家族になって iPhone 幅で画面を触る<br/>Workflow simulate・drive.mjs"]
  FF --> D["日記<br/>1000組が1000日に見た物"]
  D --> Q["アンケート<br/>Sonnet が1000組として答える<br/>/survey"]
  R --> Q
  FF --> K["見つかった事"]
  R --> K
  Q --> K
  K --> Plan["次の修正の案<br/>作り手が選ぶ"]
  Plan --> C["コミット"]
  C --> FF
```

## 1. 公的な統計から1000組を作る

- 厚生労働省の人口動態統計・出生動向基本調査・雇用均等基本調査・国勢調査など、41項目の割合を `app/src/sim/stats.ts` に置きました。どの数字にも出典と年があります
- 一覧は [SIM_STATS.md](SIM_STATS.md) です。統計そのもの・計算した推計・統計が無くて置いた近似を、行ごとに分けて書いています（一覧の41行のうち、統計21・推計13・近似7）
- そこから、日本で子を迎える家族を1000組作りました（`app/src/sim/population.ts`）。1組は、2025年の出生 671,270人の 1/1000 にあたります
- 作った1000組の割合を、統計と照らすテストがあります（`app/src/sim/population.test.ts`）。有り得ない組み合わせ（週数に合わない体重など）も止めます
- ほかに、珍しい型の見本として30家族を手で作りました（双子と NICU・離島・外国籍・聴覚に障害がある親など）

## 2. 早送りの検査（どんな修正でも毎回）

- `cd app && npm run sim` で、1000組と30家族の1000日を「今日」の画面と同じ関数に通します
- 1000組で、のべ 1,035,345日。決まり a〜w の23（一番上に出す事・期限切れが積み上がらない・家族に合わない項目が出ない・出生届の期限・引っ越し・気をつける事の札・役所の休みなど）と、手帳の記録の決まり t1〜t9 を確かめます
- 新しい破れが出るとテストが落ちます。今はすべて守れています
- 決まりが守れていても、アプリが持てない状況があります。それを「表せない状況」として全国の家族数に直して出し、次に作る物の順番を決めています（今の上位は、近くに祖父母がいない 約29万家族・帝王切開 約15万家族など。上の子がいる 約35万家族・里帰り 約34万家族は、その後に作って表せるようになりました）
- Claude の API は使わないので、無料です

## 3. なりきり（画面や流れを直した後）

- Workflow `.claude/workflows/simulate.js` が、1000組から割合のまま6家族と、30家族から珍しい型を1家族選び、家族ごとに Opus 5.5 のなりきり役を並べて走らせます
- なりきり役は `app/src/sim/drive.mjs`（Playwright・iPhone の大きさ）で、`see`・`click`・`type`・`upload` などを1手ずつ打って画面を触ります。アプリのソースコードは読みません。ふつうの使い手はコードを見られないからです
- 家族の言葉の力も守ります。「やさしい日本語が要る」人は難しい漢字が分からない前提で読み、「スマホが苦手」な人は小さいボタンに気づけない前提で触ります
- 1つの目的につき25回まで押します。着けたか、何回押したか、詰まった所を、重・中・軽で返します
- サーバは本番と別です（3100番・別の DB。組み立てた版で回す）。撮るの試しには、台本が作った手帳のページの画像だけを使います
- 結果が残っている回は6回・のべ36家族・見つかった事377件です。同じ7家族で回した4回で、重い事は 21 → 9 件に減りました

## 4. アンケート（作り手が言った時だけ）

- `/survey`（`.claude/skills/survey/SKILL.md`・`app/scripts/survey.mts`）で、1000組と、なりきりで画面を触った家族に、同じ9つの質問をします
- 1000組は、早送りで作った日記（1000日の間に今日の画面で見た物）を元に Sonnet 5.5 が答えます。触った家族と、声を束にまとめる役は Opus 5.5 です
- 不便な事・欲しい物の束ごとに家族の数を数え、全国に直し、前回と比べます
- 2回回しました。SUS は 57.8 → 59.1、使い続けるは 68% → 84% です。勧めたい度（NPS）は2回とも −100 で、まだ遠いです

## 5. 見つかった事 → 直したコミット

見つかった事は、その場で全部は直しません。次の修正の案に入れて、作り手が選んでから直します。履歴に残っている例です。

| きっかけ | コミット | 中身 |
|---|---|---|
| アンケート1回目（不便の上位が「育休なしの父に育休」「上の子が出ない」「無職に職場の事」） | `b68a84b` | 家族の形を設定で聞き、予定を家族ごとに組む。決まり h を足し、既知の穴7つが消えた |
| アンケート2回目（1位「あと数百日」855組・2位「家族みんな」551組） | `554559d` | 30日より先は日付で書く。「家族みんな」は書かない |
| なりきり（授かる前に日付で数える・保育園が無い・NICU の医療費が無い・手帳の記録が予定の「済み」にならない など） | `b35d223` | コミット文に「なりきり第2・3回の案1〜9」とある |
| 意地悪な問い34問（「手帳に聞く」が体や心の判断をしないか） | `2ae64df` | 29/34 合格 → 不合格の型を直して聞き直し 6/8 |

この流れの土台は、次のコミットで入りました。

| コミット | 中身 |
|---|---|
| `282c914` | 30家族のシミュレーション: 早送りの検査・なりきりの道具・別のサーバ・Workflow |
| `67ce0ef` | API の費用を1回ずつ記録し、1回 $5 を超えたら止める |
| `c7658eb` | 公的な統計41項目から1000組を作り、早送りを1000組 × 1000日に広げる |
| `7285fda` | なりきりで1000組の家族を開けるようにする |
| `c842b91` | アンケートのスキル（/survey） |

## 6. 全体の技術監査（Workflow で観点ごとに読み、反証にかける）

- 11/5 の朝、main を8つの観点で読む Workflow を回しました。使った Claude は17です。観点ごとに読む監査役が8、それぞれの見つけた事を崩そうとする反証の役が8、最後に判定する役が1です
- 報告は89件でした（重大0・高12・中31・低46）。最後の判定役が8件に絞り、作り手が8件すべてを直すと決めました。その日のうちに全体監査（一部は統括と UX）が直して main へ入れました
- 大きな作り替え（大きな画面の分割・DB の入口を1つにまとめる事など）は、提出の後に回しています

## 7. 本物の健診で使って、直した

- 作り手は、自分の家族が使う1号目です。ハッカソンの期間中に、家族の本物の健診でこの手帳を使いました
- 録音から作ったまとめの中で、次の予定の日付が聞き違えられていました。調べ3つと反証1つの Workflow で道をたどると、確かめていない日付が、今日の画面・前日の声かけ・手帳に聞く・共有の文へ、そのまま広がる事が分かりました
- 直し方は作り手が決めました。聞き違いは仕組みでは防ぎ切れないので、最後の OK は本人に残します。結果の画面で「録音からはこう聞こえました。この日で大丈夫ですか？」と1問だけ聞きます。本人が「大丈夫」を押すまで、その日付は予定・カレンダー・送る文へ進みません（`8ea6da8`・`691e9e8`）
- この考え方は、[VISION.md](VISION.md) の性質③「答えずに、動く」にも書き足しました

## 費用の見張り

- 鍵は、本番と検査でワークスペースを分け、月の上限を付けて作ります。本番には、全体の1日の上限（`BOSHI_DAILY_USD`）と、世帯の1日の上限（`BOSHI_HOUSEHOLD_DAILY_USD`）も入れています。11/4 に、上限の無い1本の鍵を何か所にも写していて、残高を使い切った事から学んだ形です
- Claude の API を呼ぶたびに、使った額を記録します（`app/src/lib/spend.ts`）
- 検査やシミュレーションの後は、毎回 `node app/scripts/spend.mjs` で「今回・今日・残り」を出します。回す前に `app/sim-data/run-start` に時刻を書いて区切ります
- シミュレーションのサーバは、1回で `BOSHI_SIM_BUDGET_USD`（既定 $21＝7家族×$3）を、1つの家族で `BOSHI_SIM_HOUSEHOLD_USD`（既定 $3）を超えたら止まります。意地悪な問いの検査も既定 $5、アンケートは既定 $50 が上限です
- なりきり役の Claude（Claude Code）は、API の残高ではなく Claude Code の枠で動きます

## 本物の記録に触れない約束

- シミュレーションで使うのは、作った家族だけです（1000組・30家族・デモの家族）
- 作り手の家族の本物の録音・記録は `app/data/` にだけ置きます。git の外で、公開しません。シミュレーションはここに触りません
- シミュレーションは別のサーバ（3100番）と別の DB（`app/sim-data/`）で動き、本番のサーバにも触りません
- 早送りの決まり t8 が、本物の世帯に作った記録が混ざっていない事を毎回確かめます
- 結果のファイル（`app/sim/out/`）も git の外に置き、要る数字だけを [SIMULATION_RESULTS.md](SIMULATION_RESULTS.md) に写しています
