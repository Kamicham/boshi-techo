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

## 母子手帳の記録（techo）の流れ

```
話す・撮る ──> Claude がページを見分けて行を取り出す ──> 候補（pending:true）
                                                   └─ 家族の「OK」 ──> 記録（pending なし）──> 手帳のタブ・一冊
今日の画面の「相談できる人はいますか」 ──> page "consult" に記録
作った家族 ──> seedTecho(family, today) ──> 統計から作った記録（source "seed"。わが家には無い）
```

- 並びは府令様式（母子保健法施行規則 様式第三号、2026年4月施行版）と同じ。紙の手帳が正本のまま、二重に書かせない。
- 作った家族の記録の決まり（今日より後の日付が無い・体の数字が家族のデータか出典の範囲・判定の言葉が無い・わが家には無い）は、早送りの検査（`npm run sim`）が毎回確かめる。
