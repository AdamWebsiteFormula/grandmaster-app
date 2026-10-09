#!/bin/bash
# Release build: base tauri.conf.json, DMG + SHA-256, plus the updater
# bundle (Upshot.app.tar.gz + .sig) and a latest.json piece for publish-release.sh.
# Usage: APP_VERSION=1.0.1 release.sh [aarch64|x86_64]   (default aarch64)
# Signing: a "Developer ID Application" identity in the keychain (or
# UPSHOT_SIGN_ID) signs with the hardened runtime; a notarytool keychain
# profile named "upshot" (or UPSHOT_NOTARY_PROFILE) then notarizes and
# staples. Without an identity the app is ad-hoc signed, as before.
# Sources: developer.apple.com/documentation/security/notarizing-macos-software-before-distribution
# and .../customizing-the-notarization-workflow (notarytool submit --wait,
# stapler staple); v2.tauri.app/plugin/updater (tar.gz + minisign .sig,
# static JSON feed).
# x86_64 cross-compiles for Intel Macs the way desktop_cd.yaml does: adds
# tauri.conf.macos-intel.json (x86_64 cloudsync dylib, no MLX metallib).
# Output: ~/grandmaster-release/
set -euo pipefail
# Swift shim first: Xcode 27 SwiftPM defaults to swiftbuild; swift-rs needs --build-system native.
export PATH="$HOME/.local/share/grandmaster-shims:$HOME/.cargo/bin:$HOME/.local/bin:$PATH"
export CARGO_TARGET_DIR="$HOME/anarlog-target"
export SDKROOT="$(xcrun --sdk macosx --show-sdk-path)"
export VITE_API_URL="http://localhost:3001"
# Upshot AI Worker origin (grandmaster/worker); the app calls {origin}/llm/chat/completions.
# Replace with the deployed workers.dev URL, or set VITE_AI_API_URL before running.
export VITE_AI_API_URL="${VITE_AI_API_URL:-https://upshot-ai.adam-694.workers.dev}"
export APP_VERSION="${APP_VERSION:-1.0.0}"
export VITE_APP_VERSION="$APP_VERSION"
export CI=false
# CMake 4 rejects cmake_minimum_required < 3.5 in older vendored C++ deps.
export CMAKE_POLICY_VERSION_MINIMUM=3.5
unset POSTHOG_API_KEY VITE_POSTHOG_API_KEY SENTRY_DSN VITE_SENTRY_DSN TAURI_SIGNING_PRIVATE_KEY

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ARCH="${1:-${ARCH:-aarch64}}"
case "$ARCH" in
  aarch64) EXTRA_CONF=(); DMG_ARCH=aarch64 ;;
  x86_64) EXTRA_CONF=(--config ./src-tauri/tauri.conf.macos-intel.json); DMG_ARCH=x64 ;;
  *) echo "unsupported ARCH: $ARCH (use aarch64 or x86_64)" >&2; exit 1 ;;
esac
# Test builds only: UPSHOT_EXTRA_CONF=path.json overlays one more config, e.g.
# an updater endpoint on localhost to try an update before publishing.
[ -n "${UPSHOT_EXTRA_CONF:-}" ] && EXTRA_CONF+=(--config "$UPSHOT_EXTRA_CONF")
TRIPLE=$ARCH-apple-darwin
ST="$ROOT/apps/desktop/src-tauri"
OUT="$HOME/grandmaster-release"
mkdir -p "$OUT"
cd "$ROOT"

# One build at a time: two builds share CARGO_TARGET_DIR and step 2 deletes
# the bundle folder, so a second build broke the first one's updater step
# (Oct 9). mkdir is atomic; the lock goes away when this script exits.
LOCK="$OUT/.release.lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "another release.sh is running (pid $(cat "$LOCK/pid" 2>/dev/null || echo ?)); remove $LOCK if it is not" >&2
  exit 1
fi
echo $$ > "$LOCK/pid"
trap 'rm -rf "$LOCK"' EXIT

echo "== 1 sidecars (same as cargo xtask prepare-binaries, but with CARGO_TARGET_DIR)"
(cd "$ST" && cargo build --release --target $TRIPLE -p chrome-native-host -p anarlog-cli)
mkdir -p "$ST/binaries" "$ST/resources/cli"
cp "$CARGO_TARGET_DIR/$TRIPLE/release/char-chrome-native-host" "$ST/binaries/char-chrome-native-host-$TRIPLE"
cp "$CARGO_TARGET_DIR/$TRIPLE/release/anarlog" "$ST/resources/cli/anarlog-cli-$TRIPLE"
# Register them as externalBin with scripts/sidecar.sh, as desktop_cd.yaml does,
# but into a small overlay config so tauri*.json stays untouched by the build.
CONF="$OUT/tauri.conf.sidecars.json"
echo "{\"version\":\"$APP_VERSION\",\"bundle\":{\"externalBin\":[]}}" > "$CONF"
for b in binaries/char-chrome-native-host binaries/check-permissions resources/cli/anarlog-cli; do
  ./scripts/sidecar.sh "$CONF" "$b"
done
cat "$CONF"

echo "== 2 tauri build"
# Remove old bundles first, so step 3 can never pick a stale .app (e.g. "Anarlog Dev.app").
rm -rf "$CARGO_TARGET_DIR/$TRIPLE/release/bundle/macos"
pnpm -F ui build
pnpm -F desktop tauri build --target $TRIPLE --config "$CONF" ${EXTRA_CONF[@]+"${EXTRA_CONF[@]}"} --bundles app

