#!/bin/sh
# git の仕掛け（コミットしたら main まで上げる）を入れる。.git/hooks は全部の worktree で共通なので1回でよい。
set -e
cd "$(git rev-parse --show-toplevel)"
hooks="$(git rev-parse --git-common-dir)/hooks"
cp scripts/git-hooks/post-commit "$hooks/post-commit" && chmod +x "$hooks/post-commit"
echo "入れました: $hooks/post-commit"
