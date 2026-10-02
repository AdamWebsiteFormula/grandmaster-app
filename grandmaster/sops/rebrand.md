# SOP: rebrand Anarlog to [APP NAME]

Workstream: Release / Design (mechanical). Read-only survey done Oct 2, 2026 on `desktop_v1.4.28`. Model note: tell Adam at the start that Sonnet or Haiku suits the bulk edits (sections 3 to 7); keep Opus for sections 2 and 8.

Rule of thumb: change what a judge can see or what the OS shows (Dock, menu bar, permission dialogs, Finder, DMG). Leave internal identifiers (provider id `"anarlog"`, localStorage keys, Sentry tags, `x-anarlog-*` headers, enum variants, crate and file names). That keeps the diff small and the build green.

Placeholders: `[App]` = display name, `[app]` = lowercase slug (also the URL scheme), `co.websiteformula.[app]` = bundle ID (blueprint section 4).

## 0. Must not touch

| Path or name | Why |
|---|---|
| Audio capture: `crates/audio*`, `crates/aec`, `crates/tcc`, `crates/device-monitor`, `plugins/listener*`, `apps/desktop/src/stt/` capture logic (`capture-lifecycle.ts` logic, not its message strings) | Core feature, CLAUDE.md |
| Transcription: `crates/transcribe-*`, `crates/listener2-core`, `crates/owhisper-*`, `plugins/transcription`, `plugins/local-stt`, `crates/whisper*`, `crates/vad*` | Core feature, CLAUDE.md. Its "Anarlog couldn't prepare this recording" strings (`listener2-core/src/batch/*.rs`) stay; they only show on a failed cloud batch, which we hide. The `AdapterKind::Anarlog` / `AnarlogAdapter` provider also stays |
| `crates/cloudsync/` and `cloudsync.dylib` (tauri `bundle.macOS.frameworks`) | ELv2, ship unmodified. Never point sync at a server |
| `LICENSE*`, `NOTICE`, credits | Legal. README must credit Anarlog (MIT) and sqlite-sync (ELv2) |
| `@anlg/*` package names, `anlg-*` crate names, `anlg_*` menu ids, `AnlgMenuItem` | Workspace wiring, renaming breaks `pnpm` and Cargo resolution |
| `crates/storage/src/global.rs` (`RELEASE_APP_FOLDER = "anarlog"`, legacy `"hyprnote"`) | The DB folder name. Release builds put data in `~/Library/Application Support/anarlog/` for any non-staging, non-nightly identifier, so the new bundle ID still lands there |
| `apps/cli/` (`src/db.rs` default DB lookup, bin `anarlog`, crate `anarlog-cli`) | Finds `anarlog/app.db`. Glaido bridge depends on it |
| Dev identity: `com.hyprnote.dev` in `tauri.conf.json`, `scripts/dev-runner.mjs` (codesign `--identifier`), `plugins/tracing`, `plugins/sidecar2`, `plugins/js` | Dev builds use the bundle ID as the data folder name. Changing it orphans the dev DB and keychain items |
| Legacy-migration tables: `plugins/updater2/src/startup_migration.rs`, `plugins/store2/src/commands.rs` (id mapping), `plugins/auth/src/migrate.rs`, `shared/utils.ts` `getScheme` map | Dead for us but harmless; do not edit |
| Everything outside the desktop app: `apps/web|api|stripe|mobile|watch`, `enterprise/`, `docs/`, `supabase/`, `.github/`, flatpak and app-store configs | Not shipped or not in the macOS DMG |

## 1. Tauri configs (`apps/desktop/src-tauri/`)

Which config is used:

