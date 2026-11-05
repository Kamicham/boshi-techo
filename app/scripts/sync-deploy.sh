#!/bin/zsh
# main に入って検査（CI）が通った直しを、体験版（Fly.io）と本番（Mac の 3210）の両方へ自動で出す。
# 2026-11-05 作り手「直しは随時、デモ用と本番の両方に反映して。体験版で変わっていないと、次の声が進まない」。
# launchd（com.boshi.sync）が30分ごとに流す。新しい版が無ければ何もしない。
#
# 流れ:
#   ⓪ 出さない時: 置き場（~/boshi-releases）に hold（両方）・hold-fly・hold-prod のファイルがある時と、審査の間（11/8 20:00〜11/10 14:00）
#   ① GitHub の検査（check.yml）が通った main の一番新しいコミットを選ぶ（走っている・落ちたコミットは飛ばす）
#   ② 体験版: 出す専用の写し（~/boshi-deploy・detached）をそのコミットに合わせ、app に git の外のファイルが無い事を確かめて fly deploy。
#      /api/health で確かめ、応えなければ前の像に戻す
#   ③ 本番: その写しの release-prod.sh --ref <コミット>（控え → 組み立て → 3211 で確かめ → 動いている健診があれば止める → 差し替え → だめなら戻す）。
#      初めての組み直し（launchd の向き先を変える）は統括が手で流す。それまで（~/boshi-releases/current が無い間）は自動では出さない
# 使い方:
#   sync-deploy.sh                  今すぐ1回（launchd と同じ）
#   sync-deploy.sh --only fly|prod  片方だけ
#   sync-deploy.sh --dry-run        出す版を選ぶまで（変える事はしない）
#   sync-deploy.sh --install        この台本を ~/Library/Application Support/boshi-sync に写し、launchd に30分ごとで入れる（直した後の入れ直しも同じ）
#   止める: touch ~/boshi-releases/hold（片方だけは hold-fly・hold-prod）。戻す: その hold のファイルを消す
# 記録: ~/Library/Logs/boshi-sync.log（1回ごとの fly と本番の詳しい記録は ~/boshi-releases/sync/logs。気を付ける事は sync/attention.txt）

typeset -g SELF=${0:A}

say() { print -r -- "$(date '+%m/%d %H:%M') [自動で出す] $*" }

# Mac の画面に知らせ、気を付ける事の記録に1行残す
notify() {
  osascript -e "display notification \"$1\" with title \"母子手帳の自動の出し直し\"" >/dev/null 2>&1 || true
  print -r -- "$(date '+%m/%d %H:%M') $1" >> "$STATE/attention.txt"
}

held() { # $1 = fly | prod
  [[ -e $RELEASES/hold || -e $RELEASES/hold-$1 ]] && return 0
  local now=$(TZ=Asia/Tokyo date +%Y%m%d%H%M)
  (( now >= 202611082000 && now < 202611101400 )) && return 0
  return 1
}

newer() { # $1 = 出してある版（空なら何でも新しい） $2 = 候補
  [[ -z $1 ]] && return 0
  [[ $2 == ${~1}* ]] && return 1
  # 出してある版が手元で引けない（記録が壊れた等）時は、新しい版として出す
  git -C "$DEPLOY" cat-file -e "$1^{commit}" 2>/dev/null || { say "出してある版 $1 を引けないので、新しい版として扱います"; return 0 }
  git -C "$DEPLOY" merge-base --is-ancestor "$1" "$2" 2>/dev/null
}

healthy() {
  local i
  for i in {1..20}; do
    [[ $(curl -s -m 5 "$URL/api/health" 2>/dev/null) == *'"ok":true'* ]] && return 0
    sleep 6
  done
  return 1
}

deploy_fly() {
  local sha=$1 log=$STATE/logs/fly-$(date +%Y%m%d-%H%M)-${1:0:10}.log prev drc
  git -C "$DEPLOY" checkout -q --detach "$sha" || { say "体験版: 写しを ${sha:0:10} に合わせられません"; return 1 }
  if [[ -n $(git -C "$DEPLOY" status --ignored --porcelain app) ]]; then
    say "体験版: 出す写しの app に git の外のファイルがあるので出しません"; notify "体験版: 出す写しに git の外のファイル"; return 1
  fi
  prev=$(fly image show -a "$APP" --json 2>/dev/null | python3 -c 'import json,sys; d=json.load(sys.stdin); d=d[0] if isinstance(d,list) else d; print(d["Registry"]+"/"+d["Repository"]+":"+d["Tag"])' 2>/dev/null)
  say "体験版: ${sha:0:10} を出します（前の像 ${prev##*:}）"
  (cd "$DEPLOY/app" && fly deploy --remote-only --ha=false -a "$APP") > "$log" 2>&1
  drc=$?
  if (( drc == 0 )) && healthy; then
    print -r -- "$sha" > "$STATE/fly-sha"
    say "体験版: ${sha:0:10} を出しました"
    return 0
  fi
  if healthy; then
    say "体験版: 出せませんでした（$drc）。前の版のまま応えています。記録: $log"
    notify "体験版の出し直しに失敗（前の版のまま）"
    return 1
  fi
  if [[ -n $prev ]]; then
    say "体験版: 応えないので、前の像に戻します"
    if fly deploy -a "$APP" --image "$prev" --ha=false >> "$log" 2>&1 && healthy; then
      say "体験版: 前の像に戻しました。記録: $log"; notify "体験版を前の版に戻した"; return 1
    fi
  fi
  say "体験版: 応えていません。記録: $log"
  notify "体験版が応えていません"
  return 1
}

