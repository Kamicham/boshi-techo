#!/bin/zsh
# main に入って検査（CI）が通った直しを、体験版（Fly.io）と本番（Mac の 3210）の両方へ自動で出す。
# 2026-11-05 作り手「直しは随時、デモ用と本番の両方に反映して。体験版で変わっていないと、次の声が進まない」。
# launchd（com.boshi.sync）が30分ごとに流す。新しい版が無ければ何もしない。
#
# 流れ:
#   ⓪ 出さない時: 置き場（~/boshi-releases）に hold（両方）・hold-fly・hold-prod のファイルがある時と、
#      提出の前と審査の間（11/8 18:00〜11/10 14:00。提出前の2時間は、人が確かめた版のまま止める）。出す直前にもう一度見る
#   ① GitHub の検査（check.yml）が通った main の一番新しいコミットを選ぶ（走っている・落ちたコミットは飛ばす）
#   ② 体験版: 出ている版は、Fly の像の札（--image-label <コミット>）から読む（手で出した版も含め、前にしか進まない）。
#      出す専用の写し（~/boshi-deploy・detached）をそのコミットに合わせ、app に git の外のファイルが無い事を確かめて fly deploy。
#      /api/health で確かめ、応えなければ前の像に戻す
#   ③ 本番: その写しの release-prod.sh --auto --ref <コミット>（同じ錠 → 控え → 組み立て → 控えの写しを 3211 で確かめ →
#      動いている健診・この10分の書き込みがあれば待つ（止める印も、そのつど見る）→ 差し替え →
#      だめなら戻して hold-prod と skip-prod を置く。戻しても応えなければ終わりの値 5 で「すぐ見る」を知らせる）。
#      初めての組み直し（launchd の向き先を変える）は統括が手で流す。それまで（~/boshi-releases/current が無い間）は自動では出さない
#   本番が応えているか（3210番の /unlock が 200 か）を毎回見て、応えなければ毎回知らせる（組み直しの最中は見ない）
#   落ちた版: 出して壊れた版（戻した版）は、次のコミットまで出さない（sync/skip-fly・skip-prod）。
#      本番・体験版を変えずに落ちた版は、次の回にもう1回だけ試し、2回落ちたら次のコミットまで出さない（sync/fail-* → skip-*）。
#      skip-* を消すと、また試す
# 使い方:
#   sync-deploy.sh                  今すぐ1回（launchd と同じ）
#   sync-deploy.sh --only fly|prod  片方だけ
#   sync-deploy.sh --dry-run        出す版を選ぶまで（Fly の像と GitHub は読む。変える事はしない）
#   sync-deploy.sh --only fly --adopt
#                                   体験版の像の札がコミットでない時（--image-label なしで手で出した後）に、それでも出す
#   sync-deploy.sh --install        この台本を ~/Library/Application Support/boshi-sync に写し、launchd に30分ごとで入れる（直した後の入れ直しも同じ）
#   止める: touch ~/boshi-releases/hold（片方だけは hold-fly・hold-prod）。戻す: その hold のファイルを消す
# 記録: ~/Library/Logs/boshi-sync.log（1回ごとの fly と本番の詳しい記録は ~/boshi-releases/sync/logs。気を付ける事は sync/attention.txt）

typeset -g SELF=${0:A}

say() { print -r -- "$(date '+%m/%d %H:%M') [自動で出す] $*" }

# Mac の画面に知らせ、気を付ける事の記録に1行残す
notify() {
  [[ -n ${dry:-} ]] && { say "（空回しなので知らせない: $1）"; return 0 }
  osascript -e "display notification \"$1\" with title \"母子手帳の自動の出し直し\"" >/dev/null 2>&1 || true
  print -r -- "$(date '+%m/%d %H:%M') $1" >> "$STATE/attention.txt"
}
# 同じ鍵の知らせは1回だけ（30分ごとに同じ事を知らせない）
notify_once() { # $1 = 鍵 $2 = 文
  [[ -n ${dry:-} ]] && { notify "$2"; return 0 }
  grep -qxF -- "$1" "$STATE/noted" 2>/dev/null && return 0
  print -r -- "$1" >> "$STATE/noted"
  notify "$2"
}

