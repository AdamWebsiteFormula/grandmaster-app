#!/bin/bash
# Install an Upshot DMG to /Applications, verify the signature, and scan the
# bundle for key-shaped strings. Prints counts only, never matches.
# Usage: install.sh <dmg>
set -u
DMG="$1"
pkill -x upshot 2>/dev/null; sleep 2
MNT=$(hdiutil attach -nobrowse -readonly "$DMG" | awk -F'\t' '/\/Volumes\//{print $NF}' | tail -1)
[ -d "$MNT/Upshot.app" ] || { echo "no app in $MNT"; exit 1; }
rm -rf /Applications/Upshot.app
ditto "$MNT/Upshot.app" /Applications/Upshot.app
hdiutil detach -quiet "$MNT"
codesign --verify --deep --strict /Applications/Upshot.app && echo "codesign ok"
PAT='sk-or-v1-[A-Za-z0-9]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|sk-proj-[A-Za-z0-9_-]{20,}|sk_live_[A-Za-z0-9]{10,}|rk_live_[A-Za-z0-9]{10,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|xox[bp]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|service_role'
N=$(grep -raoE "$PAT" /Applications/Upshot.app 2>/dev/null | wc -l | tr -d ' ')
echo "key-shaped strings in bundle: $N"
shasum -a 256 "$DMG" | awk '{print "sha256 " $1}'