deploy_prod() {
  local sha=$1 log=$STATE/logs/prod-$(date +%Y%m%d-%H%M)-${1:0:10}.log prc
  git -C "$DEPLOY" checkout -q --detach "$sha" || { say "本番: 写しを ${sha:0:10} に合わせられません"; return 1 }
  say "本番: ${sha:0:10} に組み直します"
  /bin/zsh "$DEPLOY/app/scripts/release-prod.sh" --ref "$sha" > "$log" 2>&1
  prc=$?
  if (( prc == 0 )); then say "本番: ${sha:0:10} に入れ替えました"; return 0; fi
  say "本番: 入れ替えませんでした（$prc）。$(grep '止めました' "$log" | tail -1)"
  # 動いている健診で止まった時は、次の回にまた試すだけ（知らせない）
  grep -q '録音中・文字起こし中・整理中' "$log" || notify "本番の組み直しが止まった（${log:t}）"
  return 1
}

install_agent() {
  local dir="$HOME/Library/Application Support/boshi-sync" plist=$HOME/Library/LaunchAgents/com.boshi.sync.plist
  mkdir -p "$dir" && cp "$SELF" "$dir/sync-deploy.sh" && chmod 755 "$dir/sync-deploy.sh" || return 1
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
  launchctl bootstrap "gui/$(id -u)" "$plist" && say "入れました: 30分ごとに流します（$plist）"
}

main() {
  emulate -L zsh
  setopt pipefail
  export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
  local SLUG=Kamicham/boshi-techo APP=boshi-techo-try URL=https://boshi-techo-try.fly.dev
  local DEPLOY=${BOSHI_DEPLOY_TREE:-$HOME/boshi-deploy}
  local RELEASES=${BOSHI_RELEASES:-$HOME/boshi-releases}
  local STATE=$RELEASES/sync
  local only="" dry="" sha rc=0
  while (( $# )); do
    case $1 in
      --only) shift; only=${1:-} ;;
      --dry-run) dry=1 ;;
      --install) mkdir -p "$STATE"; install_agent; return $? ;;
      *) say "分からない指定: $1"; return 2 ;;
    esac
    shift
  done
  [[ -z $only || $only == fly || $only == prod ]] || { say "--only は fly か prod"; return 2 }
  mkdir -p "$STATE/logs" || return 1

  # 重ならないように（mkdir は同時に1つしか通らない。90分より古い錠は、止まった回の残りとして外す）
  if ! mkdir "$STATE/lock" 2>/dev/null; then
    if [[ -n $(find "$STATE/lock" -maxdepth 0 -mmin +90 2>/dev/null) ]] && rmdir "$STATE/lock" 2>/dev/null && mkdir "$STATE/lock" 2>/dev/null; then
      say "古い錠を外しました"
    else
      say "前の回がまだ走っています"; return 0
    fi
  fi
  # 錠の置き場は今の値で埋めておく（EXIT の時には main の local が消えている）
  trap "rmdir -- ${(q)STATE}/lock 2>/dev/null" EXIT

  # ① 検査が通った main の一番新しいコミット
  sha=$(gh run list -R "$SLUG" --workflow check.yml --branch main --event push --status success -L 1 --json headSha --jq '.[0].headSha // empty' 2>/dev/null)
  if [[ ! $sha =~ '^[0-9a-f]{40}$' ]]; then say "検査が通った main のコミットを読めませんでした（gh）"; notify "検査の結果を読めない（gh）"; return 1; fi
  git -C "$DEPLOY" fetch -q origin main || { say "git fetch に失敗しました"; return 1 }
  git -C "$DEPLOY" cat-file -e "$sha^{commit}" 2>/dev/null || { say "${sha:0:10} が手元にありません"; return 1 }

  # ② 体験版
  if [[ $only != prod ]]; then
    local fsha=$(cat "$STATE/fly-sha" 2>/dev/null)
    if held fly; then say "体験版: 止める時なので出しません"
    elif newer "$fsha" "$sha"; then
      if [[ -n $dry ]]; then say "[空回し] 体験版へ ${sha:0:10} を出す（今は ${fsha:0:10}）"; else deploy_fly "$sha" || rc=1; fi
    else say "体験版: 新しい版はありません（${fsha:0:10}）"
    fi
  fi

  # ③ 本番
  if [[ $only != fly ]]; then
    if held prod; then say "本番: 止める時なので出しません"
    elif [[ ! -L $RELEASES/current ]]; then say "本番: 初めての組み直しは統括が手で流します（current がまだ無い）"
    else
      local cur=$(readlink "$RELEASES/current") psha
      psha=${${cur:t}##*-}
      if newer "$psha" "$sha"; then
        if [[ -n $dry ]]; then say "[空回し] 本番へ ${sha:0:10} を出す（今は $psha）"; else deploy_prod "$sha" || rc=1; fi
      else say "本番: 新しい版はありません（$psha）"
      fi
    fi
  fi
  return $rc
}

main "$@"
exit $?
