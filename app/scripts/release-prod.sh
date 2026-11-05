#!/bin/zsh
# 本番（127.0.0.1:3210）を、GitHub の main のきれいな写しから組み直して入れ替える（2026-11-05 監査 #3）。
# 今までの deploy-local.sh は、作業中の木（ほかの会話の書きかけが混ざり得る）から、配信中の .next-prod を消して組み、
# npm ci もしなかった（部品が package-lock.json と違うまま）。これは別の置き場で組み、確かめてから差し替え、だめなら戻す。
#
# 流れ:
#   ① わが家の記録の控え（sqlite3 の .backup。WAL ごと。控えは BOSHI_RELEASES/backups。Mac の外へは出さない）
#   ② main を BOSHI_RELEASES/<日時>-<コミット> に書き出し（git archive）、.env.local を結び、npm ci と組み立て（.next-prod）
#   ③ 3211番で立てて確かめる（わが家の置き場を BOSHI_MODE=home で開く。頼むのは /unlock と /emergency だけ）
#   ④ 録音中・文字起こし中・整理中の健診が無い事を確かめる（あれば止める。--force で越える）
#   ⑤ BOSHI_RELEASES/current を新しい版に差し替えて、本番を立て直す
#      （初めての時だけ、launchd の設定を current の serve-prod.sh に向け直す。前の向き先は previous に残す）
#   ⑥ 3210番で確かめる。だめなら前の版（初めての時は今までの立て方）に戻す
#
# 使い方:  app/scripts/release-prod.sh [--dry-run] [--ref <コミット>] [--force]
#          app/scripts/release-prod.sh --rollback        （前の版・前の立て方に戻す）
#   --dry-run: 変える事は何もせず、する事を出すだけ（③は出すだけ、④の数える所は読むだけで本当に回す）
# 置き場（変える時だけ環境変数で）:
#   BOSHI_RELEASES（既定 ~/boshi-releases）・BOSHI_HOME_DATA（既定 ~/boshi-techo/app/data）・BOSHI_ENV_FILE（既定 ~/boshi-techo/app/.env.local）
# 健診の最中には流さない。流すのは統括の会話（CLAUDE.md「本番の組み立ては統括だけ」）。
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"

REPO=$(git -C "${0:A:h}" rev-parse --show-toplevel)
RELEASES=${BOSHI_RELEASES:-$HOME/boshi-releases}
HOME_DATA=${BOSHI_HOME_DATA:-$HOME/boshi-techo/app/data}
ENV_FILE=${BOSHI_ENV_FILE:-$HOME/boshi-techo/app/.env.local}
LABEL=com.boshi.app
PLIST=$HOME/Library/LaunchAgents/$LABEL.plist
DOMAIN=gui/$(id -u)
SERVE=$RELEASES/current/app/scripts/serve-prod.sh
LOG=$HOME/Library/Logs/boshi-app.log

DRY="" FORCE="" REF=origin/main MODE=release
while (( $# )); do
  case $1 in
    --dry-run) DRY=1 ;;
    --force) FORCE=1 ;;
    --ref) shift; REF=${1:?--ref の後にコミットを} ;;
    --rollback) MODE=rollback ;;
    *) print -r -- "分からない指定: $1" >&2; exit 2 ;;
  esac
  shift
done

say() { print -r -- "[本番の組み直し] $*" }
die() { say "止めました: $*"; exit 1 }
# 変える命令は run で（--dry-run の時は出すだけ）
run() { if [[ -n $DRY ]]; then print -r -- "  [空回し] $*"; else "$@"; fi }
in_app() { if [[ -n $DRY ]]; then print -r -- "  [空回し] (cd $REL/app && $*)"; else (cd "$REL/app" && "$@"); fi }
code_of() { curl -s -o /dev/null -m 5 -w '%{http_code}' "$1" 2>/dev/null || true }
# /unlock（合言葉の門の外・DB を読まない）が 200 で返るまで待つ（最大90秒）
wait_up() {
  local i
  for i in {1..45}; do [[ $(code_of "http://127.0.0.1:$1/unlock") == 200 ]] && return 0; sleep 2; done
  return 1
}
plist_program() { /usr/libexec/PlistBuddy -c 'Print :ProgramArguments:1' "$PLIST" 2>/dev/null || true }
point_plist() { # $1 = launchd が立てる台本
  run /usr/libexec/PlistBuddy -c "Set :ProgramArguments:1 $1" "$PLIST"
  run launchctl bootout "$DOMAIN/$LABEL" || true
  run launchctl bootstrap "$DOMAIN" "$PLIST"
}
# 前の版・前の立て方へ戻す（previous の中身: 版の置き場か「plist:<台本>」）
go_back() {
  local prev
  prev=$(cat "$RELEASES/previous" 2>/dev/null || true)
  [[ -n $prev ]] || die "戻す先がありません（$RELEASES/previous が無い）"
  if [[ $prev == plist:* ]]; then
    point_plist "${prev#plist:}"
  else
    [[ -d $prev ]] || die "戻す先の版がありません: $prev"
    run ln -sfn "$prev" "$RELEASES/current"
    run launchctl kickstart -k "$DOMAIN/$LABEL"
  fi
  say "前に戻しました: $prev"
}

if [[ $MODE == rollback ]]; then
  go_back
  [[ -n $DRY ]] || wait_up 3210 || die "戻しても 3210番が返りません。ログ: $LOG"
  exit 0
fi