held() { # $1 = fly | prod
  [[ -e $RELEASES/hold || -e $RELEASES/hold-$1 ]] && return 0
  local now=$(TZ=Asia/Tokyo date +%Y%m%d%H%M)
  (( now >= 202611081800 && now < 202611101400 )) && return 0
  return 1
}

# 候補を出すか: 0 = 出す ／ 1 = 出さない（同じか古い） ／ 2 = 出さない（出ている版が main の外・手元で引けない）
ahead() { # $1 = 出ている版（空なら何でも出す） $2 = 候補
  [[ -z $1 ]] && return 0
  [[ $2 == ${1}* ]] && return 1
  git -C "$DEPLOY" cat-file -e "$1^{commit}" 2>/dev/null || return 2
  git -C "$DEPLOY" merge-base --is-ancestor "$1" "$2" 2>/dev/null && return 0
  git -C "$DEPLOY" merge-base --is-ancestor "$2" "$1" 2>/dev/null && return 1
  return 2
}

# 落ちた版の記録
skipped() { [[ -n $2 && $(cat "$STATE/skip-$1" 2>/dev/null) == "$2" ]] } # $1 = fly|prod $2 = 候補
failed_once() { # 変えずに落ちた。1回目なら 0（次の回にもう1回）、2回目なら skip に移して 1
  if [[ $(cat "$STATE/fail-$1" 2>/dev/null) == "$2" ]]; then
    print -r -- "$2" > "$STATE/skip-$1"
    rm -f -- "$STATE/fail-$1"
    return 1
  fi
  print -r -- "$2" > "$STATE/fail-$1"
  return 0
}

healthy() {
  local i
  for i in {1..20}; do
    [[ $(curl -s -m 5 "$URL/api/health" 2>/dev/null) == *'"ok":true'* ]] && return 0
    sleep 6
  done
  return 1
}

# 体験版に出ている像: 「札<TAB>戻す時の参照」（札が無い時は空の札と digest の参照）。読めない時は何も出さない
fly_image() {
  fly image show -a "$APP" --json 2>/dev/null | python3 -c '
import json, sys
d = json.load(sys.stdin); d = d[0] if isinstance(d, list) else d
base = d["Registry"] + "/" + d["Repository"]
tag = d.get("Tag") or ""
print(tag + "\t" + (base + ":" + tag if tag else base + "@" + d["Digest"]))' 2>/dev/null
}

deploy_fly() { # $1 = 出す版 $2 = 今の像の参照（戻す先）
  local sha=$1 prev=$2 log=$STATE/logs/fly-$(date +%Y%m%d-%H%M)-${1:0:10}.log drc img
  git -C "$DEPLOY" checkout -q --detach "$sha" || { say "体験版: 写しを ${sha:0:10} に合わせられません"; return 1 }
  if [[ -n $(git -C "$DEPLOY" status --ignored --porcelain app) ]]; then
    say "体験版: 出す写しの app に git の外のファイルがあるので出しません"
    notify_once "fly-dirty:$sha" "体験版: 出す写しに git の外のファイル"
    return 1
  fi
  if held fly; then say "体験版: 止める時になったので出しません"; return 0; fi
  say "体験版: ${sha:0:10} を出します（今は ${prev##*[:@]}）"
  (cd "$DEPLOY/app" && fly deploy --remote-only --ha=false --image-label "$sha" -a "$APP") > "$log" 2>&1
  drc=$?
  if healthy; then
    img=$(fly_image)
    if [[ ${img%%$'\t'*} == "$sha" ]]; then
      rm -f -- "$STATE/fail-fly"
      say "体験版: ${sha:0:10} を出しました"
      return 0
    fi
    # 前の版のまま応えている（組み立てか送りで落ちた）。体験版は変わっていない
    if failed_once fly "$sha"; then
      say "体験版: 出せませんでした（$drc）。前の版のまま応えています。次の回にもう1回だけ試します。記録: $log"
    else
      say "体験版: 2回続けて出せませんでした（$drc）。次のコミットまで出しません。記録: $log"
      notify "体験版の出し直しに2回失敗（前の版のまま）"
    fi
    return 1
  fi
  # 応えない: この版は次のコミットまで出さず、前の像に戻す
  print -r -- "$sha" > "$STATE/skip-fly"
  if [[ -n $prev ]]; then
    say "体験版: 応えないので、前の像（${prev##*[:@]}）に戻します"
    if (cd "$DEPLOY/app" && fly deploy --image "$prev" --ha=false -a "$APP") >> "$log" 2>&1 && healthy; then
      say "体験版: 前の像に戻しました。${sha:0:10} は次のコミットまで出しません。記録: $log"
      notify "体験版を前の版に戻した（${sha:0:10}）"
      return 1
    fi
  fi
  say "体験版: 応えていません。記録: $log"
  notify "体験版が応えていません"
  return 1
}

