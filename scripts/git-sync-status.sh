#!/bin/sh
# 会話を始めた時・再開した時に、GitHub の main とのずれを1行で出す（.claude/settings.json の SessionStart から）。
cd "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || exit 0
timeout 8 git fetch -q origin main 2>/dev/null
b=$(git symbolic-ref --short -q HEAD || echo "(ブランチ無し)")
behind=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "?")
ahead=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo "?")
dirty=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
msg="[母子手帳・git] $(basename "$PWD")（${b}）: main より遅れ ${behind}件・main に無い ${ahead}件・書きかけ ${dirty}件。"
[ "$behind" != "0" ] && msg="$msg 作業の前に git merge origin/main を。"
[ "$ahead" != "0" ] && msg="$msg 上げていないコミットは git push origin HEAD:main で。"
msg="$msg 複数の会話の決まりは CLAUDE.md「複数の会話で進める」。"
echo "$msg"