- Dev (`pnpm dev:desktop`, `tauri dev --features dev`): `tauri.conf.json` alone. Product "Anarlog Dev", id `com.hyprnote.dev`. Leave except as noted.
- Release macOS (CD, `desktop_cd.yaml:208-213`): `tauri.conf.json` merged with `tauri.conf.<channel>.json` and `tauri.conf.<channel>-macos.json` (later `--config` wins, objects merge, arrays replace). Local equivalent:
  `pnpm -F desktop tauri build --bundles dmg --config ./src-tauri/tauri.conf.stable.json` (add `--config ./src-tauri/tauri.conf.stable-macos.json` only if you keep it; it only holds the updater endpoint, so drop it).
- Not shipped: `staging`, `nightly`, `flatpak`, `app-store*`, `macos-intel`, `tauri.macos.conf.json` (dev runner and `check-permissions` binary).

Smallest diff: edit `tauri.conf.stable.json` in place and a few keys in the base. Do not create a new file (CD references `tauri.conf.${channel}.json`). The blueprint's `tauri.conf.[brand].json` is satisfied by stable.

| File:line | Key | Now | Change to |
|---|---|---|---|
| `tauri.conf.stable.json:3` | `productName` | `Anarlog` | `[App]`. Drives .app name, DMG name, menu bar, "About [App]", "Quit [App]", tray "Open [App]", CFBundleName |
| `tauri.conf.stable.json:4` | `mainBinaryName` | `anarlog` | `[app]` (lowercase, no spaces) |
| `tauri.conf.stable.json:5` | `identifier` | `com.hyprnote.stable` | `co.websiteformula.[app]` (fresh TCC and Keychain identity) |
| `tauri.conf.stable.json:34` | `plugins.deep-link.desktop.schemes` | `["anarlog","hyprnote"]` | `["[app]"]` (one scheme) |
| `tauri.conf.stable.json:36-42` | `plugins.updater` (`active: true`, endpoint `desktop.anarlog.so`) | on | `{ "active": false }` and delete endpoints (blueprint: remove updater) |
| `tauri.conf.stable.json` bundle | `createUpdaterArtifacts` (set `true` in base at `tauri.conf.json:30`) | `true` | `false` in stable.json, otherwise `tauri build` demands `TAURI_SIGNING_PRIVATE_KEY` |
| `tauri.conf.stable.json` bundle | `linux.deb provides/conflicts/replaces ["char"]` | `char` | leave (Linux only) |
| `tauri.conf.json:28` | `bundle.publisher` | `Fastrepl` | `Website Formula` (applies to release too, because stable merges onto base) |
| `tauri.conf.json` (new) | `bundle.copyright` | absent | `© 2026 Website Formula. Based on Anarlog (MIT).` (shows in Finder Get Info) |
| `tauri.conf.json:115` | `plugins.updater.pubkey` | upstream key | delete with the updater block (not user-visible, but the blueprint removes it) |
| `tauri.conf.json:3,4,5` | dev `productName`, `mainBinaryName`, `identifier` | `Anarlog Dev`, `anarlog-dev`, `com.hyprnote.dev` | leave (section 0). Optional: `productName` to `[App] Dev` only |
| `tauri.conf.json:82` | `bundle.macOS.dmg.background` | `assets/dmg-background-stable.png` | set in stable.json to the new background (see section 2) |
| `tauri.conf.json:81-95` | `macOS.dmg` window and icon positions | 660x430, 177/483 | leave (the new background must keep the same two slots) |
| `tauri.conf.json:98` | `macOS.files` (`Resources/AppIcon.icns`) | `resources/dev/AppIcon.icns`, overridden by stable.json to `resources/stable/AppIcon.icns` | leave; replace the file contents |
| `tauri.conf.json:57-73` | `bundle.resources` alt Dock icons (anagram, journal, notepad, stone, walnut, typewriter-key) | 13 `.icns` | leave (UI is hidden; they cost only size). Remove only if the DMG size matters |

## 2. Icons, DMG background, in-app artwork

Source of truth for the icon is `icons/src/stable.icon` (Icon Composer bundle). `scripts/compile-icons.sh` skips compiling when `resources/stable/AppIcon.icns` already exists, so supply finished files rather than editing the `.icon`.

