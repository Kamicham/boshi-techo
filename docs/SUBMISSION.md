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
- **魂の一行**: 手続きは、手帳に任せて。あなたは、子どものそばに。（Leave the paperwork to the handbook. Stay close to your child.）— 11/6 20:0x に作り手が言い換えた（前の「抱えるのは、手帳。抱くのは、あなた。」は、「抱える」と「抱く」の掛け合わせが一瞬伝わらないため）
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
| 見本の家族（佐藤家）の1000日の用事 49件、うち法の期限 13件 | `app/src/lib/milestones.ts` の `scheduleFor` を node で呼んで数えた（2026-11-07 に main fea57c3 で数え直し。ふつうの育休の目安が1件増えた） |
| 生まれてから8週に始まる用事 14件・期限が来る用事 11件（妊娠中で一番多い8週＝56日は 6件・5件） | 同上（8週は、生まれてからの数え方と同じ56日の窓） |
| 2週早く生まれた時に日付を数え直す用事 28件（1000日の中）と、新しく出る1件（パートナーの育休の始まりを早める） | 同上（予定日で数えた写しと比べた）。法が予定日から数える物は動かさない |
| 早送りの検査: 修正のたびに 1,030家族の1000日（のべ約106万日）を動かし、23の決まり（a〜w）で確かめる | `app/src/sim/fastforward.test.ts`。珍しい30家族は毎日、統計から作った1000組は7日ごと＋節目を確かめる |
| 1000組は 2025年の出生の1000分の1の縮図（47都道府県・235市区町村） | `app/src/sim/population.test.ts` |
| #8000 は47都道府県、#7119 は42地域 | `app/src/lib/emergency-lines.ts` |
| 試験 110ファイル・1,476件（2026-11-05）※ | `npm test` |
| コミット 405・うち Claude と共著 320（2026-11-06 21:28・39eec5b。3分の動画の数もこの時点）※ | `git log` |

言わない事: 「お金のある家は、人を雇っている」（11/6 作り手「金持ちがどうしているかはどうでもいい。あくまで一般論として、みんな大変。それでいい」）／「1,030家族の毎日を確かめる」（毎日は30家族だけ）／「約19人に1人」（公式は 5.4％）／「世界約40か国」（JICA は約50）／画面の「◯日目」（画面は線の位置で見せる）。

## 概要（日本語・500字以内）

フォームの型: 1文目を「このプロジェクトは、〔誰〕の〔課題〕を〔どう変える〕〔形〕です。」にし、その下に具体的な利用の場面を入れて500字以内（下の本文は改行・空白こみで464字。2026-11-06 統括の割り振り。11/6 夜に作り手の言葉で「お金のある家」の一文を外した）。

このプロジェクトは、妊娠から2歳までの1000日を迎える家族の「役所・産院・会社がばらばらで、全体を持つ人がいない」負担を、手帳が全体を抱えて先に動き、家族は最後の OK だけで済む形に変える、スマホで使う母子手帳です。

出産は一生に1〜2回で、練習ができません。

たとえば予定より2週早く生まれた日。手帳は14日以内の届けを役所へ行く1日にまとめ、1000日の用事のうち28件の日付を数え直し、上司へのメールまで、それぞれの名前で下書きします。ふだんは話す・撮るだけで記録になり、どの町の窓口と期限も公式ページから取ります。健診の録音から聞こえた日付は「こう聞こえました。大丈夫ですか？」と本人に確かめてから入れ、体の判断はしません。日本語・中文・English で使え、1000日の終わりに子どもへの一冊になります。

日々の仕事は Claude Sonnet 5.5、健診の整理と一冊は Opus 5.5。Claude Code で、公的統計から作った1000家族の1000日を、直すたびに早送りで確かめて作りました。

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

## 動画の素材と権利（3分の動画）

すべて大会の期間中（2026-11-02〜）に作りました。動画の最後に「語りの声と曲は AI で生成」「締めの声は作り手本人」「見本の家族は作った家族」と出します。

| 素材 | 作り方 | 権利 |
|---|---|---|
| 画面 | このアプリを、本番と別の録画用のサーバで動かして撮った。家族は作った家族 | 自作（MIT） |
| Claude の場面 | 録画用のサーバで本物の Claude（Sonnet 5.5・Haiku 5.5・Opus 5.5）を呼んで撮った。札の「この回 $…」はその時の額 | — |
| 見本の写真と声 | 写真は Z-Image-Turbo、声は AivisSpeech と Qwen3-TTS で合成（README「見本の素材」と同じ） | Apache-2.0・ACML 1.0 |
| 語り | Gemini API の音声合成（gemini-3.8-flash-tts・声 ja-jp-storyteller-5）。台本の35文を1回でまとめて読ませた（速めていない。6本読ませた中から、文ごとの声の高さが一番そろった1本）。無料枠の鍵で作ったので、送った台本（動画で公開する文だけ）は Google のサービスの改善に使われ得る | Gemini API 追加利用規約（2026-03-23 施行）。Google は生成物の所有権を主張しない |
| 締めの声 | 作り手本人が iPhone のボイスメモで録った「手続きは、手帳に任せて。あなたは、子どものそばに。」。雑音を消し、語りと同じ大きさにそろえた。下に「作り手も、12月に父になります。」を1行出す（2026-11-07 作り手） | 自作 |
| 曲 | Gemini API の Lyria 3.5 で作曲した、歌なしの映画音楽風の曲（指示に実在の歌手・既存の曲名を入れていない）。場面に合わせて小節で切り貼りした | Gemini API 追加利用規約。Google は生成物の所有権を主張しない。聞こえない透かし（SynthID）入り |
| 字体 | Noto Sans JP・Noto Sans SC・M PLUS Rounded 1c・Cormorant Garamond | SIL Open Font License 1.1 |
| 効果音 | 使っていない | — |

## 提出前に確かめる事

- 公開リポジトリの URL・ライセンス（MIT）
- 3分の日本語動画（11/6 に作り始め、11/6 の夜に完成＝2:59.3。11/7 に場面の長さを見直し、締めを作り手本人の声にした。YouTube へは作り手が限定公開で上げ、題は「母子手帳を、再発明する」で始める）
- 素の clone → `npm ci` → `npm test` → `npm run typecheck` → `npm run build` → 起動 → 見本の家族で健診の1日（健診の整理と案内図は見本の答えが無いので、鍵を入れて確かめる。鍵が無い時は整理の前まで）
