# SOP: features mapping pass (blueprint section 8)

Oct 2, 2026 · Read-only pass over `desktop_v1.4.28`. Every row below was re-opened in the code; line numbers are current. "Read" means verified by reading, not by running the app. Nothing here was run, built or installed.

Paths are repo-relative. `D/` = `apps/desktop/src/`, `T/` = `apps/desktop/src-tauri/`.

Status key: **Verified** (plan claim holds), **Corrected** (right answer, wrong path, line or detail), **Wrong** (the code says otherwise).

## Part 1. Section 8 answers with proof

### 1. Audio kept by default? Click to play? — Verified, one wording correction

| Claim | Proof |
|---|---|
| Default retention is "forever" | `D/settings/schema.ts:132-136` (`audio_retention`, default `"forever"`); `D/services/audio-retention-policy.ts:17-32` (`normalizeAudioRetention` falls back to "forever" for anything unknown). `save_recordings` also defaults true at `D/settings/schema.ts:127-131`. |
| Audio is written when retention is not "none" | `D/stt/useStartListening.ts:77-79` (`retainAudio`) passed as `retain_audio` at `:190`. Final file is `audio.mp3` (`crates/listener-core/src/actors/recorder/disk.rs:16`). |
| Click seeks and plays | `D/session/components/note-input/transcript/renderer/transcript.tsx:334` (`seekAndPlay`: `seek(...)` then `startPlayback()`, only if `audioExists && isTranscriptWordSeekable(word)`). |
| It is a **word**, not a line | `D/session/components/note-input/transcript/renderer/word-span.tsx:26` (`canSeek`) and `:38` (`onClick` on the `<span>` of one word; hover style at `:30`). |
| Playback is not gated; only speed is Pro | `D/audio-player/provider.tsx:378` (`if (!isPro && rate !== 1)`), `:394`. `D/audio-player/timeline.tsx:119`. |

**Correction to blueprint section 5/8 and features.md "Free claims" and F6:** both say "click a transcript line". It is a word. F6's "hover hint on the first line" should be "hover hint on the first word". Not run: confirm in the running app (gate step b).

### 2. Transcript editable? — Verified, with nuance

| Claim | Proof |
|---|---|
| Edit toggle, only after recording stops | `D/session/components/note-input/header-transcript.tsx:213-214` (`canEdit = sessionMode === "inactive" && hasTranscript && Boolean(onEditModeChange)`), toggled at `:217`, pressed state `:330`. |
| Text edit | `D/session/components/note-input/transcript/renderer/segment.tsx:136` renders `EditableSegmentText`, defined `:234`. Persist: `D/stt/queries.ts:748` (`updateTranscriptSegmentText`). |
| Speaker split / reassign | `D/stt/queries.ts:788` (`splitTranscriptSpeaker`, called `segment.tsx:366`), `:566` (`assignTranscriptSpeaker`, called `renderer/index.tsx:186` and `speaker-assign.tsx:78`). |
| "Delete words" | Nuance: there is no word-delete command. Deleting text blanks the word's `text` and keeps its timing (`D/stt/queries.ts:768-783`), so audio seek stays aligned. |

### 3. Mic and system separate end to end; level events — Corrected (disk format)

| Claim | Proof |
|---|---|
| Two sources, dual mode by default | `crates/listener-core/src/actors/mod.rs:19-34` (`ChannelMode::determine`: onboarding = `SpeakerOnly`, else `MicAndSpeaker`). |
| Dual-channel STT for the engines we ship | Apple Speech `crates/listener-core/src/actors/listener/adapters.rs:403-439` (`from_realtime_audio_dual`); Soniqo `:271-307`. |
| `channel` on every word | `crates/transcript/src/types/segment.rs:5-9` (`DirectMic = 0`, `RemoteParty = 1`, `MixedCapture = 2`). Stored in `transcripts.words_json` (`crates/db-app/migrations/20260710223922_canonical_data_model.sql:91`). Frontend reads `word.channel` (`D/stt/render-transcript.ts:115`, `D/stt/useRunBatch.ts:484`). |
| **"Stereo WAV on disk" is wrong** | `crates/listener-core/src/actors/recorder/chunks.rs:46,52,58` encodes `mic` and `speaker` into one stereo stream with `anlg_mp3::StereoStreamEncoder`. `recorder/disk.rs:152-160` writes a temp `audio.wav`, encodes to `audio.mp3`, then deletes the WAV. Separate `audio_mic.wav` / `audio_spk.wav` exist only in debug mode (`disk.rs:60-75`, `is_debug_mode()`). Final file: stereo **MP3**. |
| `AudioAmplitude {mic, speaker}` every 100 ms | `crates/listener-core/src/events.rs:67-71` (u16 each); throttle `crates/listener-core/src/actors/source/pipeline.rs:23` (100 ms); smoothing alpha 0.7 `:655`; emit `:697`. Forwarded to the webview as `CaptureDataEvent::AudioAmplitude` (`plugins/transcription/src/api.rs:178`, `:398`). Frontend: `D/store/zustand/listener/general-live.ts:504` calls `updateLiveAmplitude` (`D/store/zustand/listener/general-shared.ts:395-405`), which stores `live.amplitude = {mic, speaker}` clamped to 0..1 as `value / 1000`. |

