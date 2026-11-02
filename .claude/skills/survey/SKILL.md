---
name: survey
description: 母子手帳の家族アンケート。現実の統計から作った1000組と、画面を実際に触った家族（なりきり）に「何が不便か・どこが使いづらいか・欲しい機能は何か」を聞き、全国に直して前回と比べた報告を出す。社長が「アンケートを取って」「アンケート」「/survey」と言った時に使う（修正のたびには回さない）。
---

# 家族アンケート（/survey）

修正をいくつか重ねた後で、社長が言った時だけ回す（2026-11-03 社長指示）。答えるのは作った家族（近似）。わが家（`app/data/`）と本番（3210番）には触らない。サーバは要らない。

## 手順（一気通貫。所要は約40分・Claude API は約 $30〜35）

1. **始める前に、終わる時刻の見込みを時刻で言う**（`date` を見て +40分）。
2. **区切る**: `cd app && date -u +%FT%TZ > sim-data/run-start`
3. **日記を作る**（無料・約30秒）: `npm run survey:diary`。1000組が1000日の間に今日の画面で見た物が `sim/out/diary.json` に出る（早送りの検査と同じ関数）。
4. **画面を触った家族を集める**: 前回のアンケートより後に回したなりきり（Workflow `simulate`）の journal を探す。
   `ls -t ~/.claude/projects/-Users-zhang-boshi-techo/*/subagents/workflows/*/journal.jsonl`
   中身に `"findings"` と `pop-`/`sim-` の家族がある物だけを使う（前回の日付は `app/sim/out/survey/` の一番新しいフォルダ名）。
5. **アンケートを取る**（裏で回す。`run_in_background`）:
   `npm run survey -- --touched <journal1> [--touched <journal2> …]`
   - 1000組は Sonnet 5.5、触った家族と束ね方は Opus 5.5（社長の指示「品質を重視・クレジットは惜しまない」。下のモデルに落とさない）
   - 上限は `BOSHI_SIM_BUDGET_USD`（この台本の既定は $50）。超えたら止まる
   - 途中で止まった時は `--resume app/sim/out/survey/<フォルダ>` で、答えていない家族だけ聞き直す
   - 試すだけなら `--limit 3`
6. **報告を出す**: `app/sim/out/survey/<日時>/report.html` を、アンケートの Artifact に出し直す（URL は `app/sim/out/survey/artifact-url` に1行。無ければ新しく出して、そのファイルに書く）。報告には前回比が自動で入る。
7. **会話に出す**: 先頭に `node scripts/spend.mjs` の「今回・今日・残り」の3行。続けて URL と要点2行（SUS・NPS・使い続ける%の前回比、不便の1位）。
8. 見つかった事は勝手に直さない。不便の上位から、次の修正の案（プランの Artifact）に入れて社長に出す。

## 中身（変える時はここを読む）

- 質問9つ（毎回同じ。前回と比べるため）: `app/scripts/survey.mts` の `AnswerSchema`。一番不便な事・使いづらい所・家族に合わない事・欲しい機能・助かった事・SUS 10問（使いやすさの国際的な尺度。平均68）・勧めたい度（NPS）・一緒に使っていた物・使い続けるか
- 答える人に渡す物: 家族の状況（`profileText`）、日記、画面の説明（`APP_GUIDE`）。**画面を足したり変えたりしたら `APP_GUIDE` も直す**（直さないと、無い機能を欲しがる・ある機能を知らない答えになる）
- 束ね方: Opus が声から束を作る（前回の束を引き継ぐので、前回と比べられる）→ Sonnet が全部の声を束に振り分ける → 台本が数え、全国に直す（1組 = 年に約671家族）
- 結果: `app/sim/out/survey/<日時>/`（answers/・categories.json・classes.json・summary.json・report.html。git の外）
