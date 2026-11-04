#!/bin/sh
# git の仕掛けを入れる: コミットと取り込みの後に main まで上げる（post-commit・post-merge）・公開リポに入れてはいけない物を止める（pre-commit・commit-msg）。
# .git/hooks は全部の worktree で共通なので1回でよい。
set -e
cd "$(git rev-parse --show-toplevel)"
hooks="$(git rev-parse --git-common-dir)/hooks"
for h in post-commit post-merge pre-commit commit-msg; do
  cp "scripts/git-hooks/$h" "$hooks/$h" && chmod +x "$hooks/$h"
  echo "入れました: $hooks/$h"
done
