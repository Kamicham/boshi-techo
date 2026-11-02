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
  src/components/FamilyProvider.tsx  見ている家族と「今日」を全画面で共有（useFamily）、api() 呼び出し
  src/components/Shell.tsx           上の家族切り替え・下のタブ（今日／健診／話す・撮る／一冊）
asr/server.py              文字起こしサーバ（faster-whisper large-v3）
```

## 約束

- 体の判断をしない（`CHARTER` in claude.ts）。言い換えは元の言葉を必ず並べる。
- 本物の家族の記録・録音は `app/data/` にだけ置く（公開リポジトリに入らない）。
- Claude のモデルは `claude-opus-5-5`（軽い仕事は `claude-haiku-5-5`）。決まった形は zod で受け取る。
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
| profile | わが家の設定 |