**Corrections:** rate is 10 per second, not "about 30" (features.md F2). Value is smoothed RMS x 1000 clamped to 1, so normal speech sits around 0.02 to 0.2 and a meter needs gain. The store field `live.amplitude` already exists (`general-shared.ts:39,74`), so F2 needs no Rust and no new event. Also already emitted: `mic_dropouts` (`events.rs:81`) and `mic_isolated` (`events.rs:76`, true when the output is headphones, so the mic cannot hear Them).

### 4. CLI `mcp` finds the app DB; bundled CLI — Corrected (bundling, dev folder)

| Claim | Proof |
|---|---|
| Release folder is fixed `anarlog/`, not the bundle ID | `crates/storage/src/global.rs:6` (`RELEASE_APP_FOLDER = "anarlog"`), `:21-33` (`resolve_app_folder`: bundle ID only when `is_debug` or staging/nightly). Desktop uses it via `T/src/db.rs:196-203` (`desktop_db_dir`), file `app.db` (`T/src/db.rs:5`). A new bundle ID (`co.websiteformula.*`) lands in `anarlog/` on a release build. |
| Dev builds use the bundle-ID folder | Same `global.rs:21` (`is_debug`), so dev data is in `~/Library/Application Support/com.hyprnote.dev/` (base `T/tauri.conf.json:4`). The CLI cannot see it by default. |
| CLI default lookup | `apps/cli/src/db.rs:28-40` (`resolve_path`: `--db-path` / `ANARLOG_DB_PATH` (`apps/cli/src/cli.rs:26`), `--base` / `ANARLOG_BASE`, else default), `:49-80` (`anarlog/app.db`, then legacy `hyprnote/`, then `com.hyprnote.stable/`). `anarlog-dev` / `anarlog-staging` command names look in their bundle-ID folder (`:56-60`). So for dev: set `ANARLOG_DB_PATH` (works in the `env` block of `mcp.json`). |
| 11 MCP tools | `apps/cli/src/mcp.rs:42` onward: `list_meetings` (:53), `list_folders` (:74), `get_meeting` (:95), `get_meeting_transcript` (:116), `get_recurring_meeting_history` (:137), `export_meeting` (:158), `propose_summary_edit` (:179), `propose_memo_edit` (:209), `list_proposals` (:239), `get_proposal` (:260), `decline_proposal` (:281). Also resources (`:323-391`). `serve` at `:462`. |
| `mcp` subcommand | `apps/cli/src/cli.rs:100` (`Mcp`), `apps/cli/src/lib.rs:44-47`. It opens the DB **read-write** (`open_write`) and **without** the cloudsync extension (`crates/db-core/src/lib.rs:216-249`). Fine with sync off. |
| **"Upstream already bundles the CLI at `resources/cli/anarlog-cli`" is only half right** | The checked-in configs do **not** list it: `T/tauri.conf.json:49` (`externalBin: []`), `T/tauri.macos.conf.json:6-8` (only `binaries/check-permissions`). The release workflow adds it at build time: `.github/workflows/desktop_cd.yaml:191-193` (`cargo xtask prepare-binaries` then `scripts/sidecar.sh <conf> resources/cli/anarlog-cli`). `crates/xtask/src/prepare_binaries.rs:44-58` builds package `anarlog-cli` (binary `anarlog`, `apps/cli/Cargo.toml:6-8`) into `T/resources/cli/anarlog-cli-<triple>`. `T/resources/cli/` and `T/binaries/` are **empty** now. A local DMG has no CLI unless we run those two steps. |
| Where the sidecar lands and how it is found | Tauri places the external binary next to the app executable: `T/src/embedded_cli.rs:253-264` looks for `anarlog-cli` beside `current_exe()` (so `Contents/MacOS/anarlog-cli`), then `Resources/cli/anarlog-cli-<triple>` (`:266-275`). First launch auto-installs a symlink at `~/.local/bin/<command>` (`spawn_auto_install`, `embedded_cli.rs:111`, called `T/src/lib.rs:505`) pointing into `~/.anarlog-cli/`. `command_name_from_identifier` returns `"anarlog"` for any unknown bundle ID (`embedded_cli.rs:225-233`). `check_embedded_cli` (`T/src/commands.rs:133`) already returns `install_path`. |

