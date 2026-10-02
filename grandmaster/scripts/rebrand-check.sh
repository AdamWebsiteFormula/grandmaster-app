#!/bin/bash
# Prints offending lines. Pass = prints nothing. Run from repo root.
cd "$(dirname "$0")/../.."
D=apps/desktop
grep -rnE '\b(Anarlog|Hyprnote|Fastrepl|ANARLOG)\b|anarlog\.so|hyprnote\.com|char\.com|fastrepl' \
  $D/src $D/index.html $D/public \
  $D/src-tauri/Info.plist $D/src-tauri/tauri.conf.json $D/src-tauri/src \
  plugins/*/src plugins/local-llm/assets crates/template-app/assets \
  crates/notification-interface/src crates/notification-macos/swift-lib/src \
  --exclude-dir=node_modules --exclude='*.test.*' --exclude='*.gen.ts' --exclude=tests.rs \
| grep -vE 'i18n/locales/([^e]|e[^n])' \
| grep -vE 'plugins/(detect/src/policy|updater2/|store2/src/commands|deeplink2/src/(types|lib)|transcription/|db/src/runtime/tests)|apps/desktop/src/settings/team/index\.tsx|apps/desktop/src/chat/tools/meetings\.ts|apps/desktop/src/(changelog/|shared/utils\.ts|error-reporting)|@anlg/|anlg-|:[0-9]+:[[:space:]]*(//|\*|/\*|#)' \
| grep -vE 'events\.rs|portal\.rs|env\.ts|session-sharing/urls|resource-list/hooks|LEGACY_STABLE_BUNDLE_ID|tray_version\.rs' \
| grep -vE 'AnarlogMark|isAnarlog|AnarlogAdapter|AdapterKind|CaptureProviderKind|Self::Anarlog|ANARLOG_(CLOUDSYNC|DISABLE|ICON)|Anarlog.app|Anarlog Staging|Anarlog Dev|"Anarlog" \| "Upshot"'
