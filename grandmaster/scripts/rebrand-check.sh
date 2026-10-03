#!/bin/bash
# Rebrand check: prints user-visible upstream brand strings. Pass = no output. Source: grandmaster/sops/rebrand.md section 8.
cd "$(dirname "$0")/../.."
D=apps/desktop
grep -rnE '\b(Anarlog|Hyprnote|Fastrepl|ANARLOG)\b|anarlog\.so|hyprnote\.com|char\.com|fastrepl' \
  $D/src $D/index.html $D/public \
  $D/src-tauri/Info.plist $D/src-tauri/tauri.conf.json $D/src-tauri/src \
  plugins/*/src plugins/local-llm/assets crates/template-app/assets \
  crates/notification-interface/src crates/notification-macos/swift-lib/src \
  --exclude-dir=node_modules --exclude='*.test.*' --exclude='*.gen.ts' --exclude=tests.rs \
| grep -vE 'i18n/locales/([^e]|e[^n])' \
| grep -vE 'plugins/(detect/src/policy|updater2/|store2/src/commands|deeplink2/src/(types|lib)|transcription/|db/src/runtime/tests)|apps/desktop/src/(changelog/|shared/utils\.ts|error-reporting)|@anlg/|anlg-|:[0-9]+:[[:space:]]*(//|\*|/\*|#)' \
| grep -vE 'AnarlogMark|isAnarlog|AnarlogAdapter|AdapterKind|CaptureProviderKind|Self::Anarlog|ANARLOG_(CLOUDSYNC|DISABLE|ICON)' \
| grep -vE 'src/env\.ts:.*static\.anarlog\.so|resource-list/hooks\.ts:.*anarlog\.so/api|settings/team/|session-sharing/urls\.ts|embedded_cli\.rs:.*(LEGACY_STABLE_BUNDLE_ID|Anarlog\.app)|tray_version\.rs|windows/src/events\.rs:.*://|tauri\.conf\.json:.*Based on Anarlog \(MIT\)|src-tauri/src/db\.rs:.*newer version of Anarlog' || true
# Rebrand overshoot: dead repo links and a credit that names Upshot as its own upstream.
grep -rnE 'github\.com/AdamWebsiteFormula/upshot|Based on Upshot' \
  $D/src $D/src-tauri/tauri.conf.json $D/src-tauri/src plugins/*/src \
  --exclude-dir=node_modules --exclude='*.test.*' || true