### 5. What does `isPro` vs `isPaid` unlock? — Corrected (the list is longer, and unsafe to force blindly)

Source of truth: `packages/supabase/src/billing.ts:35-56`. `isPro` = effective `hyprnote_pro` entitlement (`:54`); `isPaid` = pro or `hyprnote_lite` (`:56`); `isLite` separate. Consumed through `useBillingAccess` (`D/auth/billing-context.ts:14-22`); the single place the value is built is `D/auth/billing.tsx:388-397` (`useMemo<BillingAccess>`), which is a smaller override point than the hook.

`isPro` gates (grep of all call sites):
- Playback speed: `D/audio-player/provider.tsx:378,394`, `timeline.tsx:119`.
- Dictionary: `D/settings/dictionary/index.tsx:33-38`. Dictation settings: `D/settings/dictation.tsx:25-63`.
- Pro app icons: `D/settings/appearance/app-icon.tsx:94`; Pro pages in open-note dialog `D/shared/open-note-dialog.tsx:371`.
- Editing the "Auto" summary prompt: `D/templates/auto-form.tsx:116,129,241,253`.
- **Also**: cloud sync settings `D/settings/sync/index.tsx:314,357,518,653`; team `D/settings/team/index.tsx:113,156`; automations `D/settings/automations/index.tsx:322,531,539`; cloud API `D/settings/developers/cloud-api.tsx:40,104`; Nango calendar providers `D/calendar/components/sidebar.tsx:242`, `calendar/components/oauth/provider-content.tsx:35,75`; billing page `D/settings/general/billing.tsx:502`; sidebar items `D/sidebar/settings.tsx:119`.

`isPaid` gates: LLM/STT providers with `requires_entitlement: pro` (the `anarlog` cloud provider) via `D/settings/ai/shared/eligibility.ts:45`, `D/settings/ai/llm/select.tsx:275,407`, `D/settings/ai/stt/select.tsx:280`, `D/ai/hooks/useLLMConnection.ts:131`; sharing `D/resource-sharing/share-dialog.tsx:234,272,322,333`; Google/Outlook connections `D/calendar/components/calendar-view.tsx:90`, `calendar/components/sidebar.tsx:125,232`; attachment sync `D/attachment-sync/lifecycle.tsx:26`; trial/upgrade flow `D/auth/billing.tsx:103-380`; todo integrations `D/settings/todo/*`.

**Correction to the plan:** forcing `isPro = true` also **un-gates** sync, team, automations, cloud API and Nango calendar screens (they show real UI instead of an upsell, then ask for a session). Those are all on the blueprint's Hide list, so hide them by removing their entry points, not by relying on the plan gate. Keep `isPaid` false: it only blocks the cloud provider and sharing, and own-key providers need only `api_key` (`D/settings/ai/llm/shared.tsx:89,105,121,...`).

**"Template auto-format = auto-applied templates?" — Verified: No.** The "Auto" format is one global prompt inferred from 1-3 example summaries (`D/templates/auto-format-inference.ts:28-49`), stored as `auto_summary_prompt` (`D/settings/schema.ts:268`) and applied to every Enhance (`D/store/zustand/ai-task/task-configs/enhance-transform.ts:237`). Template matching is only a *suggestion* by title regex on the empty note: `D/session/components/note-input/raw.tsx:61` (`contextualTemplateRules`), `:357` (`getSuggestedTemplates`). S1 has no head start.