deploy_prod() {
  local sha=$1 log=$STATE/logs/prod-$(date +%Y%m%d-%H%M)-${1:0:10}.log prc since
  git -C "$DEPLOY" checkout -q --detach "$sha" || { say "本番: 写しを ${sha:0:10} に合わせられません"; return 1 }
  if held prod; then say "本番: 止める時になったので出しません"; return 0; fi
  say "本番: ${sha:0:10} に組み直します"
  /bin/zsh "$DEPLOY/app/scripts/release-prod.sh" --auto --ref "$sha" > "$log" 2>&1
  prc=$?
  [[ $prc == 3 ]] || rm -f -- "$STATE/busy-prod"
  case $prc in
    0)
      rm -f -- "$STATE/fail-prod"
      say "本番: ${sha:0:10} に入れ替えました"
      return 0 ;;
    3)
      # 今は入れ替えない（ほかの組み直し・動いている健診・家族が使っている最中）。次の回にまた試す。2時間続いたら知らせる
      say "本番: $(grep '今は入れ替えません' "$log" | tail -1)"
      [[ -f $STATE/busy-prod ]] || date +%s > "$STATE/busy-prod"
      since=$(cat "$STATE/busy-prod")
      if (( $(date +%s) - since >= 7200 )); then
        notify_once "prod-busy:$since" "本番の組み直しが2時間入れられていません（${log:t}）"
      fi
      return 0 ;;
    4)
      # 入れ替えた後に応えず、前に戻した（release-prod.sh が skip-prod と hold-prod を置いた）
      print -r -- "$sha" > "$STATE/skip-prod"
      say "本番: 入れ替えた後に応えなかったので、前に戻しました。自動の組み直しは止めています（hold-prod）。記録: $log"
      notify "本番を前の版に戻した。hold-prod で自動を止めています"
      return 1 ;;
    5)
      # 入れ替えた後に応えず、戻しても応えない（release-prod.sh が skip-prod と hold-prod を置いた）。すぐ見る
      print -r -- "$sha" > "$STATE/skip-prod"
      say "本番: 入れ替えた後に応えず、戻しても応えません。すぐ見る事。記録: $log"
      notify "本番が止まっています（戻しても 3210番が応えない）。すぐ見る"
      return 1 ;;
    *)
      if failed_once prod "$sha"; then
        say "本番: 組み直せませんでした（$prc・本番はそのまま）。次の回にもう1回だけ試します。$(grep '止めました' "$log" | tail -1)"
      else
        say "本番: 2回続けて組み直せませんでした（$prc・本番はそのまま）。次のコミットまで出しません。記録: $log"
        notify "本番の組み直しに2回失敗（${log:t}）"
      fi
      return 1 ;;
  esac
}

