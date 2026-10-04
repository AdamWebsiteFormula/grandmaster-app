#!/bin/bash
# Publishing changes what everyone downloads. During judging, do not run
# this unless Adam says so. Pass --yes to confirm.
if [ "${1:-}" != "--yes" ]; then echo "Usage: $0 --yes"; exit 2; fi
shift
# Publish the Windows and Linux installers in ~/grandmaster-release after a
# review. Keeps the Mac lines of the live SHA256SUMS.txt, so the sums always
# match the files on the page.
set -eu
S="$(mktemp -d)"
REL="$HOME/grandmaster-release"
FILES="Upshot_1.0.0_x64-setup.exe Upshot_1.0.0_amd64.AppImage Upshot_1.0.0_amd64.deb"
PAT='sk-or-v1-[A-Za-z0-9]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|sk-proj-[A-Za-z0-9_-]{20,}|sk_live_[A-Za-z0-9]{10,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|xox[bp]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|service_role'
for f in $FILES; do
  n=$(grep -aoE "$PAT" "$REL/$f" 2>/dev/null | wc -l | tr -d ' ')
  echo "$f keys: $n"
  [ "$n" = 0 ] || { echo "keys found; not publishing"; exit 1; }
done
export GH_TOKEN="$(gh auth token --user AdamWebsiteFormula)"
rm -rf "$S/sums-wl" && mkdir -p "$S/sums-wl"
gh release download v1.0.0 --repo AdamWebsiteFormula/grandmaster-app -p SHA256SUMS.txt -D "$S/sums-wl"
grep "Upshot_1.0.0_aarch64.dmg\|Upshot_1.0.0_x64.dmg" "$S/sums-wl/SHA256SUMS.txt" > "$S/sums-wl/mac.txt"
cp "$S/sums-wl/mac.txt" "$S/sums-wl/new.txt"
(cd "$REL" && shasum -a 256 $FILES) >> "$S/sums-wl/new.txt"
mv "$S/sums-wl/new.txt" "$S/sums-wl/SHA256SUMS.txt"
cd "$REL"
gh release upload v1.0.0 --repo AdamWebsiteFormula/grandmaster-app --clobber $FILES "$S/sums-wl/SHA256SUMS.txt"
cat "$S/sums-wl/SHA256SUMS.txt"
echo "Windows and Linux files on the download page updated"