### 6. Enhance records token usage? — Verified (No)

- Chunk loop handles only `error`, `reasoning-*`, `text-delta`: `D/store/zustand/ai-task/tasks.ts:385-405`. The `finish` chunk is dropped.
- Enhance streams with `streamText(...).fullStream`: `D/store/zustand/ai-task/task-configs/enhance-workflow.ts:164,172`. The SDK's `finish` part carries `totalUsage` (`ai` ^6.0.158, `D/package.json:100`; type in `node_modules/ai/dist/index.d.ts:2672-2675`), and `withEarlyValidationRetry` buffers and re-yields it (`D/store/zustand/ai-task/shared/validate.ts`), so it does reach `tasks.ts`.
- No storage: no `usage`/`token` column in `crates/db-app/migrations/`.
- Caveats the plan missed: (a) a validation retry aborts the first attempt, so its usage is lost (undercount); (b) the same loop also runs the title task (`task-configs/title-workflow.ts:33`), and other call sites bypass it (`chat/store/chat-title.ts:33`, `session/insights/pre-meeting.ts:312`, `session/insights/past-notes.ts:586`, `contacts/contact-summary.ts:263`); (c) Apple Intelligence reports unknown usage (`D/ai/apple-foundation-model.ts:70`); (d) the model object has `provider` and `modelId`, but price comes from the F1 catalog, so F5 cost depends on F1.

### 7. `cloudsync.dylib` loads with sync off? — Verified (with a fallback the plan missed)

- Always requested: `plugins/db/src/runtime/open.rs:21` (`app_db_open_options(storage, true)`), options at `:43-53`.
- Sync itself is off unless env is set: `T/src/db.rs:96-104` returns `None` unless `ANARLOG_CLOUDSYNC_ALLOW_STATIC_AUTH` is true; `T/src/lib.rs:235-243` treats errors as "CloudSync disabled". No server URL exists in the binary path.
- Packaged into `Contents/Frameworks`: `T/tauri.conf.json:77-79` (arm64 dylib at `crates/cloudsync/vendor/cloudsync/macos/aarch64/cloudsync.dylib`, 612 KB, Mach-O arm64, present). Located at runtime beside the executable: `crates/cloudsync/src/bundle.rs:178-184`.
- **Missed by the plan:** if the load fails, `open.rs:21-35` and `:67-90` retry without it and only error if the DB already has the cloudsync schema. So a missing dylib would not crash a fresh install, but ship it anyway (blueprint rule).
- The CLI opens the DB without cloudsync (`crates/db-core/src/lib.rs:216-249`); harmless while sync is off.

### 8. Onboarding catches a denied system-audio tap? — Verified (partly), with the exact mechanism

- TCC check is the real one in direct distribution: `T/Cargo.toml:115-116` (`direct-distribution` enables `private-tcc`); `T/tauri.conf.json:7` sets it (the base config is the Dev config, but stable/brand configs merge over it, so the feature carries). Check: `plugins/permissions/src/ext.rs:398-400` (`anlg_tcc::audio_capture_permission_status()`). Without the feature it would only probe (`:402-409`).
- Request: `plugins/permissions/src/ext.rs:552-558` (`play_silence`, `probe_speaker`). `probe_speaker` only builds a tap (`crates/audio-actual/src/lib.rs:273-279`, `speaker/macos.rs:53-55`), which can succeed while TCC is denied.
- **The ~1 s bug:** `D/shared/hooks/usePermissions.ts:77-79` sets an optimistic `"authorized"` the moment the request call returns, valid until the next status refetch (`:47` grace 1000 ms, `:68`; refetch `:80`). `D/onboarding/permissions.tsx:158-161` (`isComplete`) reads `status` (optimistic included), and `:115-129` (`ContinueWhenComplete`, `useMountEffect`) calls `onContinue` once, on mount. So the step can advance on a false "allowed" even if the user denied.
- No silence check on the system channel while recording (confirmed: only `mic_dropouts`, `events.rs:81`).
- Smallest fix: make `isComplete` use `confirmedStatus` (already returned by the hook, `usePermissions.ts:112`) instead of `status`. One-line change in `D/onboarding/permissions.tsx:158-161`; no change to the hook.
- Not run: macOS prompts cannot be driven from here; gate it in the second-user test.