| Path | What | Change |
|---|---|---|
| `apps/desktop/src-tauri/icons/stable/` (`32x32.png`, `64x64.png`, `128x128.png`, `128x128@2x.png`, `icon.png` 512, `icon.icns`, `icon.ico`, `Square*Logo.png`, `StoreLogo.png`, `android/`, `ios/`) | Bundle icon set listed in `tauri.conf.stable.json:7-13` | Run `pnpm -F desktop tauri icon <1024.png> -o src-tauri/icons/stable` once; it regenerates the whole set. `android/` and `ios/` are unused, ignore |
| `apps/desktop/src-tauri/resources/stable/AppIcon.icns` | Finder and Dock icon of the .app (`Resources/AppIcon.icns`, Info.plist `CFBundleIconFile`) | Copy the new `icon.icns` here |
| `apps/desktop/src-tauri/resources/stable-dark/AppIcon.icns` | Runtime Dock icon in dark theme (`plugins/icon`, `shared/theme/provider.tsx`, mapped to `icons/stable-dark.icns`) | Replace with a dark variant, or copy the same icns |
| `apps/desktop/src-tauri/icons/src/stable.icon`, `icons/src/anarlog-*.png` | Icon Composer source and alt-icon art | Replace `stable.icon` only if you want a clean source; otherwise leave |
| `apps/desktop/public/assets/app-icons/stable-light.png`, `stable-dark.png` | Preview in Settings > Appearance (alt icon picker, hidden) | Replace for consistency if the picker stays visible |
| `apps/desktop/src-tauri/assets/dmg-background-stable.png` (1320x800) | DMG window. Contains the baked text "© 2026 Fastrepl, Inc." and a cream gradient with a hand-drawn "Drag this ... to here." | Redraw: remove Fastrepl text, drop the cream gradient (IP rule: no cream-and-olive look-alike), keep the two icon slots at x=177 and x=483 (points) |
| `apps/desktop/public/assets/anarlog-icon.png` (512) | In-app logo image. Referenced 7 times: `settings/ai/shared/index.tsx:84`, `settings/ai/stt/model-icon.tsx:19`, `sidebar/toast/registry.tsx:10`, `billing/trial-dialog-icon.tsx:3`, `instruction/index.tsx:89`, `session/components/outer-header/index.tsx:303`; plus the pinned bundled-asset hash in a test | Overwrite the file in place with the new mark (same name, no code edits) |
| `apps/desktop/src/shared/anarlog-mark.tsx` | SVG wordmark glyph used by `shared/brand-loading-view.tsx`, `shared/long-load-gate.tsx`, `lock/gate.tsx`, `routes/__root.tsx` (boot, lock and loading screens) | Replace the `<path>` and `<rect>` inside, keep the component name and the `viewBox` constant |
| `apps/desktop/public/assets/logo.svg` | Generic logo | Check usage before replacing (no direct reference found in `src`) |
| `plugins/tray/icons/` (`tray_default.png`, `tray_degraded.png`, `tray_recording_0..2.png`, `tray_update.png`) | Menu bar icon and its recording animation | Replace with a template-style monochrome glyph at the same pixel sizes. Visible all day |
| `apps/desktop/index.html:9,152` | `<title>Anarlog</title>`, "Loading Anarlog. This is taking longer than expected." splash; also inlines the cream `hsl(60 9% 98%)` boot background | Text to `[App]`; background colour to the design-system token |
| `apps/desktop/public/dictation.html:5` | `<title>Anarlog Dictation</title>` | Dictation is hidden; change anyway (1 line) |
| `apps/desktop/public/theme-boot.js:4`, `src/shared/theme/apply.ts:5` | localStorage key `anarlog-theme` | Leave (internal) |

## 3. Info.plist and entitlements (`apps/desktop/src-tauri/`)

