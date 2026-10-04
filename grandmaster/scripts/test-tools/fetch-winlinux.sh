#!/bin/bash
# Download the final Windows and Linux installers, put them in
# ~/grandmaster-release/, and write SHA256SUMS-win-linux.txt.
# Usage: fetch-winlinux.sh <run-id>
set -u
RUN="$1"
S="$(mktemp -d)"
OUT="$S/ci-final"
REL="$HOME/grandmaster-release"
rm -rf "$OUT"; mkdir -p "$OUT"
export GH_TOKEN="$(gh auth token --user AdamWebsiteFormula)"
for n in upshot-windows-x64 upshot-linux-x64 upshot-windows-screenshot upshot-linux-screenshot; do
  gh run download "$RUN" --repo AdamWebsiteFormula/grandmaster-app --name "$n" --dir "$OUT/$n" || echo "FAILED $n"
done
unset GH_TOKEN
EXE=$(find "$OUT/upshot-windows-x64" -name "*-setup.exe" | head -1)
APP=$(find "$OUT/upshot-linux-x64" -name "*.AppImage" | head -1)
DEB=$(find "$OUT/upshot-linux-x64" -name "*.deb" | head -1)
echo "exe=$EXE"; echo "appimage=$APP"; echo "deb=$DEB"
[ -f "$EXE" ] && [ -f "$APP" ] && [ -f "$DEB" ] || { echo "missing installer"; exit 1; }
cp "$EXE" "$REL/Upshot_1.0.0_x64-setup.exe"
cp "$APP" "$REL/Upshot_1.0.0_amd64.AppImage"
cp "$DEB" "$REL/Upshot_1.0.0_amd64.deb"
chmod +x "$REL/Upshot_1.0.0_amd64.AppImage"
(cd "$REL" && shasum -a 256 Upshot_1.0.0_x64-setup.exe Upshot_1.0.0_amd64.AppImage Upshot_1.0.0_amd64.deb > SHA256SUMS-win-linux.txt && cat SHA256SUMS-win-linux.txt)
# Key scan of the Windows and Linux packages (counts only).
PAT='sk-or-v1-[A-Za-z0-9]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|sk-proj-[A-Za-z0-9_-]{20,}|sk_live_[A-Za-z0-9]{10,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|xox[bp]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|service_role'
for f in "$REL/Upshot_1.0.0_x64-setup.exe" "$REL/Upshot_1.0.0_amd64.deb"; do
  printf "%s key-shaped strings: " "$(basename "$f")"; grep -aoE "$PAT" "$f" | wc -l | tr -d ' '
done
# Screenshots for Adam.
cp "$OUT"/upshot-windows-screenshot/*.png "$OUT"/upshot-linux-screenshot/*.png /Users/Shared/upshot-night-checks/ 2>/dev/null && echo "screenshots copied"
ls -la "$REL" | awk '{print $5, $9}'
