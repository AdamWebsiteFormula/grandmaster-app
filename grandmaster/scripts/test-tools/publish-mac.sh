#!/bin/bash
# Publishing changes what everyone downloads. During judging, do not run
# this unless Adam says so. Pass --yes to confirm.
if [ "${1:-}" != "--yes" ]; then echo "Usage: $0 --yes"; exit 2; fi
shift
# Publish both Mac installers after an in-app test. Keeps the Windows and
# Linux lines of the live SHA256SUMS.txt, so the sums always match the page.
set -eu
S="$(mktemp -d)"
REL="$HOME/grandmaster-release"
PAT='sk-or-v1-[A-Za-z0-9]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|sk-proj-[A-Za-z0-9_-]{20,}|sk_live_[A-Za-z0-9]{10,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|xox[bp]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|service_role'
for dmg in Upshot_1.0.0_aarch64.dmg Upshot_1.0.0_x64.dmg; do
  MNT=$(hdiutil attach -nobrowse -readonly "$REL/$dmg" | awk -F'\t' '/\/Volumes\//{print $NF}' | tail -1)
  n=$(grep -raoE "$PAT" "$MNT" 2>/dev/null | wc -l | tr -d ' ')
  hdiutil detach -quiet "$MNT" || hdiutil detach -force "$MNT"
  echo "$dmg keys: $n"
  [ "$n" = 0 ] || { echo "keys found; not publishing"; exit 1; }
done
export GH_TOKEN="$(gh auth token --user AdamWebsiteFormula)"
rm -rf "$S/sums" && mkdir -p "$S/sums"
gh release download v1.0.0 --repo AdamWebsiteFormula/grandmaster-app -p SHA256SUMS.txt -D "$S/sums"
grep -v "Upshot_1.0.0_aarch64.dmg\|Upshot_1.0.0_x64.dmg" "$S/sums/SHA256SUMS.txt" > "$S/sums/rest.txt" || true
(cd "$REL" && shasum -a 256 Upshot_1.0.0_aarch64.dmg Upshot_1.0.0_x64.dmg) > "$S/sums/SHA256SUMS.txt"
cat "$S/sums/rest.txt" >> "$S/sums/SHA256SUMS.txt"
cd "$REL"
gh release upload v1.0.0 --repo AdamWebsiteFormula/grandmaster-app --clobber Upshot_1.0.0_aarch64.dmg Upshot_1.0.0_x64.dmg "$S/sums/SHA256SUMS.txt"
cat "$S/sums/SHA256SUMS.txt"
echo "Mac files on the download page updated"
