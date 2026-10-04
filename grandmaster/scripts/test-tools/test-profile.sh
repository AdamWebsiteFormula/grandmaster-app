#!/bin/bash
# Open the installed Upshot on a throwaway copy of the real data, so tests
# never touch Adam's notes. Quits any running Upshot first (single
# instance). Usage: test-profile.sh [profile dir]
set -eu
T="${1:-$(mktemp -d)/upshot-test-home}"
mkdir -p "$T/Library/Application Support"
pkill -x upshot 2>/dev/null || true
sleep 1
ditto "$HOME/Library/Application Support/anarlog" "$T/Library/Application Support/anarlog"
rm -f "$T/Library/Application Support/anarlog/launch.lock"
if [ -d "$HOME/Library/Application Support/com.websiteformula.upshot" ]; then
  ditto "$HOME/Library/Application Support/com.websiteformula.upshot" "$T/Library/Application Support/com.websiteformula.upshot"
fi
open -g -j -n --env HOME="$T" /Applications/Upshot.app
echo "test profile: $T"
