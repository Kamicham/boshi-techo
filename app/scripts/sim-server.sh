#!/bin/bash
# シミュレーションのサーバ（3100番）。作った30家族と1000組だけを読み、DB は app/sim-data/（git の外）。
# わが家（app/data/）と本番（3210番・.next-prod）には触らない。組み立てる先は .next-sim。
#
#   scripts/sim-server.sh              組み立てて（next build）、組み立てた版で動かす（next start）。既定
#   scripts/sim-server.sh --no-build   前に組み立てた .next-sim をそのまま動かす
#   scripts/sim-server.sh --dev        開発サーバ（next dev）。直しがすぐ反映されるが、なりきり7家族の負荷で
#                                      clientReferenceManifest の 500 を返す（2026-11-03 に254回）ので、なりきりには使わない
#   scripts/sim-server.sh --replace …  3100番で動いている next を止めてから始める（ほかの命令と一緒に使える）
#
# 組み立てた版は直しが反映されないので、画面を直したら組み立て直す（この台本をもう一度、--replace を付けて）。
cd "$(dirname "$0")/.." || exit 1
export BOSHI_SIM=1
export BOSHI_DATA_DIR="$PWD/sim-data"
export NEXT_DIST_DIR=.next-sim
# 1回のシミュレーションで Claude の API に使ってよい上限（ドル）。超えたら止まる
export BOSHI_SIM_BUDGET_USD="${BOSHI_SIM_BUDGET_USD:-5}"
PORT=3100

mode=build
replace=0
for a in "$@"; do
  case "$a" in
    --dev) mode=dev ;;
    --no-build) mode=start ;;
    --replace) replace=1 ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) echo "知らない指定: $a（--dev / --no-build / --replace）" >&2; exit 2 ;;
  esac
done

# 3100番がもう使われていたら、組み立て先（.next-sim）を同じサーバが使っているかもしれないので、勝手に壊さない
pids=$(lsof -nP -tiTCP:$PORT -sTCP:LISTEN 2>/dev/null)
if [ -n "$pids" ]; then
  if [ "$replace" != 1 ]; then
    echo "3100番はもう使われています（pid: $(echo $pids)）。止めてから始めるなら --replace を付けてください" >&2
    exit 1
  fi
  for p in $pids; do
    if ps -o command= -p "$p" | grep -q next; then
      echo "3100番の next（pid $p）を止めます"
      kill "$p"
    else
      echo "3100番を使っているのが next ではありません（pid $p: $(ps -o command= -p "$p")）。手で確かめてください" >&2
      exit 1
    fi
  done
  for _ in $(seq 1 20); do
    lsof -nP -tiTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1 || break
    sleep 0.5
  done
  if lsof -nP -tiTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
    echo "3100番が空きません" >&2
    exit 1
  fi
fi

if [ "$mode" = dev ]; then
  exec npx next dev -p $PORT -H 127.0.0.1
fi

if [ "$mode" = build ]; then
  # tsconfig は .next*/types も読むので、前の組み立ての古い型で落ちないよう先に消す（前例あり）
  rm -rf .next-sim/types
  echo "組み立てています（.next-sim。本番の .next-prod とは別）…"
  if ! NODE_ENV=production npx next build; then
    echo "組み立てに失敗しました。直してからもう一度" >&2
    exit 1
  fi
fi

if [ ! -f .next-sim/BUILD_ID ]; then
  echo ".next-sim に組み立てた版がありません。--no-build を外して組み立ててください" >&2
  exit 1
fi
export NODE_ENV=production
exec npx next start -p $PORT -H 127.0.0.1
