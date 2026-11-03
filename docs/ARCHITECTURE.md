# しくみ

```
app/                       Next.js 15（App Router・TypeScript・Tailwind 4）
  src/lib/clock.ts         家族の時計（妊娠週数・生後日数・1000日の何日目か）
  src/lib/milestones.ts    全国共通の「その時やる事」（法律・国の目安だけ。根拠つき）
  src/lib/demo-family.ts   デモの家族（すべて架空。町だけ実在のさいたま市）
  src/lib/family.ts        家族を引く（デモ＝固定／わが家＝DB の profile）
  src/lib/claude.ts        Claude を呼ぶ共通の部品（structured＝決まった形で受け取る／research＝web 検索つき／imageBlock）
  src/lib/asr.ts           録音を文字にする（自宅の GPU の機械の asr/server.py）
  src/lib/db.ts            SQLite の docs 表（type ごとに JSON を置く）。置き場 app/data/ は git の外
  src/lib/api.ts           API ルートの包み route() と body()
  src/lib/techo.ts         母子手帳の記録の背骨（府令様式のページの並び・記録の形・便色の7色・手帳と同じ注意書き）
  src/lib/techo-seed.ts    作った家族（デモ・sim-・pop-）の手帳の記録を統計から作る（わが家には作らない。出典はファイルの頭）
  src/app/techo            手帳のタブ（府令の並びで記録を見る・発育曲線・便色カード・予防接種の控え・最後に一冊）
  src/app/emergency        急ぎの時（迷ったら119・#8000・窒息と心肺蘇生）。家族の読み込みを待たずに出し、public/sw.js が通信なしでも開けるよう取っておく
  src/components/today/ConsultAsk.tsx  時期ごとに1回「相談できる人はいますか」を聞き、「いない」なら町の相談先へ橋をかける
  src/lib/app-guide.ts     画面の地図（どの画面で何ができるか。手帳に聞くが使い方を答える正本。下のタブの並びもここ）
  src/lib/ask/             手帳に聞く: agent.ts（道具を使うループ・会話の決まり・見張り）・tools.ts（予定・手帳・町・動きの道具）・bridge.ts（急ぎ・心の危機の床）
  src/components/ask/AskSheet.tsx  右下の「聞く」と窓（返事の下の動き: 画面へ行く・窓口と下書き・済みにする・健診で聞く・記録する・渡す文・電話）
  src/components/FamilyProvider.tsx  見ている家族と「今日」を全画面で共有（useFamily）、api() 呼び出し
  src/components/Shell.tsx           上の家族切り替え・下のタブ（今日／健診／話す・撮る／手帳）
asr/server.py              文字起こしサーバ（faster-whisper large-v3）
```

## 約束

- 体の判断をしない（`CHARTER` in claude.ts）。言い換えは元の言葉を必ず並べる。
- 本物の家族の記録・録音は `app/data/` にだけ置く（公開リポジトリに入らない）。
- Claude のモデルは `claude-opus-5-5`（軽い仕事は `claude-haiku-5-5`）。決まった形は zod で受け取る。
- 手帳の体の数字は、家族が話したか紙の手帳から写した物だけ。撮った・話した記録は候補（pending）で入り、家族の OK で確定する。数字・色・発達に「異常」「正常」を言わず、手帳と同じ注意書きと相談先への橋だけを出す。
- 画面はスマホの幅（max-w-md）で作る。色は globals.css のトークン（paper・card・ink・muted・line・rose・sky・ok・warn・alert）。見出しは `font-display`。

## 記録の種類（db の type）

| type | 中身 |
|---|---|
| record | 話した・撮った記録（①入力ゼロ） |
| visit | 健診 1 回分（⑤）: 録音・文字起こし・整理・院内の道案内 |
| local | 町の制度の調べ結果（②⑥） |
| draft | 下書き（③） |
| done | 済んだ事 |
| book | 一冊（⑦） |
| techo | 母子手帳の記録 1 件（`TechoEntry`。page＝府令のページ・date・values・source＝voice/photo/text/seed・pending＝OK 前の候補） |
| profile | わが家の設定 |
| chat | 手帳に聞くの会話（家族ごとに1つ。直近80往復） |

## 母子手帳の記録（techo）の流れ

```
話す・撮る ──> Claude がページを見分けて行を取り出す ──> 候補（pending:true）
                                                   └─ 家族の「OK」 ──> 記録（pending なし）──> 手帳のタブ・一冊
今日の画面の「相談できる人はいますか」 ──> page "consult" に記録
作った家族 ──> seedTecho(family, today) ──> 統計から作った記録（source "seed"。わが家には無い）
```

- 並びは府令様式（母子保健法施行規則 様式第三号、2026年4月施行版）と同じ。紙の手帳が正本のまま、二重に書かせない。
- 作った家族の記録の決まり（今日より後の日付が無い・体の数字が家族のデータか出典の範囲・判定の言葉が無い・わが家には無い）は、早送りの検査（`npm run sim`）が毎回確かめる。

## 手帳に聞く（どの画面からも）

```
家族の問い（書く・押して話す）──> 機械の床（bridge.ts: 急ぎ・心の危機の言葉に電話と「急ぎの時」）
   └─> Opus 5.5 が道具を選ぶ（最大8手）
         読む: get_plan（予定）・get_notebook（手帳・記録・健診）・look_up_town（町の公式ページ）・search_official（予定に無い制度）
         動く: open_screen・offer_paperwork・propose_done・add_checkup_question・add_record・write_message（ボタンを積むだけ。書き込まない）
   └─> 見張り（Haiku 5.5: 体・心・栄養の判断の言葉）──> あれば書き直し
   └─> 返事＋動きのボタン ──> 家族が押した時だけ、既存の API（/api/visit/plan・/api/capture・/api/done・/api/draft）で書き込む
```

- 答える: 手続き・期限・お金・仕事・町・この家族の予定と記録・アプリの操作（画面の地図だけを根拠に。無い機能は作らない）。
- 判断しない: 体・病気・薬・発達・数値・便の色・心・栄養。記録・健診で聞く事・連絡先への橋に変える（母子手帳そのものの注意書きは、そのまま伝える）。
- 検査: `npx vitest run src/lib/ask src/lib/app-guide.test.ts`（床・道具・地図の抜け）、`NODE_OPTIONS=--conditions=react-server npx tsx scripts/ask-redteam.mts`（体・心・栄養・急ぎの意地悪な問いと対照。結果は `app/sim/out/ask-redteam.md`）。