Tauri generates `CFBundleName`, `CFBundleDisplayName`, `CFBundleIdentifier`, `CFBundleExecutable` from `productName`, `mainBinaryName` and `identifier`. `Info.plist` is merged on top.

| File:line | Key | Now | Change to |
|---|---|---|---|
| `Info.plist:5-6` | `NSMicrophoneUsageDescription` | "This app requires access to your microphone to record your voice during the meeting." | "[App] records your voice so it can write your meeting notes. Audio stays on your Mac unless you choose a cloud model." Name the app and say why |
| `Info.plist:7-8` | `NSAudioCaptureUsageDescription` | "This app requires access to the system audio ..." | "[App] listens to other people on your call so the transcript includes everyone." |
| `Info.plist:9-10` | `NSContactsUsageDescription` | "Anarlog uses your contacts ..." (only line naming the old brand) | "[App] matches calendar attendees to names and emails saved on your Mac." Contacts prompt is hidden per blueprint; fix the text anyway |
| `Info.plist:11-12` | `NSCalendarsFullAccessUsageDescription` | "This app requires access to your calendar to read events." | "[App] reads your calendar to title meetings and offer to record. It never edits events." |
| `Info.plist:13-14` | `NSRemindersFullAccessUsageDescription` | "... sync and manage tasks." | Reminders prompt is hidden per blueprint. Either rewrite ("[App] shows reminders next to your meeting notes.") or delete the key if no code path asks |
| `Info.plist:15-16` | `NSLocalNetworkUsageDescription` | "This app requires access to your local network ..." | "[App] connects to local models such as Ollama and LM Studio on your network." |
| `Info.plist:17-20` | `CFBundleIconName`, `CFBundleIconFile` | `AppIcon` | leave |
| (absent) | `NSSpeechRecognitionUsageDescription` | not present | Verify at the gate test whether Apple Speech on macOS 26 prompts; add a string naming [App] if it does |
| `Entitlements.plist` | audio-input, calendars, addressbook, allow-jit, allow-unsigned-executable-memory | no brand text | no change. Keep addressbook while contact code exists |
| `Entitlements.app-store.plist` | sandbox set | not shipped | no change |

## 4. Rust surfaces (menus, titles, alerts, notifications)

Auto-follows `productName` (no edit): macOS app menu title (`plugins/tray/src/ext.rs:56,75` `package_info().name`), "About [App]" menu and dialog (`menu_items/app_info.rs:17,36`), "Open [App]" tray item (`tray_open.rs:17`), "Quit [App] Completely?" (`tray_quit_completely.rs:25`).