# ⓪ 前提（どれかが欠けたら、何も変えずに止める）
[[ -f $HOME_DATA/boshi.db ]] || die "わが家の置き場に boshi.db がありません: $HOME_DATA（BOSHI_HOME_DATA を確かめる）"
[[ -f $ENV_FILE ]] || die ".env.local がありません: $ENV_FILE（BOSHI_ENV_FILE を確かめる）"
command -v sqlite3 >/dev/null || die "sqlite3 がありません"
[[ -f $PLIST ]] || die "launchd の設定がありません: $PLIST"
run git -C "$REPO" fetch -q origin main
sha=$(git -C "$REPO" rev-parse --short=10 "$REF")
stamp=$(date +%Y%m%d-%H%M)
REL=$RELEASES/$stamp-$sha
say "組み直す版: $sha（$(git -C "$REPO" log -1 --format=%s "$sha" | cut -c1-60)）→ $REL"

# ① 控え
run mkdir -p "$RELEASES/backups"
BK=$RELEASES/backups/boshi-$stamp.db
run sqlite3 "$HOME_DATA/boshi.db" ".backup '$BK'"
say "① 控え: $BK"

# ② 書き出しと組み立て（本番はまだそのまま動いている）
run mkdir -p "$REL"
if [[ -n $DRY ]]; then print -r -- "  [空回し] git -C $REPO archive $sha | tar -x -C $REL"; else git -C "$REPO" archive "$sha" | tar -x -C "$REL"; fi
run ln -s "$ENV_FILE" "$REL/app/.env.local"
in_app npm ci --no-audit --no-fund
# 組み立ては3回までやり直す。書体（next/font/google）を Google から取る所が時々落ちる（2026-11-05、Fly で5回中2回・CI で1回。やり直すと通る）
for i in 1 2 3; do
  if in_app env NEXT_DIST_DIR=.next-prod NODE_ENV=production npx next build; then break; fi
  (( i < 3 )) || die "組み立てが3回とも落ちました（本番はそのまま）"
  say "組み立てが落ちたので、20秒後にやり直します（${i}回目）"
  sleep 20
done
say "② 組み立て: $REL/app/.next-prod"

# ③ 3211番で確かめる（だめなら本番はそのまま）
if [[ -n $DRY ]]; then
  print -r -- "  [空回し] 3211番で立てて /unlock が 200・/emergency が 200 か 307 かを見る"
else
  (cd "$REL/app" && BOSHI_MODE=home BOSHI_DATA_DIR="$HOME_DATA" NEXT_DIST_DIR=.next-prod NODE_ENV=production \
    exec node node_modules/next/dist/bin/next start -p 3211 -H 127.0.0.1 > "$REL/check-3211.log" 2>&1) &
  pid=$!
  up=""; wait_up 3211 && up=1
  em=$(code_of "http://127.0.0.1:3211/emergency")
  kill "$pid" 2>/dev/null || true
  pkill -f "next start -p 3211" 2>/dev/null || true
  [[ -n $up ]] || die "3211番で立ちませんでした（本番はそのまま）。ログ: $REL/check-3211.log"
  [[ $em == 200 || $em == 307 ]] || die "3211番の /emergency が $em でした（本番はそのまま）。ログ: $REL/check-3211.log"
fi
say "③ 3211番で確かめました"

# ④ 健診が録音中・文字起こし中・整理中でないか（読むだけ。この1日の間に動いた健診）
busy=$(sqlite3 -readonly "$HOME_DATA/boshi.db" \
  "SELECT count(*) FROM docs WHERE type = 'visit' AND json_extract(data, '\$.status') IN ('recording','transcribing','organizing') AND substr(updated_at, 1, 10) >= date('now', '-1 day')")
if (( busy > 0 )); then
  [[ -n $FORCE ]] || die "録音中・文字起こし中・整理中の健診が ${busy} 件あります。終わってから流す（--force で越える）"
  say "④ 動いている健診が ${busy} 件ありますが、--force で進めます"
else
  say "④ 動いている健診はありません"
fi

# ⑤ 差し替え
was=$(plist_program)
if [[ $was != "$SERVE" ]]; then
  # 初めて: launchd の設定を current の serve-prod.sh に向け直す。前の立て方を previous に残す
  run ln -sfn "$REL" "$RELEASES/current"
  if [[ -n $DRY ]]; then print -r -- "  [空回し] previous ← plist:$was"; else print -r -- "plist:$was" > "$RELEASES/previous"; fi
  point_plist "$SERVE"
else
  prev=$(readlink "$RELEASES/current" || true)
  if [[ -n $DRY ]]; then print -r -- "  [空回し] previous ← $prev"; else print -r -- "$prev" > "$RELEASES/previous"; fi
  run ln -sfn "$REL" "$RELEASES/current"
  run launchctl kickstart -k "$DOMAIN/$LABEL"
fi
say "⑤ 差し替えました（前: $was）"

# ⑥ 本番を確かめる。だめなら戻す
if [[ -z $DRY ]] && ! wait_up 3210; then
  say "3210番が返りません。前に戻します"
  go_back
  die "入れ替えに失敗したので戻しました。ログ: $LOG と $REL/check-3211.log"
fi
say "⑥ 入れ替えました: http://127.0.0.1:3210 （$sha）。戻す時は app/scripts/release-prod.sh --rollback"
old=( "$RELEASES"/2*-*(N/) )
(( ${#old} > 3 )) && say "古い版が ${#old} 個あります（1つ 1GB ほど）。current と previous 以外は、消してよい"
exit 0