sync_fly() {
  local img ftag fref fnow
  # 像は止める時でも読む（launchd から fly の認証が通るかを、毎回確かめる）
  img=$(fly_image)
  if [[ -z $img ]]; then
    say "体験版: 出ている像を読めませんでした（fly）"
    notify_once "fly-read:$(date +%Y%m%d)" "体験版: 出ている像を読めない（fly の認証？）"
    return 1
  fi
  ftag=${img%%$'\t'*} fref=${img#*$'\t'}
  if [[ $ftag =~ '^[0-9a-f]{40}$' ]]; then
    fnow=$ftag
  elif [[ -n $adopt ]]; then
    fnow=""
    say "体験版: 札がコミットでない像（${ftag:-札なし}）の上に出します（--adopt）"
  else
    say "体験版: 出ている像の札（${ftag:-札なし}）がコミットではありません（--image-label なしで手で出した？）。手で sync-deploy.sh --only fly --adopt を流すまで、自動では出しません"
    notify_once "fly-tag:$ftag" "体験版: 出ている版が分からないので、自動では出していません"
    return 0
  fi
  if held fly; then say "体験版: 止める時なので出しません（今は ${fnow:0:10}）"; return 0; fi
  if skipped fly "$sha"; then say "体験版: ${sha:0:10} は前に落ちたので、次のコミットまで出しません（sync/skip-fly を消すと、また試す）"; return 0; fi
  ahead "$fnow" "$sha"
  case $? in
    0)
      if [[ -n $dry ]]; then say "[空回し] 体験版へ ${sha:0:10} を出す（今は ${fnow:0:10}）"; return 0; fi
      deploy_fly "$sha" "$fref" ;;
    1) say "体験版: 新しい版はありません（${fnow:0:10}）"; return 0 ;;
    *)
      say "体験版: 出ている版 ${fnow:0:10} が、main の候補 ${sha:0:10} の前にありません（main の外か、手元で引けない）。出しません"
      notify_once "fly-fork:$fnow" "体験版: 出ている版が main の外にあるので、自動では出していません"
      return 0 ;;
  esac
}

