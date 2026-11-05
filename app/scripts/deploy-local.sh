#!/bin/zsh
# 使いません（2026-11-05 全体監査）。作業中の木（ほかの会話の書きかけが混ざり得る）から、配信中の .next-prod を消して組み、
# npm ci もしなかったため。本番の組み直しは app/scripts/release-prod.sh（main のきれいな写しから組み、控えの写しで確かめてから
# 差し替え、だめなら前に戻す）。自動は app/scripts/sync-deploy.sh（30分ごと）。
print -r -- "deploy-local.sh はもう使いません。本番の組み直しは app/scripts/release-prod.sh を使ってください（--dry-run で、する事を先に見られます）" >&2
exit 2