APP=$(ls -d "$CARGO_TARGET_DIR/$TRIPLE/release/bundle/macos/"*.app | head -1)
echo "APP=$APP"

# Stop if the binary embeds a different frontend than vite just built: on
# Oct 5 a cached desktop crate shipped the previous build's screens.
# Fix: cargo clean -p desktop --release --target $TRIPLE, then rebuild.
WANT=$(ls "$ROOT/apps/desktop/dist/assets" | grep -o '^_layout\.index-[A-Za-z0-9_-]*\.js' | head -1)
# grep without -q reads all input: -q exits early, strings gets SIGPIPE and
# pipefail reports a false STALE.
if ! strings -n 12 "$APP/Contents/MacOS/upshot" | grep -F "$WANT" >/dev/null; then
  echo "STALE FRONTEND: $APP does not embed $WANT" >&2
  exit 1
fi
echo "frontend ok: $WANT"

SIGN_ID="${UPSHOT_SIGN_ID:-$(security find-identity -v -p codesigning | sed -n 's/.*"\(Developer ID Application: [^"]*\)".*/\1/p' | head -1)}"
NOTARY_PROFILE="${UPSHOT_NOTARY_PROFILE:-upshot}"
if [ -n "$SIGN_ID" ]; then
  echo "== 3 Developer ID sign inside out, hardened runtime: $SIGN_ID"
  SIGN=(codesign --force --timestamp --options runtime --sign "$SIGN_ID")
else
  echo "== 3 ad-hoc sign inside out (no hardened runtime: ad-hoc has no team ID for library validation)"
  echo "   WARNING: not notarized; macOS will block the first open for downloaded copies."
  SIGN=(codesign --force --sign -)
fi
find "$APP/Contents/Frameworks" -name '*.dylib' -exec "${SIGN[@]}" {} \;
MAIN="$(defaults read "$APP/Contents/Info.plist" CFBundleExecutable)"
for f in "$APP/Contents/MacOS/"*; do
  [ "$(basename "$f")" = "$MAIN" ] && continue
  "${SIGN[@]}" "$f"
done
"${SIGN[@]}" --entitlements "$ST/Entitlements.plist" "$APP"
codesign --verify --deep --strict --verbose=2 "$APP"

echo "== 4 DMG"
NAME=$(basename "$APP" .app)
STAGE="$OUT/dmg-stage"
rm -rf "$STAGE" && mkdir -p "$STAGE"
ditto "$APP" "$STAGE/$NAME.app"
ln -s /Applications "$STAGE/Applications"
DMG="$OUT/${NAME// /-}_${APP_VERSION}_${DMG_ARCH}.dmg"
rm -f "$DMG"
hdiutil create -volname "$NAME" -srcfolder "$STAGE" -ov -format UDZO "$DMG"
rm -rf "$STAGE"

if [ -n "$SIGN_ID" ]; then
  codesign --force --timestamp --sign "$SIGN_ID" "$DMG"
  if xcrun notarytool history --keychain-profile "$NOTARY_PROFILE" >/dev/null 2>&1; then
    echo "== 5 notarize and staple (profile: $NOTARY_PROFILE)"
    # Notarizing the DMG also records tickets for the app inside it, so both
    # can be stapled; the stapled app then goes into the updater bundle.
    xcrun notarytool submit "$DMG" --keychain-profile "$NOTARY_PROFILE" --wait
    xcrun stapler staple "$DMG"
    xcrun stapler staple "$APP"
    spctl --assess --type open --context context:primary-signature --verbose=2 "$DMG"
    spctl --assess --type execute --verbose=2 "$APP"
  else
    echo "   WARNING: no notarytool profile \"$NOTARY_PROFILE\"; signed but not notarized."
    echo "   Create it once: xcrun notarytool store-credentials $NOTARY_PROFILE --apple-id <id> --team-id <team>"
  fi
fi
shasum -a 256 "$DMG" | tee "$DMG.sha256"

echo "== 6 updater bundle (Tauri's macOS format: .app.tar.gz + minisign signature)"
UPDATER_KEY="${UPSHOT_UPDATER_KEY:-$HOME/.upshot-release/updater.key}"
if [ -f "$UPDATER_KEY" ]; then
  TGZ="$OUT/${NAME// /-}_${APP_VERSION}_${DMG_ARCH}.app.tar.gz"
  rm -f "$TGZ" "$TGZ.sig"
  COPYFILE_DISABLE=1 tar -czf "$TGZ" -C "$(dirname "$APP")" "$(basename "$APP")"
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" pnpm -F desktop tauri signer sign -f "$UPDATER_KEY" -p "" "$TGZ" >/dev/null
  # One platform entry; publish-release.sh merges the pieces into latest.json.
  PIECE="$OUT/latest.darwin-$ARCH.json"
  node -e '
    const fs = require("fs");
    const [tgz, piece, key] = process.argv.slice(1);
    const sig = fs.readFileSync(tgz + ".sig", "utf8").trim();
    const url = "https://github.com/AdamWebsiteFormula/grandmaster-app/releases/download/v" +
      process.env.APP_VERSION + "/" + require("path").basename(tgz);
    fs.writeFileSync(piece, JSON.stringify({ [key]: { signature: sig, url } }, null, 2));
  ' "$TGZ" "$PIECE" "darwin-$ARCH"
  echo "updater: $TGZ"
else
  echo "   WARNING: no updater key at $UPDATER_KEY; skipped the updater bundle."
fi
