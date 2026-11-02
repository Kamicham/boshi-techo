#!/bin/bash
# シミュレーションのサーバ（3100番）。作った30家族だけを読み、DB は app/sim-data/（git の外）。
# わが家（app/data/）と本番（3210番）には触らない。開発中の直しはそのまま反映される（next dev）。
cd "$(dirname "$0")/.." || exit 1
export BOSHI_SIM=1
export BOSHI_DATA_DIR="$PWD/sim-data"
export NEXT_DIST_DIR=.next-sim
exec npx next dev -p 3100 -H 127.0.0.1
