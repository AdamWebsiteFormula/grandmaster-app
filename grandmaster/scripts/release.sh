#!/bin/bash
# Gate release: aarch64, base tauri.conf.json, ad-hoc signed, DMG + SHA-256.
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
export APP_VERSION="1.0.0"
export VITE_APP_VERSION="$APP_VERSION"
export CI=false
# CMake 4 rejects cmake_minimum_required < 3.5 in older vendored C++ deps.
export CMAKE_POLICY_VERSION_MINIMUM=3.5
unset POSTHOG_API_KEY VITE_POSTHOG_API_KEY SENTRY_DSN VITE_SENTRY_DSN TAURI_SIGNING_PRIVATE_KEY

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TRIPLE=aarch64-apple-darwin
ST="$ROOT/apps/desktop/src-tauri"
OUT="$HOME/grandmaster-release"
mkdir -p "$OUT"
cd "$ROOT"

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
pnpm -F desktop tauri build --target $TRIPLE --config "$CONF" --bundles app

APP=$(ls -d "$CARGO_TARGET_DIR/$TRIPLE/release/bundle/macos/"*.app | head -1)
echo "APP=$APP"

echo "== 3 ad-hoc sign inside out (no hardened runtime: ad-hoc has no team ID for library validation)"
find "$APP/Contents/Frameworks" -name '*.dylib' -exec codesign --force --sign - {} \;
MAIN="$(defaults read "$APP/Contents/Info.plist" CFBundleExecutable)"
for f in "$APP/Contents/MacOS/"*; do
  [ "$(basename "$f")" = "$MAIN" ] && continue
  codesign --force --sign - "$f"
done
codesign --force --sign - --entitlements "$ST/Entitlements.plist" "$APP"
codesign --verify --deep --strict --verbose=2 "$APP"

echo "== 4 DMG"
NAME=$(basename "$APP" .app)
STAGE="$OUT/dmg-stage"
rm -rf "$STAGE" && mkdir -p "$STAGE"
ditto "$APP" "$STAGE/$NAME.app"
ln -s /Applications "$STAGE/Applications"
DMG="$OUT/${NAME// /-}_${APP_VERSION}_aarch64.dmg"
rm -f "$DMG"
hdiutil create -volname "$NAME" -srcfolder "$STAGE" -ov -format UDZO "$DMG"
rm -rf "$STAGE"
shasum -a 256 "$DMG" | tee "$DMG.sha256"
