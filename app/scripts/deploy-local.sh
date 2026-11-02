#!/bin/zsh
# 本番を組み立て直して入れ替える（健診の最中には流さない）。
set -e
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"
cd "${0:A:h}/.."
NEXT_DIST_DIR=.next-prod npx next build
launchctl kickstart -k "gui/$(id -u)/com.boshi.app"
echo "入れ替えました: http://127.0.0.1:3210"
