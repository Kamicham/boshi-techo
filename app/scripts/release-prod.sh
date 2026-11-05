#!/bin/zsh
# 本番（127.0.0.1:3210）を、GitHub の main のきれいな写しから組み直して入れ替える（2026-11-05 監査 #3）。
# 今までの deploy-local.sh は、作業中の木（ほかの会話の書きかけが混ざり得る）から、配信中の .next-prod を消して組み、
# npm ci もしなかった（部品が package-lock.json と違うまま）。これは別の置き場で組み、確かめてから差し替え、だめなら戻す。
# 手で流しても、sync-deploy.sh（30分ごとの自動の出し直し）から流れても、同じ錠を取る（2026-11-05 全体監査の見直し）。
#
# 流れ:
#   ⓪ 前提と錠（BOSHI_RELEASES/release.lock。持ち主の回が終わっていれば外す）。動いている健診か、この10分の書き込み
#      （家族が使っている最中）があれば、組み立てる前に止める（終わりの値 3）
#   ① わが家の記録の控え（sqlite3 の .backup。WAL ごと。控えは BOSHI_RELEASES/backups。Mac の外へは出さない）
#   ② main を BOSHI_RELEASES/<日時>-<コミット> に書き出し（git archive）、.env.local を結び、npm ci と組み立て（.next-prod・nice）
#   ③ 控えの写し（<版>/check-data）を、新しい版の better-sqlite3 で開き（quick_check）、その写しの置き場で 3211番を立てて確かめる
#      （本物の置き場は開かない。頼むのは /unlock と /emergency。写しは確かめた後に消す）
#   ④ 録音中・文字起こし中・整理中の健診と、この10分の書き込みが無い事を確かめる
#      （あれば1分ごとに15分まで待つ。それでも続けば止める＝終わりの値 3。--force で越える）
#   ⑤ BOSHI_RELEASES/current を新しい版に差し替えて、本番を立て直す
#      （初めての時だけ、launchd の設定を current の serve-prod.sh に向け直す。前の向き先は previous に残す）
#   ⑥ 3210番で確かめる。だめなら前の版（初めての時は今までの立て方）に戻し、自動の組み直しを止める（hold-prod・終わりの値 4）
#
# 使い方:  app/scripts/release-prod.sh [--dry-run] [--check-only] [--ref <コミット>] [--force]
#          app/scripts/release-prod.sh --rollback        （前の版・前の立て方に戻し、自動の組み直しを止める＝hold-prod）
#   --dry-run:    変える事は何もせず、する事を出すだけ（③は出すだけ。⓪と④の見る所は読むだけで本当に回す）
#   --check-only: ①〜③まで（組み立てて確かめるだけで、入れ替えない）
#   --force:      ⓪と④の「動いている健診・この10分の書き込み」を見ずに進める
# 終わりの値: 0 入れ替えた（--check-only は確かめた） ／ 1 止めた（本番はそのまま） ／ 2 指定の誤り
#             3 今は入れ替えない（ほかの組み直し・動いている健診・使っている最中。あとでまた） ／ 4 入れ替えた後に応えず、前に戻した
# 置き場（変える時だけ環境変数で）:
#   BOSHI_RELEASES（既定 ~/boshi-releases）・BOSHI_HOME_DATA（既定 ~/boshi-techo/app/data）・BOSHI_ENV_FILE（既定 ~/boshi-techo/app/.env.local）
# 健診の最中には流さない。手で流すのは統括の会話。自動は sync-deploy.sh（hold-prod がある間は流さない）。
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
LOCK=$RELEASES/release.lock
QUIET_MIN=10   # この分のうちに記録の置き場へ書き込みがあれば、家族が使っている最中と見る
WAIT_MIN=15    # ④で静かになるのを待つ長さ（分）

DRY="" FORCE="" CHECK_ONLY="" REF=origin/main MODE=release
LOCKED="" CHECK=""
while (( $# )); do
  case $1 in
    --dry-run) DRY=1 ;;
    --force) FORCE=1 ;;
    --check-only) CHECK_ONLY=1 ;;
    --ref) shift; REF=${1:?--ref の後にコミットを} ;;
    --rollback) MODE=rollback ;;
    *) print -r -- "分からない指定: $1" >&2; exit 2 ;;
  esac
  shift
done

