# 提出の概要（下書き）

提出先のフォームに貼る文の下書き。動画の中身は 11/6 にその時の出来を見て決める。

## 名前

母子手帳を、再発明する

## 一言

1948年、日本は母子手帳を発明した。2026年、その次の形を作る。「読む手帳」から「一緒に動く手帳」へ。

## 言葉の正本（README・作品のページ・動画の字幕は、ここから写す）

2026-11-06 に作り手が3分デモの第2稿と一緒に承認。数字は、本物の関数と一次の出典で確かめた（※は提出の直前に数え直す）。

- **名前**: 母子手帳を、再発明する
- **一言**: 読む手帳から、一緒に動く手帳へ。
- **魂の一行**: 抱えるのは、手帳。抱くのは、あなた。（The handbook carries the load. You hold the child.）
- **3つの言い分**
  1. **全体を抱えて、先に動く** — 妊娠から2歳までの1000日。週数と月齢で自分から起き、どの町でも公式ページを調べ、期限・下書き・窓口まで用意する。家族がするのは最後の OK だけ。
  2. **最後に決めるのは本人** — 録音や写真から出た日付は「こう聞こえました。大丈夫ですか？」と聞く。体の判断はせず、健診で聞く事と連絡先へつなぐ。手紙と声は家族の鍵で封をし、Claude には渡さない。
  3. **家族で1冊、親の言葉で** — パートナーにも自分の番と、自分の名前の下書き。日本語・中文・English で使える。

| 数字 | 出典・数え方 |
|---|---|
| 母子手帳は1948年に日本で生まれ、世界約50か国で使われてきた | JICA（2024-02-15）。2021年12月時点の JICA の資料では「約50の国と地域」 |
| 2025年の出生 671,270人 | 厚生労働省 人口動態統計（確定数・2026-09-30 公表） |
| 親の少なくとも1人が外国人の子 5.4％（38,389人・2024年） | 厚生労働省「令和6年 日本における外国人の人口動態」表1 |
| 出生届は14日以内 | 戸籍法第49条 |
| 見本の家族（佐藤家）の1000日の用事 48件、うち法の期限 13件 | `app/src/lib/milestones.ts` の `scheduleFor` を node で呼んで数えた |
| 生まれてから8週に始まる用事 14件・期限が来る用事 11件（妊娠中で一番多い8週は 7件・4件） | 同上 |
| 2週早く生まれた時に日付を数え直す用事 28件（1000日の中）と、新しく出る1件（パートナーの育休の始まりを早める） | 同上（予定日で数えた写しと比べた）。法が予定日から数える物は動かさない |
| 早送りの検査: 修正のたびに 1,030家族の1000日（のべ約106万日）を動かし、22の決まりで確かめる | `app/src/sim/fastforward.test.ts`。珍しい30家族は毎日、統計から作った1000組は7日ごと＋節目を確かめる |
| 1000組は 2025年の出生の1000分の1の縮図（47都道府県・235市区町村） | `app/src/sim/population.test.ts` |
| #8000 は47都道府県、#7119 は42地域 | `app/src/lib/emergency-lines.ts` |
| 試験 110ファイル・1,476件（2026-11-05）※ | `npm test` |
| コミット 375・うち Claude と共著 295（2026-11-06 8:50）※ | `git log` |

言わない事: 「1,030家族の毎日を確かめる」（毎日は30家族だけ）／「約19人に1人」（公式は 5.4％）／「世界約40か国」（JICA は約50）／画面の「◯日目」（画面は線の位置で見せる）。

## 概要（日本語・約400字）

出産は一生に1〜2回。練習ができず、上達する前に終わります。役所は手続き、産院は体、会社は休業。全体を持っている人がどこにもいなくて、つなぐのは一番経験の無い家族です。足りないのは情報ではなく、全体を持って先回りして動いてくれる誰か。お金のある家は人を雇って手に入れています。

この手帳は、おなかに宿った日から2歳まで（1000日）、家族の時計で自分から起きて、家族と一緒に動きます。話す・撮るだけで記録になり、どの町でも窓口と期限を公式ページから取り、職場へのメールや出生届のメモまで下書きし、パートナーにも自分の番を出し、親の言葉（日本語・中文・English）で使えます。健診では録音から聞こえた言葉を元のまま残して次の質問にし、聞こえた日付は本人が確かめてから入れます。体の判断はしません。最後に1000日が子どもへの一冊になります。

Claude は毎日の仕事を Sonnet 5.5、深い仕事（組み直し・健診の整理・一冊）を Opus 5.5 で担います。Claude Code で、公的統計から作った1000家族の1000日を修正のたびに早送りして確かめながら作りました。

## Summary (English)

Japan invented the Maternal and Child Health Handbook in 1948. This is what comes next: from a handbook you read to a handbook that moves with you. For the first 1,000 days, it wakes up on the family's own clock, turns talk and photos into records, fetches any city's procedures from official pages, drafts the emails and forms, gives the partner their own turn, works in Japanese, Chinese or English, and turns the doctor's words into questions for the next checkup without ever judging health. Claude Sonnet 5.5 handles the everyday jobs (reading, drafting, answering, research) and Claude Opus 5.5 the deep ones (replanning, checkup notes, the book). Built with Claude Code, and tested on every change against 1,000 synthetic families drawn from Japanese public statistics.

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
- 素の clone → `npm ci` → `npm test` → `npm run typecheck` → `npm run build` → 起動 → 見本の家族で健診の1日（健診の整理と案内図は見本の答えが無いので、鍵を入れて確かめる。鍵が無い時は整理の前まで）
