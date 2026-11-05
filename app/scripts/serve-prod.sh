#!/bin/zsh
# 家族の iPhone が使う本番のサーバ（Tailscale Serve の https → 127.0.0.1:3210）。
# 開発中にコードを直しても、健診の最中に画面が読み直されないよう、組み立て済みの物を動かす。
# 動いている間は Mac を眠らせない（caffeinate -i）。更新は scripts/release-prod.sh（main のきれいな写しから組み立てて差し替える）。
# 置き場は BOSHI_MODE=home と絶対パスで指す（どこから立てても、わが家の記録の置き場を開く。
# 道が違う・ASR_URL が無い時は、lib/mode.ts の確かめでサーバが立たずに止まる。2026-11-05 監査）。
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"
cd "${0:A:h}/.." || exit 1
export BOSHI_MODE=home BOSHI_DATA_DIR="${BOSHI_HOME_DATA:-$HOME/boshi-techo/app/data}"
export NEXT_DIST_DIR=.next-prod NODE_ENV=production
exec caffeinate -i npx next start -p 3210 -H 127.0.0.1