| File:line | What the user sees | Change |
|---|---|---|
| `plugins/windows/src/window/v1.rs:235` | Main window title ("Anarlog") in Mission Control and the Window menu | `"[App]"` |
| `plugins/windows/src/window/floating_bar.rs:420` | Floating recording bar window title | `"[App]"` |
| `plugins/dictation/src/handler.rs:164` | "Anarlog Dictation" window (dictation hidden) | `"[App] Dictation"`, 1 line |
| `plugins/tray/src/menu_items/help_report_bug.rs:19`, `help_suggest_feature.rs:19` | Help menu "Report Bug", "Suggest Feature" open `https://anarlog.so/discord` | Repoint to our repo issues URL, or drop both from `plugins/tray/src/ext.rs:134-142` |
| `plugins/tray/src/menu_items/tray_version.rs:13-19` | Tray footer "v0.1.0 (dev)": unknown bundle ID and name fall through to `dev` | Add `"co.websiteformula.[app]" => "stable"` (one arm) |
| `plugins/tray/src/menu_items/tray_check_update.rs`, `ext.rs:52` (`updates_enabled`) | "Check for Updates" dialogs | Disappear when the updater is off; verify |
| `apps/desktop/src-tauri/src/startup.rs:168-170` (`channel_product_name`), `:175-179`, `:259` | AppleScript alerts: "Anarlog is already starting", "Updating your data ..." | `Anarlog` to `[App]` (5 strings; `Anarlog Nightly` branch can stay) |
| `apps/desktop/src-tauri/src/lib.rs:612,626,628,630` | Startup failure alerts ("Anarlog failed to start", "needs an update") | `Anarlog` to `[App]`. Keep `anarlog::startup` log target (internal) |
| `apps/desktop/src-tauri/src/db.rs:89` and `apps/desktop/src/shared/long-load-gate.tsx:109` | Error text matched as a substring: "created by a newer version of Anarlog" | Coupled. Change both to the same string, or neither. `long-load-gate.tsx:131,135` shown text can change freely |
| `apps/desktop/src-tauri/src/embedded_cli.rs:53,55,82,97,170,193,686` | CLI install messages ("Anarlog CLI", "managed by Anarlog") | `Anarlog` to `[App]` |
| `apps/desktop/src-tauri/src/embedded_cli.rs:678` | Allowlist of managed app names: `"Anarlog.app" \| "Anarlog Staging.app" \| "Anarlog Dev.app"` | Add `"[App].app"`. Required for the Glaido bridge to treat the bundled CLI as managed |
| `apps/desktop/src-tauri/src/embedded_cli.rs:227-231`, `:288-318` | CLI command name `anarlog`, sidecar `anarlog-cli-<triple>` | Leave (tied to `apps/cli` bin name). The Glaido `mcp.json` uses the absolute path inside the .app, so the command name is not visible |
| `apps/desktop/src-tauri/src/agent_skills.rs:5,113`, `agents-content.md` | Agent-skill installer text (Developers settings, hidden) | `Anarlog` to `[App]` in user strings only; keep `SKILL_DIR_NAME` |
| `crates/notification-interface/src/lib.rs:309,385` | Notification button "Open Anarlog" and "Anarlog will stop listening in N seconds." | `[App]` (2 strings) |
| `crates/notification-macos/swift-lib/src/NotificationInstance.swift:234`, `NotificationManager+CompactView.swift:14` | Same strings, macOS native notification | `[App]` (2 strings). Both Swift and Rust copies must match |
| `plugins/shortcut/src/global/portal.rs:45,47` | "Dictate with Anarlog" (Linux portal, dictation) | Skip |
| `plugins/deeplink2/src/server/mod.rs:152,183`, `callback.html` | Browser page after OAuth ("Returning to Anarlog ...") | Change 2 strings if the OAuth connect flow stays; sign-in is hidden, low priority |
| `plugins/importer/src/connected_mcp.rs:178,461,466` | OAuth client name "Anarlog" and "brought into Anarlog" pages (meeting import, hidden) | Skip or change 3 strings |
| `plugins/windows/src/events.rs:215` | Test fixture URL | Skip |
| `plugins/local-llm/assets/onboarding-enhanced.md:1,3` | "# Anarlog Overview" sample note text | `[App]` |
| `crates/template-app/assets/chat.system.md.jinja:7-8` | Chat system prompt: "You are Anarlog AI ... say your name is Anarlog AI" | `[App] AI` (visible in chat answers). Also `crates/template-app-legacy/assets/chat.system.jinja` if used |
| `plugins/transcription/src/listener2/ext.rs:980,983` | `https://api.anarlog.so/stt` cloud endpoint | Must not touch (transcription). Provider hidden |

## 5. Frontend strings (`apps/desktop/src`)

Counts are lines matching `anarlog|hyprnote|fastrepl|char.com` (case-insensitive), excluding tests, locales and `@anlg/`: 354 lines. Of those about 174 are display text (capitalised `Anarlog`) and about 24 are URLs; the other 160 are internal (`"anarlog"` provider id x50, storage keys, Sentry tags, scheme map, `x-anarlog-*` headers, asset file name). Only display text and URLs need changing.

