#!/bin/zsh
# 家族の iPhone が使う本番のサーバ（Tailscale Serve の https → 127.0.0.1:3210）。
# 開発中にコードを直しても、健診の最中に画面が読み直されないよう、組み立て済みの物を動かす。
# 動いている間は Mac を眠らせない（caffeinate -i）。更新は scripts/deploy-local.sh。
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"
cd "${0:A:h}/.." || exit 1
export NEXT_DIST_DIR=.next-prod NODE_ENV=production
exec caffeinate -i npx next start -p 3210 -H 127.0.0.1