say() { print -r -- "[本番の組み直し] $*" }
die() { say "止めました: $*"; exit 1 }
later() { say "今は入れ替えません: $*"; exit 3 }
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
point_plist() { # $1 = launchd が立てる台本。入れ直せなければ 1（bootout の直後は bootstrap が落ちる事があるので、2秒おきに5回まで）
  local i
  run /usr/libexec/PlistBuddy -c "Set :ProgramArguments:1 $1" "$PLIST" || return 1
  run launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  for i in 1 2 3 4 5; do
    run launchctl bootstrap "$DOMAIN" "$PLIST" 2>/dev/null && return 0
    sleep 2
  done
  say "launchd に入れ直せませんでした（$LABEL）"
  return 1
}
# 前の版・前の立て方へ戻す（previous の中身: 版の置き場か「plist:<台本>」）。戻せなければ 1
go_back() {
  local prev
  prev=$(cat "$RELEASES/previous" 2>/dev/null || true)
  if [[ -z $prev ]]; then say "戻す先がありません（$RELEASES/previous が無い）"; return 1; fi
  if [[ $prev == plist:* ]]; then
    point_plist "${prev#plist:}" || return 1
  else
    if [[ ! -d $prev ]]; then say "戻す先の版がありません: $prev"; return 1; fi
    run ln -sfn "$prev" "$RELEASES/current" || return 1
    run launchctl kickstart -k "$DOMAIN/$LABEL" || return 1
  fi
  say "前に戻しました: $prev"
}
# 自動の組み直し（sync-deploy.sh）を止める。hold-prod がある間、自動では本番に出さない
stop_auto() {
  if [[ -n $DRY ]]; then print -r -- "  [空回し] hold-prod を置く（$*）"; return 0; fi
  print -r -- "$(date '+%m/%d %H:%M') $*。確かめたら、このファイルを消すと自動の組み直しが戻ります" > "$RELEASES/hold-prod"
  say "自動の組み直しを止めました（$RELEASES/hold-prod）"
}

