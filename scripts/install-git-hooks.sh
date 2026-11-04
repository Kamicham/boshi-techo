#!/bin/sh
# git の仕掛けを入れる: コミットしたら main まで上げる（post-commit）・公開リポに入れてはいけない物を止める（pre-commit・commit-msg）。
# .git/hooks は全部の worktree で共通なので1回でよい。
set -e
cd "$(git rev-parse --show-toplevel)"
hooks="$(git rev-parse --git-common-dir)/hooks"
for h in post-commit pre-commit commit-msg; do
  cp "scripts/git-hooks/$h" "$hooks/$h" && chmod +x "$hooks/$h"
  echo "入れました: $hooks/$h"
done