sync_prod() {
  local cur psha
  # 本番が応えているか（毎回。組み直しの最中は、入れ替えで数秒止まるので見ない）。応えなければ毎回知らせる
  if [[ ! -d $RELEASES/release.lock && $(curl -s -o /dev/null -m 5 -w '%{http_code}' http://127.0.0.1:3210/unlock 2>/dev/null) != 200 ]]; then
    say "本番: 3210番が応えていません$([[ -e $RELEASES/hold-prod ]] && print -r -- "（hold-prod: $(head -c 300 "$RELEASES/hold-prod")）")"
    notify "本番（3210番）が応えていません。すぐ見る"
  fi
  if held prod; then say "本番: 止める時なので出しません"; return 0; fi
  if [[ ! -L $RELEASES/current ]]; then say "本番: 初めての組み直しは統括が手で流します（current がまだ無い）"; return 0; fi
  cur=$(readlink "$RELEASES/current")
  psha=${${cur:t}##*-}
  if skipped prod "$sha"; then say "本番: ${sha:0:10} は前に落ちたので、次のコミットまで出しません（sync/skip-prod を消すと、また試す）"; return 0; fi
  ahead "$psha" "$sha"
  case $? in
    0)
      if [[ -n $dry ]]; then say "[空回し] 本番へ ${sha:0:10} を出す（今は $psha）"; return 0; fi
      deploy_prod "$sha" ;;
    1) say "本番: 新しい版はありません（$psha）"; rm -f -- "$STATE/busy-prod"; return 0 ;;
    *)
      say "本番: 今の版 $psha が、main の候補 ${sha:0:10} の前にありません（main の外か、手元で引けない）。出しません"
      notify_once "prod-fork:$psha" "本番: 今の版が main の外にあるので、自動では出していません"
      return 0 ;;
  esac
}

install_agent() {
  local dir="$HOME/Library/Application Support/boshi-sync" plist=$HOME/Library/LaunchAgents/com.boshi.sync.plist
  local i lk other busy="" err=""
  # 走っている回（本番の組み直し・この台本）を、写し替えと bootout で途中で止めない。終わるのを30分まで待つ
  for i in {1..90}; do
    busy=""
    for lk in "$RELEASES/release.lock" "$STATE/lock"; do
      other=$(cat "$lk/pid" 2>/dev/null)
      [[ -n $other ]] && kill -0 "$other" 2>/dev/null && busy=$lk
    done
    [[ -z $busy ]] && break
    (( i == 1 )) && say "走っている回（${busy:t}）が終わるのを、30分まで待ってから入れ直します"
    sleep 20
  done
  [[ -z $busy ]] || { say "走っている回が30分で終わらないので、入れ直しません（$busy）"; return 1 }
  # 写しは別の名前に書いてから入れ替える（走っている zsh が読んでいるファイルを、その場で書き換えない）
  mkdir -p "$dir" && cp "$SELF" "$dir/.sync-deploy.sh.new" && chmod 755 "$dir/.sync-deploy.sh.new" \
    && mv -f "$dir/.sync-deploy.sh.new" "$dir/sync-deploy.sh" || return 1
  cat > "$plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.boshi.sync</string>
  <key>ProgramArguments</key><array><string>/bin/zsh</string><string>$dir/sync-deploy.sh</string></array>
  <key>StartInterval</key><integer>1800</integer>
  <key>RunAtLoad</key><false/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/boshi-sync.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/boshi-sync.log</string>
</dict>
</plist>
EOF
  launchctl bootout "gui/$(id -u)/com.boshi.sync" 2>/dev/null || true
  for i in 1 2 3 4 5; do
    err=$(launchctl bootstrap "gui/$(id -u)" "$plist" 2>&1) && { say "入れました: 30分ごとに流します（$plist）"; return 0 }
    sleep 2
  done
  say "launchd に入れられませんでした（$plist）: ${err:-訳は出ませんでした}"
  return 1
}

main() {
  emulate -L zsh
  setopt pipefail
  export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
  local SLUG=Kamicham/boshi-techo APP=boshi-techo-try URL=https://boshi-techo-try.fly.dev
  local DEPLOY=${BOSHI_DEPLOY_TREE:-$HOME/boshi-deploy}
  local RELEASES=${BOSHI_RELEASES:-$HOME/boshi-releases}
  local STATE=$RELEASES/sync
  local only="" dry="" adopt="" sha rc=0 other
  while (( $# )); do
    case $1 in
      --only) shift; only=${1:-} ;;
      --dry-run) dry=1 ;;
      --adopt) adopt=1 ;;
      --install) mkdir -p "$STATE"; install_agent; return $? ;;
      *) say "分からない指定: $1"; return 2 ;;
    esac
    shift
  done
  [[ -z $only || $only == fly || $only == prod ]] || { say "--only は fly か prod"; return 2 }
  mkdir -p "$STATE/logs" || return 1

  # 錠（同時に1回だけ。持ち主の回が終わっている・6時間より古い錠は外す）。本番の組み直しは、release-prod.sh が別の錠も取る
  if ! mkdir "$STATE/lock" 2>/dev/null; then
    other=$(cat "$STATE/lock/pid" 2>/dev/null)
    if [[ -n $other ]] && kill -0 "$other" 2>/dev/null && [[ -z $(find "$STATE/lock" -maxdepth 0 -mmin +360 2>/dev/null) ]]; then
      say "前の回（pid $other）がまだ走っています"; return 0
    fi
    if [[ -z $other && -n $(find "$STATE/lock" -maxdepth 0 -mmin -1 2>/dev/null) ]]; then
      say "前の回が今始まったところです"; return 0
    fi
    rm -f -- "$STATE/lock/pid"
    rmdir -- "$STATE/lock" 2>/dev/null
    mkdir "$STATE/lock" 2>/dev/null || { say "錠を取れませんでした"; return 1 }
    say "止まった回の錠を外しました（pid ${other:-?}）"
  fi
  print -r -- $$ > "$STATE/lock/pid"
  # 錠の置き場は今の値で埋めておく（zsh は関数の中の EXIT の罠を、関数を出る時に走らせる。その時には main の local がまだ見える）
  trap "rm -f -- ${(q)STATE}/lock/pid; rmdir -- ${(q)STATE}/lock 2>/dev/null" EXIT

  # ① 検査が通った main の一番新しいコミット
  sha=$(gh run list -R "$SLUG" --workflow check.yml --branch main --event push --status success -L 1 --json headSha --jq '.[0].headSha // empty' 2>/dev/null)
  if [[ ! $sha =~ '^[0-9a-f]{40}$' ]]; then say "検査が通った main のコミットを読めませんでした（gh）"; notify_once "gh-read:$(date +%Y%m%d)" "検査の結果を読めない（gh）"; return 1; fi
  git -C "$DEPLOY" fetch -q origin main || { say "git fetch に失敗しました"; return 1 }
  git -C "$DEPLOY" cat-file -e "$sha^{commit}" 2>/dev/null || { say "${sha:0:10} が手元にありません"; return 1 }

  # ② 体験版 ③ 本番
  if [[ $only != prod ]]; then sync_fly || rc=1; fi
  if [[ $only != fly ]]; then sync_prod || rc=1; fi
  return $rc
}

main "$@"
exit $?
