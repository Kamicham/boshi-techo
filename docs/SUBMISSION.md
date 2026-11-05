# 提出の概要（下書き）

提出先のフォームに貼る文の下書き。動画の中身は 11/6 にその時の出来を見て決める。

## 名前

母子手帳を、再発明する

## 一言

1948年、日本は母子手帳を発明した。2026年、その次の形を作る。「読む手帳」から「一緒に動く手帳」へ。

## 概要（日本語・約400字）

出産は一生に1〜2回。練習ができず、上達する前に終わります。役所は手続き、産院は体、会社は休業。全体を持っている人がどこにもいなくて、つなぐのは一番経験の無い家族です。足りないのは情報ではなく、全体を持って先回りして動いてくれる誰か。お金のある家は人を雇って手に入れています。

この手帳は、おなかに宿った日から2歳まで（1000日）、家族の時計で自分から起きて、家族と一緒に動きます。話す・撮るだけで記録になり、どの町でも窓口と期限を公式ページから取り、職場へのメールや出生届のメモまで下書きし、パートナーにも自分の番を出します。健診では先生の言葉をそのまま残して次の質問にし、体の判断はしません。最後に1000日が子どもへの一冊になります。

Claude は毎日の仕事を Sonnet 5.5、深い仕事（組み直し・健診の整理・一冊）を Opus 5.5 で担います。Claude Code で、公的統計から作った1000家族の1000日を修正のたびに早送りして確かめながら作りました。

## Summary (English)

Japan invented the Maternal and Child Health Handbook in 1948. This is what comes next: from a handbook you read to a handbook that moves with you. For the first 1,000 days, it wakes up on the family's own clock, turns talk and photos into records, fetches any city's procedures from official pages, drafts the emails and forms, gives the partner their own turn, and turns the doctor's words into questions for the next checkup without ever judging health. Claude Sonnet 5.5 handles the everyday jobs (reading, drafting, answering, research) and Claude Opus 5.5 the deep ones (replanning, checkup notes, the book). Built with Claude Code, and tested on every change against 1,000 synthetic families drawn from Japanese public statistics.

## Claude の使い方（仕事 → モデル → 理由）

| 仕事 | モデル | 理由 |
|---|---|---|
| 撮る・話すの読み取り、下書き、手帳に聞く（とその書き直し） | Sonnet 5.5 | 毎日の仕事。単価は Opus の半分 |
| 調べ物（web 検索・出典つき） | Sonnet 5.5 | 1回に検索の結果を約8万トークン読む。後で整え、出典も残すので Sonnet で質を保てる |
| 参謀の気づきと見渡し、健診の整理、一冊 | Opus 5.5 | 深い仕事（家族の形と記録の突き合わせ・先生の言葉・一度きりの長い文） |
| 手帳に聞くの見張り、調べ物の整え | Haiku 5.5 | 軽い仕事 |

正本は `app/src/lib/claude.ts` の4つの定数（`MODEL`・`EVERYDAY_MODEL`・`LIGHT_MODEL`・`RESEARCH_MODEL`）。1日の上限（`BOSHI_DAILY_USD`・`BOSHI_HOUSEHOLD_DAILY_USD`）を超えた日は Claude の仕事だけが止まり、見本の家族は見本の答え（`lib/samples.ts`）で動きます。公開版の体験は、ハッカソンの間は Claude を呼びません。

| Job | Model | Why |
|---|---|---|
| Reading photos and voice, drafts, "Ask the handbook" (and its rewrites) | Sonnet 5.5 | Everyday jobs; half Opus's price |
| Research with web search and citations | Sonnet 5.5 | Each call reads about 80k tokens of results; reshaped afterwards with sources kept |
| Advisor and per-stage look, checkup notes, the book | Opus 5.5 | Deep work |
| Guard on "Ask" replies, reshaping research | Haiku 5.5 | Light jobs |

## 提出前に確かめる事

- 公開リポジトリの URL・ライセンス（MIT）
- 3分の日本語動画（11/6 に作り始め、11/7 の夜に完成。11/8 は予備）
- 素の clone → `npm ci` → `npm test` → `npm run typecheck` → `npm run build` → 起動 → 見本の家族で健診の1日