Source strings are Lingui `t\`...\``, `<Trans>` and `msg\`...\``. After editing run `pnpm -F desktop i18n:extract && pnpm -F desktop i18n:compile` to refresh `i18n/locales/en/messages.po` (89 message ids contain the old name) and `messages.ts`. Delete the other 108 locale folders first (blueprint), or the check fails on them (about 9,990 hits there). Easiest mechanical path: sed the `Anarlog` token in `.tsx` and `.ts` sources, then re-extract; do not hand-edit the `.po`.

| Folder | Hits (display) | Representative files | Note |
|---|---|---|---|
| `onboarding/` | 24 (index 4, final 6, permissions 7, welcome-note 8) | `index.tsx:218` "Welcome to Anarlog", `permissions.tsx`, `welcome-note.ts:15-21` demo note, `welcome-note.constants.ts:1` demo URL, `final.tsx:29,34` Discord and GitHub links | Blueprint replaces the welcome note with a Try-it note |
| `stt/` | 22 | `capture-lifecycle.ts:458,992,1026`, `useStartListening.ts:306`, `auto-stop.ts:164`, `live-transcript-interrupted.ts`, `start-failure.ts`, `batch-response-processing-error.ts`, `meeting-disclosure.ts:12` | Message strings only; do not touch capture logic. `meeting-disclosure.ts` text is pasted into meeting chats: "I'm using Anarlog ... https://anarlog.so" |
| `settings/general/` | 21 | `account.tsx`, `app-settings.tsx:10`, `billing.tsx:170` (enterprise URL), `notification.tsx`, `permissions.tsx`, `storage` | Account and billing hidden; still sed them |
| `settings/ai/` (`llm`, `stt`, `shared`) | 18 | `llm/shared.tsx:69,187,207,236` (displayName "Anarlog", docs links), `stt/shared.tsx:391`, `stt/model-icon.tsx:27` "Anarlog Pro", `shared/index.tsx:91,445,447` | Keep `"anarlog"` provider ids; change only `displayName`, `alt`, `title`, docs URLs. Provider rows are cut to 7 anyway |
| `settings/sync`, `team`, `developers`, `automations`, `privacy`, `stats`, `appearance`, `dictionary`, `imports`, `todo` | about 55 | `sync/index.tsx` x7, `developers/cli.tsx:131`, `developers/skills.tsx:102,123`, `privacy/index.tsx:51,52,87`, `team/index.tsx:1727` (`.anarlog.so`) | Mostly hidden screens. `privacy/index.tsx` and `developers/` stay reachable, so change them |
| `sidebar/toast/registry.tsx` | 5 | `:140` "Sign in to get the most out of Anarlog", `:224,239,259` update toasts | Sign-in and update toasts get removed; sed anyway |
| `session/components/` | 7 | `outer-header/index.tsx:376`, `note-input/transcript/index.tsx:71-73`, `enhanced/enhance-error.tsx:61`, `enhanced/streaming.tsx:92` "Tip: The Anarlog team loves our users!" | Visible in the main flow. Rewrite the Tip line (marketing claim) |
| `chat/` | 8 | `tools/meetings.ts:44-78` tool descriptions, `components/*`, `shared/chat-cta.tsx:32` "Ask Anarlog anything", `tools/web-search.ts:16` example domain `char.com` | Tool descriptions go to the LLM and sometimes surface in answers |
| `lock/gate.tsx:134-136`, `instruction/index.tsx`, `shared/long-load-gate.tsx` | 8 | "Anarlog is Locked", "View Anarlog", checkout and sign-in prompts, startup error | Lock screen is visible if enabled |
| `main/windows-title-bar.tsx:183-198` | 3 | Docs and Discord links (Windows title bar only) | Skip on macOS; sed with the URLs |
| `templates/` | 2 | `utils.ts:88` creator name "Anarlog" for built-in templates; `auto-format-examples-dialog.tsx:128` | Visible on the template cards |
| `devtools-bar/` | 2 | `actions.tsx:379,445` | Dev only; skip |
| `store/zustand/listener/general-live.ts:216` | 1 | Reconnect banner text | Message only; `:599,1007` identifiers stay |
| Other (`calendar/components/shared.tsx`, `contacts`, `crm`, `billing`, `auth`, `session-sharing`, `shared-notes`, `cloud-api`, `dictation`, `audio-player`, `ai/hooks`) | about 35 | `calendar/components/shared.tsx:31-51` docs links, `billing/trial-dialog-icon.tsx:3`, `auth/billing.tsx` | Hidden by blueprint; sed in the same pass |

