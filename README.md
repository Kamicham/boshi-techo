# 母子手帳を、再発明する（仮称）

> 1948年、日本は母子手帳を発明した。それは世界約40か国に広がった。
> 2026年、その次の形を作る。「読む手帳」から、「一緒に動く手帳」へ。

**Built with Claude: Japan 2026** の出品作（テーマ #2「本来、誰にでも届くべきものを。」）。
開発期間: 2026-11-02 12:30 〜 2026-11-08 20:00（JST）。このリポジトリは期間中にゼロから作っています。

[English below](#english)

## なぜ作るか

出産は一生に1〜2回。練習ができず、上達する前に終わります。役所は手続き、産院は体、会社は休業、親は手伝い。全体を持っている人がどこにもいなくて、つなぐのは一番経験の無い家族です。しかも、産後の眠れない数週間に、出生届（14日以内）・児童手当（15日以内）・保険・医療証が重なります。

足りないのは情報ではなく、**全体を持って先回りして動いてくれる誰か**。お金のある家は人を雇って手に入れています。それを、すべての家族に。詳しくは [docs/VISION.md](docs/VISION.md)。

## 何ができるか（7つの性質）

| | 性質 | このアプリで動くもの |
|---|---|---|
| ① | 入力ゼロ | 話すだけ・撮るだけ（役所の封筒、健診の紙）で、日付つきの記録と期限になる。足りない事は1つだけ聞く |
| ② | 1000日を生きる | 家族の時計（妊娠週数・生後日数）で、その日にやる事が自分から出てくる。住んでいる町の窓口・持ち物・助成は、Claude が市の公式ページを web 検索で取りに行き、出典つきで残す |
| ③ | 答えずに、動く | 職場への連絡、出生届の記入メモ、保育園見学の予約文、入院の持ち物。家族がするのは「OK」だけ（外へは何も送らない） |
| ④ | 家族全体の参謀 | 母・パートナー・祖父母、一人ずつの「今週のあなたの事」。負担の偏りを数字で見せて組み替える。遠くの祖父母には大きな字とやさしい言葉で |
| ⑤ | 医療は壁でなく橋 | **健診の1日を支える**: 前日に「先生の説明を録音しましょう」と声をかけ、アプリで録音 → 自宅の GPU で文字起こし → 先生が言った事・次までにやる事・次の予約・難しい言葉の言い換え（元の言葉を並べる）・次に聞く質問。大きな病院の案内図を撮ると、今日回る順番になる。**体の判断はしない** |
| ⑥ | 家族が育てる地図 | 「窓口に行ってみてどうだった？」を家族が足し、確かめた家族の数とともに次の家族へ |
| ⑦ | 子どもへの贈り物 | 1000日の記録が、最後に子どもへ語りかける一冊になる |

作り手自身が、使う人の1号目です。家族の妊婦健診で、このアプリで先生の説明を録音して使っています（本物の記録は公開しません）。

## Claude の使い方

- **Claude Opus 5.5** が7つの役を担う: 声と写真の読み取り（画像入力）、記録の構造化（Structured Outputs＋zod）、自治体の制度の調査（web 検索ツール・出典つき）、下書き、家族の分担、健診の整理、一冊の執筆
- 軽い整形は **Claude Haiku 5.5**
- 体の判断をしない約束を、すべての呼び出しの共通の決まり（`CHARTER`）として持つ
- 作る過程は **Claude Code** で進めた（計画 → 承認 → 実装を、機能ごとに並列のエージェントで）。コミットの履歴がその記録

## 動かし方

```bash
cd app
npm install
cp .env.example .env.local   # ANTHROPIC_API_KEY と ASR_URL を書く
npm run dev                  # http://localhost:3000
```

- 文字起こし（健診の録音）は [asr/](asr/) の小さなサーバ（faster-whisper large-v3）を GPU の機械で動かし、`ASR_URL` で指す。音声は家のネットワークの外に出ない
- スマホのマイクは https でないと使えない。家の機械で動かす時は Tailscale Serve などで https の住所を付ける
- デモの家族（すべて架空・町だけ実在のさいたま市）は上の切り替えで選べる。時計を早送りできる

```bash
npm test          # 時計・期限・健診の処理の単体テスト
npm run typecheck
```

## しくみ

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

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

## What it does

1. **Zero input**: talk or take a photo (a letter from the city, a checkup slip); it becomes dated records and deadlines. It asks at most one question.
2. **Lives through 1,000 days**: a family clock (weeks of pregnancy, days since birth) surfaces what to do today. Local rules for your own city are researched with Claude's web search, with sources.
3. **Acts instead of answering**: drafts of the message to your employer, birth-registration notes, daycare visit requests, hospital bag lists. The family only says "OK". Nothing is sent.
4. **A chief of staff for the whole family**: "your things this week" for mother, partner and grandparents, with the load balance shown and rebalanced. Large, gentle text for grandparents far away.
5. **A bridge to medicine, not a wall**: the day of a prenatal checkup. The app reminds you to ask the doctor to record, records in the app, transcribes on a home GPU, and turns it into what the doctor said, what to do next, the next appointment, plain-language notes for jargon (always next to the doctor's own words) and questions for next time. Photograph a big hospital's floor map and get today's route. **It never judges health.**
6. **A map families grow**: tips about city-office counters, confirmed by families, passed to the next family.
7. **A gift to the child**: the 1,000 days of records become a book that speaks to the child.

The author is user #1, using it at a family member's real prenatal checkups (real records are never published).

## How Claude is used

Claude Opus 5.5 plays seven roles (vision, structured outputs with zod, web search with citations, drafting, family planning, checkup structuring, book writing); Claude Haiku 5.5 handles light formatting. A shared charter forbids medical judgment in every call. The whole project was built with Claude Code, with parallel agents per feature; the commit history is the record.

## Run

See the Japanese section above (`cd app && npm install && npm run dev`, with `ANTHROPIC_API_KEY` and `ASR_URL` in `.env.local`).

## License

MIT
