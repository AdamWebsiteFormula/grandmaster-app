#!/usr/bin/env bash
# Push the grandmaster branch as AdamWebsiteFormula (Upshot is Website Formula
# work). Uses gh's stored token for that account for this push only, and
# GitHub Desktop's git-lfs for the repo's LFS hooks. Never prints the token.
set -euo pipefail
cd "$(dirname "$0")/../.."
LFS_DIR="/Applications/GitHub Desktop.app/Contents/Resources/app/git/libexec/git-core"
TOKEN="$(gh auth token --user AdamWebsiteFormula)"
PATH="$LFS_DIR:$PATH" git -c credential.helper= push \
  "https://x-access-token:${TOKEN}@github.com/AdamWebsiteFormula/grandmaster-app.git" \
  grandmaster 2>&1 | grep -v "x-access-token" | grep -v "contains credentials" || true
unset TOKEN
git fetch -q origin
git status -sb | head -1