## Part 2. Where the plan or docs are contradicted by the code

1. **Disk format is stereo MP3, not WAV** (Part 1, row 3). Matters for anything that reads the audio (Glaido, export). Mono per-channel files do not exist in release builds.
2. **"Click a line" is "click a word"** (row 1). Blueprint section 8, features.md free-claims table and F6 all say line.
3. **Level events are 10 Hz, not 30 Hz** and already live in `live.amplitude` (row 3). features.md F2 "about 30 times a second" is not needed and not achievable without a Rust change (forbidden).
4. **The CLI is not in the checked-in bundle config** (row 4). The plan's "do not add a new `externalBin`" is true only if the build runs `prepare-binaries` plus `sidecar.sh`; otherwise there is nothing to point Glaido at. Plan Prompt A item "three sidecars" is also over-broad for a local DMG: `char-chrome-native-host` is added only by CI (`desktop_cd.yaml:191`), not by `T/tauri.macos.conf.json`; the dev/local build needs `check-permissions` (always) and the CLI (for F4).
5. **Forcing `isPro` un-gates sync, team, automations, cloud API, Nango calendars** (row 5). Hide their entry points.
6. **Release DB folder is `anarlog/` for every non-staging/nightly bundle ID** (row 4). Our fork shares `~/Library/Application Support/anarlog/` (DB, settings, store, vault config) with a real Anarlog install on the same user. Fine for the judge's clean second user; on Adam's own Mac, the release build would read and migrate a real Anarlog database. Test the DMG only in the second user, and keep the dev build (own `com.hyprnote.dev` folder) for daily work.
7. **No default LLM provider is set** (`D/settings/schema.ts:293-300`; `D/session/enhance-config.ts:1-20` shows the config-error screen for `missing_provider`). `configurePaidSettings` (`D/shared/config/configure-paid-settings.ts:7`) sets the hosted default only after a paid sign-in. With sign-in hidden, a fresh install cannot Enhance until a provider is chosen. F3 must write a first-run default.
8. **Blueprint `Provider` ids do not match upstream ids.** Upstream: `google_generative_ai` (not `google`), `apple_foundation` (not `apple`) (`D/settings/ai/llm/shared.tsx:162,656`). Also OAuth "subscription" providers (`claude`, `chatgpt`, `grok`, `github_copilot`, `kimi_code`, `:82-146`) exist; they are not in the seven and should be hidden.
9. **F4 mcp.json location:** features.md puts it at `~/Library/Application Support/[App]/glaido/`. The app's own data folder is `anarlog/` in release (row 4). Glaido imports any folder, so use a brand-named folder for the Glaido files and leave `anarlog/` alone.
10. **Banner logic in F2:** "Them silent for 10 s" alone will false-alarm when the other side simply pauses. Combine with the permission state (`usePermission("systemAudio")`, not `authorized`) or `mic_isolated`; use pure silence only as a softer hint.
11. **F5 cost is not "exact" even with the `finish` chunk** (row 6 caveats), and F1's catalog must supply the price.
12. **Retry already exists** (F6): "Re-transcribe" at `D/session/components/note-input/transcript/screens/empty.tsx:49-52,115-118` and `header-transcript.tsx:283`, plus an `interrupted.tsx` screen. Do not build a new Retry.

Non-contradictions confirmed: AudioAmplitude event shape; mic/system separation through STT; CLI default `anarlog/` lookup for release; dylib always requested; the `finish` chunk ignored; auto-format is not template matching.

## Part 3. Per-feature sections

Common "must not touch" for every feature (CLAUDE.md and blueprint section 5): audio capture (`crates/audio-actual`, `crates/listener-core`, `plugins/listener`, `plugins/transcription`, `plugins/permissions` Rust), transcription engines, `crates/cloudsync` and `cloudsync.dylib`, `crates/storage` (including `RELEASE_APP_FOLDER = "anarlog"` at `global.rs:6`), `apps/cli/src/db.rs` lookup order, LICENSE files, every `@anlg/*` and `anlg-*` name, dependency versions. No keys in repo, build or bundle. Frontend-only changes wherever possible.

