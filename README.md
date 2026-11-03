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
| ③ | 答えずに、動く | 職場への連絡、出生届の記入メモ、保育園見学の予約文。家族がするのは「OK」だけ（外へは何も送らない） |
| ④ | 家族で1冊 | パートナーも合言葉で同じ手帳を開き、自分の番の事と、自分の名前の下書きが出る。担当は法と制度で決まる人（出生届・職場の事は働いている人）に振る |
| ⑤ | 医療は壁でなく橋 | **健診の1日を支える**: 前日に「先生の説明を録音しましょう」と声をかけ、アプリで録音 → 自宅の GPU で文字起こし → 先生が言った事・次までにやる事・次の予約・難しい言葉の言い換え（元の言葉を並べる）・次に聞く質問。大きな病院の案内図を撮ると、今日回る順番になる。**体の判断はしない** |
| ⑥ | 町の制度を取りに行く | どの町でも、その手続きの窓口・持ち物・期限を、Claude が公式ページから取ってくる（「どこへ行くか見る」） |
| ⑦ | 子どもへの贈り物 | 府令と同じ並びの記録（手帳のタブ）と1000日の言葉が、最後に子どもへ語りかける一冊になる |

### 母子手帳の魂を引き継ぐ

紙の母子手帳（府令様式）が78年かけて磨いた7つ（持つ・続く・突き合わせる・証明する・つなぐ・想いを残す・取り残さない）を壊さずに引き継ぎます。

- **手帳のタブ**: 国の様式と同じ並び（妊婦健診 → 出産 → 新生児 → 便色カード → 成長・できた日 → 予防接種 → 相談した記録 → 一冊）で記録を見る。発育曲線は国の調査の値、便色カードは国の7色から親が番号を選ぶ（アプリは判定しない。注意書きは手帳と同じ文言）
- **撮るだけ・話すだけで記録**: 紙の手帳のページを撮ると、Claude がどのページかを見分けて記録の候補を出す。「今日寝返りした」「BCG を受けた」と話しても候補になる。家族の「OK」で入る。紙の手帳が正本のまま、二重に書かせない
- **相談できる人**: 時期ごとに1回だけ「困った時に相談できる人はいますか？」と聞く（紙の手帳の毎回の問い）。「いない」なら、町のこども家庭センター・産後ケア・#8000・児童相談所の相談ダイヤルへ橋をかける
- **急ぎの時**: 「迷ったら 119」と #8000、窒息の手当と心肺蘇生の要点（こども家庭庁の任意様式・日本蘇生協議会のガイドラインを元に短く）。電波が無くても開ける

作り手自身が、使う人の1号目です。家族の妊婦健診で、このアプリで先生の説明を録音して使っています（本物の記録は公開しません）。

## Claude の使い方

- **Claude Opus 5.5** が7つの役を担う: 声と写真の読み取り（画像入力）、記録の構造化（Structured Outputs＋zod）、自治体の制度の調査（web 検索ツール・出典つき）、下書き、生まれた日や町が変わった時の組み直し（参謀の気づき）、健診の整理、一冊の執筆
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
- `ASR_URL` が無い時は、用意したデモの文字起こしに自動で切り替わる（画面に「デモの文字起こし」と出る）。GPU が無くても、健診の1日を最後まで試せる
- スマホのマイクは https でないと使えない。家の機械で動かす時は Tailscale Serve などで https の住所を付ける
- 家族が毎日使う時は、組み立て済みの本番で動かす（`app/scripts/serve-prod.sh`・更新は `app/scripts/deploy-local.sh`）。開発サーバのままだと、コードを直した時に録音中の画面が読み直される
- デモの家族（すべて架空・町だけ実在のさいたま市）は上の切り替えで選べる。時計を早送りできる

```bash
npm test          # 時計・期限・健診の処理の単体テスト
npm run typecheck
```

## しくみ

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

修正のたびに、公的な統計の割合から作った1000家族（すべて作った家族）でアプリの1000日を早送りしています。使った割合と出典: [docs/SIM_STATS.md](docs/SIM_STATS.md)

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
3. **Acts instead of answering**: drafts of the message to your employer, birth-registration notes, daycare visit requests. The family only says "OK". Nothing is sent.
4. **One handbook for the family**: the partner opens the same handbook (with a family passcode) and sees their own tasks and drafts written in their own name. Tasks go to whoever the law and the system name (for work matters, the parent who is employed).
5. **A bridge to medicine, not a wall**: the day of a prenatal checkup. The app reminds you to ask the doctor to record, records in the app, transcribes on a home GPU, and turns it into what the doctor said, what to do next, the next appointment, plain-language notes for jargon (always next to the doctor's own words) and questions for next time. Photograph a big hospital's floor map and get today's route. **It never judges health.**
6. **Fetches your city's rules**: for any city, the office, what to bring and the deadline for each procedure are fetched from the official pages.
7. **A gift to the child**: the 1,000 days of records become a book that speaks to the child.

### Carrying the soul of the paper handbook

The national handbook format has been refined for 78 years. We keep its seven qualities: the family holds it, it continues from pregnancy onward, parent and doctor records sit side by side, vaccination records serve as proof, it asks every time whether you have someone to talk to, it keeps the family's own words, and it leaves no one behind.

- **Handbook tab**: records in the same order as the national format (prenatal checkups, birth, newborn, stool color card, growth and milestones, vaccinations, consultations, and finally the book). Growth charts use national survey values; for the stool color card the parent picks one of the seven official colors (the app never judges; the notes are the handbook's own wording).
- **Record by photo or voice**: photograph a page of the paper handbook and Claude identifies the page and proposes entries; saying "rolled over today" or "got the BCG shot" works too. Nothing is saved until the family taps OK. The paper handbook stays the original.
- **Someone to talk to**: once per stage, the app asks the handbook's recurring question, "Do you have someone to talk to when things are hard?" If not, it links to the city's child and family center, postpartum care, the #8000 pediatric line and the child guidance hotline.
- **Emergency page**: "When in doubt, call 119" plus #8000, and short steps for choking and CPR (based on the Children and Families Agency's handbook pages and the Japan Resuscitation Council guidelines). It opens even offline.

The author is user #1, using it at a family member's real prenatal checkups (real records are never published).

## How Claude is used

Claude Opus 5.5 plays seven roles (vision, structured outputs with zod, web search with citations, drafting, replanning when the baby comes early or late or the family moves, checkup structuring, book writing); Claude Haiku 5.5 handles light formatting. A shared charter forbids medical judgment in every call. The whole project was built with Claude Code, with parallel agents per feature; the commit history is the record.

Every change is fast-forwarded through 1,000 days with 1,000 synthetic families drawn from Japanese public statistics (sources: [docs/SIM_STATS.md](docs/SIM_STATS.md), in Japanese).

## Run

See the Japanese section above (`cd app && npm install && npm run dev`, with `ANTHROPIC_API_KEY` and `ASR_URL` in `.env.local`). Without `ASR_URL`, a bundled demo transcript is used so the whole visit flow still works without a GPU.

## License

MIT