Never touch in `src`: `error-reporting.ts` tags, `analytics.ts`, `main.tsx:146` storage key, `env.ts:12` `static.anarlog.so` default (not shown to users; unset it with the telemetry removal), `shared/utils.ts` scheme map, `changelog/source.ts` (fetches upstream release notes; hide or remove the What's new entry instead), `session-sharing/urls.ts`, `types/tauri.gen.ts`, `*.test.*`.

## 6. External URLs shown or opened

| URL | Where | Action |
|---|---|---|
| `https://anarlog.so/discord` | `plugins/tray/.../help_report_bug.rs:19`, `help_suggest_feature.rs:19`, `onboarding/final.tsx:29`, `main/windows-title-bar.tsx:191,198` | Replace with our repo or remove |
| `https://github.com/fastrepl/anarlog` | `onboarding/final.tsx:34` | Our repo URL |
| `https://docs.anarlog.so/...` (`/ai-setup#ollama`, `#lm-studio`, `#unsloth`, `/calendar#...`, `/imports`, `/agents/overview`) | `settings/ai/llm/shared.tsx:187,207,236`, `calendar/components/shared.tsx:31-51`, `settings/imports/index.tsx:10`, `settings/developers/index.tsx:15`, `windows-title-bar.tsx:183` | Point at README anchors in our repo, or remove the "docs" link buttons |
| `https://anarlog.so/enterprise/` | `settings/general/billing.tsx:170` | Billing hidden; remove |
| `https://anarlog.so/onboarding-demo/` | `onboarding/welcome-note.constants.ts:1` | Goes with the demo note |
| `https://anarlog.so` | `stt/meeting-disclosure.ts:12` | Our site or drop the link |
| `https://anarlog.so/api/...` | `shared/ui/resource-list/hooks.ts:7` | Hidden feature; ignore |
| `https://api.anarlog.so/stt`, `desktop.anarlog.so/update/...`, `static.anarlog.so` | `plugins/transcription`, stable.json, `env.ts:12` | Updater: remove (section 1). Others: leave |
| `char.com` | `README.md:1`, `chat/tools/web-search.ts:16` | README note: keep the credit line but reword. Web-search example: use `example.com` |
| `mailto:` | none in the app except contact emails | none |

## 7. Documentation and repo surface (not the app, but Adam's definition of done)

- `README.md`: title, icon alt, links (`anarlog.so`, `docs.anarlog.so`), banner about char. Rewrite for [App] and credit Anarlog (MIT) and sqlite-sync (ELv2).
- Add `NOTICE` (new file) with both credits. Do not edit `LICENSE*`.
- `apps/desktop/src-tauri/Cargo.toml:6` `description = "Anarlog Desktop App"` is not shown to users; leave.

## 8. Proposed rebrand-check (must return 0 hits)

Save as `scripts/rebrand-check.sh` (blueprint). Run from repo root. BSD grep on macOS supports `\b` with `-E`. Pass means the command prints nothing.

```bash
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
| grep -vE 'src/env\.ts:.*static\.anarlog\.so|resource-list/hooks\.ts:.*anarlog\.so/api|settings/team/|session-sharing/urls\.ts|embedded_cli\.rs:.*(LEGACY_STABLE_BUNDLE_ID|Anarlog\.app)|tray_version\.rs|windows/src/events\.rs:.*://'
```

Allowed exceptions (added Oct 2, all invisible to users):
- `env.ts` `static.anarlog.so` and `resource-list/hooks.ts` `anarlog.so/api`: working asset/template endpoints. Renaming breaks features.
- `settings/team/`, `session-sharing/urls.ts`: hidden features (Teams, sharing).
- `embedded_cli.rs`, `tray_version.rs`: name/bundle-ID matching lists for compatibility; `Upshot` is already in them.
- `windows/src/events.rs`: test deep-link strings.
- `tauri.conf.stable.json` is no longer scanned: the build uses the base config only.

Then check the built artifacts (blueprint scope):

```bash
APP="apps/desktop/src-tauri/target/release/bundle/macos/[App].app"   # or ~/anarlog-target/... if CARGO_TARGET_DIR is set
plutil -p "$APP/Contents/Info.plist" | grep -iE 'anarlog|hyprnote|fastrepl'          # expect nothing
grep -rliE 'anarlog|hyprnote|fastrepl' apps/desktop/dist --include='*.js' --include='*.html' | head   # review: only allowlisted internal ids
```

Baseline before any edit: 432 lines (178 of them in the English catalog, regenerated by `i18n:extract`). Target: 0.

Exclusion list, with reason:

| Excluded | Reason |
|---|---|
| Non-English locales | Deleted per blueprint |
| `*.test.*`, `tests.rs`, `*.gen.ts` | Not shipped / generated |
| `plugins/detect/src/policy.rs`, `plugins/updater2/`, `plugins/store2/src/commands.rs`, `plugins/deeplink2/src/{types,lib.rs}`, `plugins/db/src/runtime/tests`, `shared/utils.ts` | Legacy id and scheme tables, migrations |
| `plugins/transcription/`, `crates/listener2-core`, `crates/owhisper-*` | Must not touch |
| `changelog/`, `error-reporting`, `analytics` | Upstream feed, telemetry tags (telemetry is removed separately) |
| `@anlg/`, `anlg-`, `AnarlogMark`, `isAnarlog*`, `*Adapter`, `AdapterKind`, `CaptureProviderKind`, `ANARLOG_CLOUDSYNC*` | Names that must stay |
| Comment-only lines | Attribution comments (for example `tremor/*.tsx` "Adapted to Anarlog's theme") |

Add `NOTICE`, `README.md`, `LICENSE*`, `docs/`, `.github/` and everything outside the scope list: excluded by omission.

## 9. Order of work

1. `tauri.conf.stable.json` plus base `publisher` and `copyright` (section 1). Build one DMG; confirm name, icon, bundle ID with `plutil` and `codesign -dv`.
2. Info.plist strings, icons, tray glyphs, DMG background (sections 2, 3).
3. Rust strings and the three additive id edits: `tray_version.rs`, `embedded_cli.rs:678`, `crates/detect/src/list/mod.rs` self-app lists (lines ~30-50 and `SELF_APP_PATH_SEGMENTS`: add `"[app]"`, `"/[app].app/"`; also `plugins/detect/src/policy.rs` `AppCategory::Anarlog` ids: add `co.websiteformula.[app]`) so the app does not flag itself as a meeting app. These are additive, not capture changes.
4. Frontend sed pass, then `i18n:extract` and `i18n:compile`, then delete non-en locales.
5. `scripts/rebrand-check.sh` to 0; then install the DMG in a second macOS user and click through onboarding, recording, Enhance, menu bar, Help menu, About, Dock icon (light and dark), a permission dialog.

Known risks: (a) Dock icon at runtime comes from `resources/stable*/AppIcon.icns`, not only `icons/stable/icon.icns`; miss it and the Dock shows the old logo. (b) `createUpdaterArtifacts: true` fails the build without a signing key. (c) The two "newer version of Anarlog" strings must stay in sync. (d) Release data folder stays `anarlog/` in Application Support by design; mention it in the README so nobody "fixes" it.