# 錠（手でも自動でも同じ錠。持ち主の回が終わっている・6時間より古い錠は外す）
take_lock() {
  local other
  mkdir -p "$RELEASES"
  if ! mkdir "$LOCK" 2>/dev/null; then
    other=$(cat "$LOCK/pid" 2>/dev/null || true)
    if [[ -n $other ]] && kill -0 "$other" 2>/dev/null && [[ -z $(find "$LOCK" -maxdepth 0 -mmin +360 2>/dev/null || true) ]]; then
      later "ほかの組み直し（pid $other）が走っています"
    fi
    if [[ -z $other && -n $(find "$LOCK" -maxdepth 0 -mmin -1 2>/dev/null || true) ]]; then
      later "ほかの組み直しが今始まったところです"
    fi
    rm -f -- "$LOCK/pid"
    rmdir -- "$LOCK" 2>/dev/null || true
    mkdir "$LOCK" 2>/dev/null || later "錠を取れませんでした: $LOCK"
    say "止まった回の錠を外しました（pid ${other:-?}）"
  fi
  LOCKED=1
  print -r -- $$ > "$LOCK/pid"
}
# 終わる時に、控えの写しと錠を片付ける（写しは本物の記録の写しなので、確かめた後に残さない）
cleanup() {
  if [[ -n $CHECK ]]; then
    rm -f -- "$CHECK/boshi.db" "$CHECK/boshi.db-wal" "$CHECK/boshi.db-shm"
    rmdir -- "$CHECK" 2>/dev/null || true
  fi
  if [[ -n $LOCKED ]]; then
    rm -f -- "$LOCK/pid"
    rmdir -- "$LOCK" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# 録音中・文字起こし中・整理中の健診の数（読むだけ。この1日の間に動いた健診）
visits_busy() {
  sqlite3 -readonly "$HOME_DATA/boshi.db" \
    "SELECT count(*) FROM docs WHERE type = 'visit' AND json_extract(data, '\$.status') IN ('recording','transcribing','organizing') AND substr(updated_at, 1, 10) >= date('now', '-1 day')"
}
# この QUIET_MIN 分のうちに書かれた記録のファイルがあるか（名前も中身も読まない。数えるだけ）。
# boshi.db は控え（①）の閉じ際の書き戻しでも変わり、-shm は読むだけでも変わるので見ない（家族の書き込みは -wal に出る）
written_lately() {
  [[ -n $(find "$HOME_DATA" -type f -mmin -$QUIET_MIN ! -name boshi.db ! -name '*-shm' -print -quit 2>/dev/null || true) ]]
}
# 今入れ替えてよいか。だめならその訳を出して 1
quiet_now() {
  local n
  n=$(visits_busy) || { print -r -- "健診の状態を読めませんでした（sqlite3）"; return 1 }
  if (( n > 0 )); then print -r -- "録音中・文字起こし中・整理中の健診が ${n} 件あります"; return 1; fi
  if written_lately; then print -r -- "この${QUIET_MIN}分のうちに記録が書かれています（家族が使っている最中）"; return 1; fi
  return 0
}

if [[ $MODE == rollback ]]; then
  [[ -n $DRY ]] || take_lock
  cur=$(readlink "$RELEASES/current" 2>/dev/null || true)
  go_back || die "戻せませんでした"
  if [[ -z $DRY ]] && ! wait_up 3210; then
    stop_auto "手で --rollback しましたが、3210番が返りません"
    die "戻しても 3210番が返りません。ログ: $LOG"
  fi
  stop_auto "手で --rollback しました（${cur:t} から戻した）"
  exit 0
fi

# ⓪ 前提（どれかが欠けたら、何も変えずに止める）
[[ -f $HOME_DATA/boshi.db ]] || die "わが家の置き場に boshi.db がありません: $HOME_DATA（BOSHI_HOME_DATA を確かめる）"
[[ -f $ENV_FILE ]] || die ".env.local がありません: $ENV_FILE（BOSHI_ENV_FILE を確かめる）"
command -v sqlite3 >/dev/null || die "sqlite3 がありません"
[[ -f $PLIST ]] || die "launchd の設定がありません: $PLIST"
[[ -n $DRY ]] || take_lock
if [[ -z $FORCE && -z $CHECK_ONLY ]] && ! why=$(quiet_now); then
  if [[ -n $DRY ]]; then say "⓪（空回し）今なら止まります: $why"; else later "$why（組み立てる前に止めました）"; fi
fi
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

# ② 書き出しと組み立て（本番はまだそのまま動いている。家族の画面を遅くしないよう、nice で後回しに）
run mkdir -p "$REL"
if [[ -n $DRY ]]; then print -r -- "  [空回し] git -C $REPO archive $sha | tar -x -C $REL"; else git -C "$REPO" archive "$sha" | tar -x -C "$REL"; fi
run ln -s "$ENV_FILE" "$REL/app/.env.local"
in_app nice -n 10 npm ci --no-audit --no-fund
# 組み立ては3回までやり直す。書体（next/font/google）を Google から取る所が時々落ちる（2026-11-05、Fly で5回中2回・CI で1回。やり直すと通る）
for i in 1 2 3; do
  if in_app env NEXT_DIST_DIR=.next-prod NODE_ENV=production nice -n 10 npx next build; then break; fi
  (( i < 3 )) || die "組み立てが3回とも落ちました（本番はそのまま）"
  say "組み立てが落ちたので、20秒後にやり直します（${i}回目）"
  sleep 20
done
say "② 組み立て: $REL/app/.next-prod"

# ③ 控えの写しで確かめる（本物の置き場は開かない。だめなら本番はそのまま）
if [[ -n $DRY ]]; then
  print -r -- "  [空回し] 控えを $REL/check-data/boshi.db に写し、新しい版の better-sqlite3 で開いて quick_check。その置き場で 3211番を立てて /unlock が 200・/emergency が 200 か 307 かを見る（写しは後で消す）"
else
  CHECK=$REL/check-data
  mkdir -p "$CHECK"
  cp "$BK" "$CHECK/boshi.db"
  (cd "$REL/app" && node -e '
const Database = require("better-sqlite3");
const db = new Database(process.argv[1], { fileMustExist: true });
const q = db.pragma("quick_check", { simple: true });
if (q !== "ok") { console.error("quick_check: " + q); process.exit(1); }
db.prepare("SELECT count(*) AS n FROM docs").get();
db.close();
console.log("ok");' "$CHECK/boshi.db") > "$REL/check-db.log" 2>&1 \
    || die "新しい版の better-sqlite3 で、控えの写しを開けませんでした（本番はそのまま）。ログ: $REL/check-db.log"
  (cd "$REL/app" && BOSHI_MODE=home BOSHI_DATA_DIR="$CHECK" NEXT_DIST_DIR=.next-prod NODE_ENV=production \
    exec node node_modules/next/dist/bin/next start -p 3211 -H 127.0.0.1 > "$REL/check-3211.log" 2>&1) &
  pid=$!
  up=""; wait_up 3211 && up=1
  em=$(code_of "http://127.0.0.1:3211/emergency")
  kill "$pid" 2>/dev/null || true
  pkill -f "next start -p 3211" 2>/dev/null || true
  sleep 1
  rm -f -- "$CHECK/boshi.db" "$CHECK/boshi.db-wal" "$CHECK/boshi.db-shm"
  rmdir -- "$CHECK" 2>/dev/null || say "（写しの置き場に、ほかのファイルが残りました: $CHECK。記録の写しそのものは消しました）"
  CHECK=""
  [[ -n $up ]] || die "3211番で立ちませんでした（本番はそのまま）。ログ: $REL/check-3211.log"
  [[ $em == 200 || $em == 307 ]] || die "3211番の /emergency が $em でした（本番はそのまま）。ログ: $REL/check-3211.log"
fi
say "③ 控えの写しと 3211番で確かめました"
if [[ -n $CHECK_ONLY ]]; then say "--check-only なので、ここまでにします（本番はそのまま。組み立てた版: $REL）"; exit 0; fi

# ④ 健診が録音中・文字起こし中・整理中でないか、家族が使っている最中でないか（読むだけ）
if [[ -n $FORCE ]]; then
  say "④ --force なので、健診と書き込みを見ずに進めます"
else
  waited=0 still=""
  while ! why=$(quiet_now); do
    if [[ -n $DRY ]]; then say "④（空回し）$why。本当の時は1分ごとに${WAIT_MIN}分まで待ちます"; still=1; break; fi
    (( waited < WAIT_MIN )) || later "$why。${WAIT_MIN}分待っても続いているので、次の回にします（組み立てた版 $REL は残ります）"
    if (( waited == 0 )); then say "④ $why。1分ごとに${WAIT_MIN}分まで待ちます"; fi
    sleep 60
    waited=$(( waited + 1 ))
  done
  [[ -n $still ]] || say "④ 動いている健診も、この${QUIET_MIN}分の書き込みもありません"
fi

# ⑤ 差し替え（ここから本番が数秒止まる）
was=$(plist_program)
swapped=1
if [[ $was != "$SERVE" ]]; then
  # 初めて: launchd の設定を current の serve-prod.sh に向け直す。前の立て方を previous に残す
  run ln -sfn "$REL" "$RELEASES/current"
  if [[ -n $DRY ]]; then print -r -- "  [空回し] previous ← plist:$was"; else print -r -- "plist:$was" > "$RELEASES/previous"; fi
  point_plist "$SERVE" || swapped=""
else
  prev=$(readlink "$RELEASES/current" || true)
  if [[ -n $DRY ]]; then print -r -- "  [空回し] previous ← $prev"; else print -r -- "$prev" > "$RELEASES/previous"; fi
  run ln -sfn "$REL" "$RELEASES/current"
  run launchctl kickstart -k "$DOMAIN/$LABEL" || swapped=""
fi
say "⑤ 差し替えました（前: $was）"

# ⑥ 本番を確かめる。だめなら戻して、自動の組み直しを止める
if [[ -z $DRY ]] && { [[ -z $swapped ]] || ! wait_up 3210 }; then
  say "3210番が返りません。前に戻します"
  if go_back && wait_up 3210; then
    stop_auto "$sha の入れ替えで 3210番が返らず、前に戻しました"
    say "止めました: 入れ替えに失敗したので戻しました。ログ: $LOG と $REL/check-3211.log"
  else
    stop_auto "$sha の入れ替えで 3210番が返らず、戻しても返りません"
    say "止めました: 戻しても 3210番が返りません。すぐ見る事。ログ: $LOG"
  fi
  exit 4
fi
say "⑥ 入れ替えました: http://127.0.0.1:3210 （$sha）。戻す時は app/scripts/release-prod.sh --rollback"
old=( "$RELEASES"/2*-*(N/) )
(( ${#old} > 3 )) && say "古い版が ${#old} 個あります（1つ 1GB ほど）。current と previous 以外は、消してよい"
exit 0