### F1. Always-current model picker

- **Entry files:**
  - `D/settings/ai/shared/list-common.ts` (`isOldModel` at `:209-249`; `ListModelsResult`/`ModelMetadata` types at `:22-30`; `sortModelsByRecency`; `partition` at `:299`).
  - Per-provider listers: `list-anthropic.ts`, `list-openai.ts`, `list-google.ts`, `list-openrouter.ts`, `list-ollama.ts`, `list-lmstudio.ts`, `list-apple-foundation.ts` (same folder).
  - Dispatcher and UI: `D/settings/ai/llm/select.tsx:572-640` (`listModelsFunc` switch), `D/settings/ai/shared/model-combobox.tsx:77`.
  - Provider list: `D/settings/ai/llm/shared.tsx:65-715`, exported sorted at `:720`.
  - Saved-model-vanished handling: `D/settings/ai/shared/persist-selection.tsx`, `selection.ts`, `D/settings/ai/llm/selection.ts`.
- **Smallest diff:**
  - Add one new file `D/settings/ai/shared/model-catalog.ts`: fetch models.dev `api.json` (backup OpenRouter `/api/v1/models?sort=newest`), cache with a timestamp (`localStorage` is enough), import bundled `models.fallback.json`. Extend `ModelMetadata` with optional `releasedAt`, `family`, `deprecated`, `thinking`, `contextWindow`, prices.
  - Keep `isOldModel` as the last-resort fallback; make it consult the catalog first. Do not rewrite the seven listers; add the catalog join after `partition`.
  - Fetch with the existing `providerFetch` (`D/ai/provider-fetch.ts`, wraps `@tauri-apps/plugin-http`); the capability already allows `https://**` (`T/capabilities/default.json:97-113`), so no capability change and no CORS.
  - Trim to seven providers by an allow-list filter at `shared.tsx:720` (hide, do not delete). Upstream ids: `anthropic`, `openai`, `google_generative_ai`, `openrouter`, `ollama`, `lmstudio`, `apple_foundation`.
  - New badge, "More models" fold and "Show previews" toggle go in `model-combobox.tsx` (Features builds unstyled, Design styles after).
- **Tests:** extend `list-common.test.ts` and the per-provider tests for merge, sort, family collapse and fallback.
- **Do not touch:** the OAuth subscription modules in `D/settings/ai/llm/subscriptions/` (hide only), crates, anything under audio or STT. Model ids in the catalog are API ids; never rewrite stored provider ids.

### F2. Capture health

- **Entry files:**
  - Data: `D/store/zustand/listener/general-shared.ts:39,74,395-405` (`live.amplitude`), `general-live.ts:504`. Zero Rust.
  - Meters: `D/session/components/note-input/header-transcript.tsx:139-175` (currently one `hypot(mic, speaker)` waveform), `D/session/components/note-input/transcript/screens/listening.tsx`, `D/sidebar/timeline/item.tsx:803`.
  - Banner: render beside the transcript header or in `D/session/components/session-surface.tsx`; reads `useListener((s) => s.live.amplitude)` and `usePermission("systemAudio")` (`D/shared/hooks/usePermissions.ts`), whose `.open()` already opens the right System Settings pane.
  - Onboarding: `D/onboarding/permissions.tsx:115-129,158-196`.
- **Smallest diff:**
  - Two small meter components reading `live.amplitude.mic` and `.speaker`; apply gain or sqrt scaling because values are RMS x 1000 / 1000 (typical speech 0.02 to 0.2).
  - Banner hook: speaker below a small threshold for 10 consecutive seconds while `status === "active"` **and** system audio is not `authorized` (hard banner), otherwise a quiet hint. Reuse the 1 s tick pattern in `tickTranscriptionStallWatchdog` (`general-shared.ts:305-335`).
  - Onboarding: switch `isComplete` to `confirmedStatus` (`onboarding/permissions.tsx:158-161`) to close the ~1 s false-allowed window; the 10-second test can reuse the same meters.
- **Do not touch:** `crates/listener-core` (pipeline.rs amplitude code, events.rs), `crates/audio-actual`, `plugins/permissions` Rust, `ChannelMode`, `crates/tcc`. If a Rust change ever looks necessary, stop and ask.

