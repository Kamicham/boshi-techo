#!/bin/sh
# 会話を始めた時・再開した時に、GitHub の main とのずれを1行で出す（.claude/settings.json の SessionStart から）。
cd "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || exit 0
timeout 8 git fetch -q origin main 2>/dev/null
b=$(git symbolic-ref --short -q HEAD || echo "(ブランチ無し)")
# main の検査（CI）の最後に終わった回が赤なら、1行足す（2026-11-05 監査。gh が無い・つながらない時は何も出さない）
ci=""
if command -v gh >/dev/null 2>&1; then
  r=$(timeout 4 gh run list --branch main --workflow check.yml --limit 5 --json status,conclusion,headSha,databaseId \
    --jq '[.[] | select(.status == "completed")][0] | "\(.conclusion) \(.headSha[0:7]) \(.databaseId)"' 2>/dev/null)
  set -- $r
  case "$1" in
    failure|timed_out|startup_failure|cancelled)
      ci=" ⚠ main の検査（CI）が赤です（$2・$1）。上げる前に gh run view $3 --log-failed で中身を見て、直した会話が直す。" ;;
  esac
fi
if [ -d .git ]; then
  # 元の作業の木（~/boshi-techo）は、本番の置き場と統括の場所。どの会話のシェルもここへ戻るので、ここの遅れだけを見せると、
  # 作業の会話がここで main を取り込み、本番が読む public/ などが変わってしまう。作業場ごとの遅れを出す（2026-11-04）。
  # 本番を別の置き場へ移したら、この分け方も直す。
  wts=$(git worktree list --porcelain | sed -n 's/^worktree //p' | while read -r w; do
    [ "$w" = "$PWD" ] && continue
    wb=$(git -C "$w" symbolic-ref --short -q HEAD || echo "?")
    n=$(git -C "$w" rev-list --count HEAD..origin/main 2>/dev/null || echo "?")
    printf ' %s（%s）%s件' "$(basename "$w")" "$wb" "$n"
  done)
  up=""
  [ "$b" != "main" ] && up="・${b} に上げない"
  echo "[母子手帳・git] ここ（$(basename "$PWD")・${b}）は本番の置き場と統括の場所。main を取り込むのは、統括が本番を組み直す時だけ。作業の会話は、ここでコミットしない${up}（シェルはここへ戻るので、命令は cd ~/boshi-<名前> の後か git -C で）。作業場ごとの main からの遅れ:${wts}。遅れていたら、自分の作業場で git merge origin/main を。複数の会話の決まりは CLAUDE.md「複数の会話で進める」。${ci}"
  exit 0
fi
behind=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "?")
ahead=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo "?")
dirty=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
msg="[母子手帳・git] $(basename "$PWD")（${b}）: main より遅れ ${behind}件・main に無い ${ahead}件・書きかけ ${dirty}件。"
[ "$behind" != "0" ] && msg="$msg 作業の前に git merge origin/main を。"
[ "$ahead" != "0" ] && msg="$msg 上げていないコミットは sh scripts/git-hooks/post-commit で上げる（git push origin HEAD:main は全体の設定で止まる）。"
msg="$msg 複数の会話の決まりは CLAUDE.md「複数の会話で進める」。${ci}"
echo "$msg"
