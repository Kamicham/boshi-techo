# 提出の概要（下書き）

提出先のフォームに貼る文の下書き。動画の中身は 11/6 にその時の出来を見て決める。

## 名前

母子手帳を、再発明する

## 一言

1948年、日本は母子手帳を発明した。2026年、その次の形を作る。「読む手帳」から「一緒に動く手帳」へ。

## 概要（日本語・約400字）

出産は一生に1〜2回。練習ができず、上達する前に終わります。役所は手続き、産院は体、会社は休業。全体を持っている人がどこにもいなくて、つなぐのは一番経験の無い家族です。足りないのは情報ではなく、全体を持って先回りして動いてくれる誰か。お金のある家は人を雇って手に入れています。

この手帳は、子どもを考えた日から2歳まで（1000日）、家族の時計で自分から起きて、家族と一緒に動きます。話す・撮るだけで記録になり、どの町でも窓口と期限を公式ページから取り、職場へのメールや出生届のメモまで下書きし、パートナーにも自分の番を出します。健診では先生の言葉をそのまま残して次の質問にし、体の判断はしません。最後に1000日が子どもへの一冊になります。

Claude Opus 5.5 が読み取り・調べ物・下書き・組み直し・執筆を担い、Claude Code で、公的統計から作った1000家族の1000日を修正のたびに早送りして確かめながら作りました。

## Summary (English)

Japan invented the Maternal and Child Health Handbook in 1948. This is what comes next: from a handbook you read to a handbook that moves with you. For the first 1,000 days, it wakes up on the family's own clock, turns talk and photos into records, fetches any city's procedures from official pages, drafts the emails and forms, gives the partner their own turn, and turns the doctor's words into questions for the next checkup without ever judging health. Built with Claude Opus 5.5 and Claude Code, and tested on every change against 1,000 synthetic families drawn from Japanese public statistics.

## 提出前に確かめる事

- 公開リポジトリの URL・ライセンス（MIT）
- 3分の日本語動画（11/6 に作り始め、11/7 の夜に完成。11/8 は予備）
- 素の clone → `npm ci` → `npm test` → `npm run typecheck` → `npm run build` → 起動 → 見本の家族で健診の1日