### F3. Summaries without a key

- **Entry files:**
  - Provider entries: `D/settings/ai/llm/shared.tsx` (new "demo" entry using an OpenAI-compatible `baseUrl`; model on `custom` at `:674`). Own-key paths already exist and need only `api_key` (`openrouter` `:261`, `anthropic` `:555`).
  - Apple default: `apple_foundation` entry `:162-170` (`checkAppleFoundationModelAvailability`), `D/settings/ai/shared/list-apple-foundation.ts`, `D/ai/apple-foundation-model.ts`.
  - First-run default: new tiny function modelled on `D/shared/config/configure-paid-settings.ts:7-60` (`getStoredSettingValues` / `setSettingValues` from `D/settings/queries.ts`), called once at startup or on the first Enhance attempt.
  - Worker: new `proxy/` directory outside `apps/` (no build coupling).
- **Smallest diff:** choose Apple Intelligence if available, else "demo" if reachable, else leave unset and show the existing paste-a-key screen (`D/session/components/note-input/enhanced/config-error.tsx`). Hide the `anarlog` cloud provider (`shared.tsx:68`, which needs auth plus Pro and builds its URL from `env.VITE_AI_API_URL`).
- **Do not touch:** `isPaid` (keep false); `crates/llm-proxy`; no key in `.env`, `tauri.conf`, the bundle or the repo (run gitleaks).
- **Risk:** Apple foundation reports unknown usage (`D/ai/apple-foundation-model.ts:70`), so those runs show as cost "≈ 0" in F5.

### F4. Glaido bridge

- **Entry files:**
  - UI: `D/settings/developers/cli.tsx` (existing CLI install UI that already calls `installEmbeddedCli`/`checkEmbeddedCli`) or `D/settings/general/index.tsx` for a Beta toggle.
  - Write and reveal: `@anlg/plugin-fs2` `write_text_file` (`plugins/fs2/src/commands.rs:27`, creates parent folders) and `@anlg/plugin-opener2` `reveal_item_in_dir` (`plugins/opener2/src/commands.rs:31`); both are already allowed (`T/capabilities/default.json:76,79`). **No Rust change.**
  - CLI path: `commands.checkEmbeddedCli()` returns `install_path` (`T/src/commands.rs:133`, `T/src/embedded_cli.rs:225-250`); alternative is `Contents/MacOS/anarlog-cli` beside the app executable.
  - Build: `crates/xtask/src/prepare_binaries.rs:44-58`, `scripts/sidecar.sh`, `.github/workflows/desktop_cd.yaml:191-193`.
- **Smallest diff:**
  - One component writing `mcp.json` with `command` = absolute CLI path, `args: ["mcp"]`, and for dev builds `env: {"ANARLOG_DB_PATH": ".../com.hyprnote.dev/app.db"}`. Release builds need no env var.
  - `toolApproval`: `auto` for `list_meetings`, `list_folders`, `get_meeting`, `get_meeting_transcript`, `get_recurring_meeting_history`, `export_meeting`, `list_proposals`, `get_proposal`; `deny` for `propose_summary_edit`, `propose_memo_edit`, `decline_proposal`. (features.md omits `list_proposals`/`get_proposal`.)
  - Release session must run `prepare-binaries` then `sidecar.sh` on the brand conf, and ad-hoc sign the sidecar.
  - Folder for the Glaido files: brand-named, not `anarlog/` (Part 2, item 9).
  - Rebrand note: the auto-installed symlink is `~/.local/bin/anarlog` (unknown bundle IDs map to `"anarlog"`, `embedded_cli.rs:225-233`). It is outside the rebrand-check scope but user-visible in a terminal; also it collides with a real Anarlog install. Prefer pointing Glaido at the bundle path and leaving this alone, or set the brand name in `command_name_from_identifier` (Rebrand lane decision).
- **Do not touch:** `apps/cli/src/db.rs` lookup, `crates/storage` folder name, the `mcp` tool set, `crates/db-core`. The CLI opens read-write (`lib.rs:44-47`), so do not run it against a DB while a destructive desktop operation is in progress; the `propose_*` tools write proposals only.

### F5. Home stat cards

- **Entry files:**
  - Home surface: `D/main/empty.tsx` (`TabContentEmpty`, `EmptyView` at `:27`); there is no separate home route (`D/routes/app/main/_layout.index.tsx`).
  - Data pattern: `useLiveQuery({sql, mapRows})` from `~/db` (example `D/settings/queries.ts:67-72`).
  - Tables: `transcripts.words_json` (word `start_ms`, `end_ms`, `channel`; 0 = You, 1 = Them) and `speaker_hints_json`; `session_documents` with `kind IN ('summary','template_output')` (`D/session/queries/enhanced-notes.ts:41`); `sessions` (`started_at`, `ended_at`, `deleted_at`) (`crates/db-app/migrations/20260710223922_canonical_data_model.sql:34-98`).
  - Cost: capture usage at `D/store/zustand/ai-task/tasks.ts:385-405` (add a `finish` branch reading `chunk.totalUsage`) and write it to a tiny local ledger (settings table or `localStorage`) before `onSuccess` (`:428-445`). Price from the F1 catalog.
- **Smallest diff:** one new `D/home/` folder (stats queries plus three cards), rendered inside `EmptyView`; no new Rust, no migration. Compute talk share and wpm in JS from `words_json` for the last 7 days (bounded rows). If usage capture slips, show "≈" with chars/4 as the blueprint says.
- **Do not touch:** transcription output shape, `crates/db-app` schema or migrations, `generation_metadata_json` conventions used by chat records. Note a validation retry loses the aborted attempt's usage and Apple runs report unknown usage; label the line "≈" either way.

### F6. "Your audio is safe"

- **Entry files:**
  - Note header: `D/session/components/note-input/header-transcript.tsx` (already reads `audioExists`, `deleteRecording` from `AudioPlayer.useAudioPlayer()` at `:205-211`).
  - Retention text and link target: `D/settings/general/audio-settings.tsx`, `D/settings/general/index.tsx:185,345` (`audio_retention`), `D/services/audio-retention-policy.ts`.
  - Hover hint: `D/session/components/note-input/transcript/renderer/word-span.tsx:38` (first word only).
- **Smallest diff:** one text line in the header driven by `audioExists` and the retention value. Retry already exists (`transcript/screens/empty.tsx:49-52,115-118`, `header-transcript.tsx:283`); verify, do not rebuild.
- **Do not touch:** the recorder and retention cleanup (`D/services/audio-retention.ts`, `crates/listener-core/src/actors/recorder/*`, `crates/fs-sync-core/src/audio`). Do not claim "never deleted": retention options include 1 day to 1 month and "none" (`audio-retention-policy.ts:1-10`).

### S1. Style rules that apply themselves (stretch)

- **Entry files:** `D/templates/auto-form.tsx` and `auto-format-inference.ts` (global Auto prompt only), `D/session/components/note-input/raw.tsx:61,357` (title-regex suggestions), `D/session/components/note-input/template-picker.tsx`, `sessions.event_json` for attendee domains.
- **Verdict:** no head start (Part 1, row 5); this is a new feature. Pick S2 or nothing, as the plan says.
- **Do not touch:** the Auto prompt storage key `auto_summary_prompt`; calendar sync.

### S2. Model Duel (stretch)

- **Entry files:** `D/services/enhancer/index.ts` (Enhance orchestration, task ids at `:447,458`), `D/store/zustand/ai-task/tasks.ts:283` (`generate(taskId, config)` takes any `LanguageModel`, so a second model is just a second task id), `D/session/components/note-input/enhanced/index.tsx`, `D/ai/hooks/useLLMConnection.ts`.
- **Smallest diff:** run `generate` twice with two connections, render both streams side by side, show seconds and tokens from the F5 usage hook. Do not persist the losing note.
- **Do not touch:** the persisted enhanced note path (`persistGeneratedEnhancedNote`, `D/session/content-mutations.ts`), which must still write exactly one note.

## Open items for the running app (cannot be settled by reading)

1. Click a word, hear it (gate step b).
2. Denied system audio in the second user: does onboarding advance, and does the speaker meter stay at zero?
3. A fresh release build in the second user: confirm the data folder is `anarlog/` and the `check-permissions` sidecar is present.
4. `anarlog-cli mcp` against that DB: `list_meetings` returns the test meeting.
