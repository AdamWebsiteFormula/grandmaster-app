# Onboarding fixes (from Adam's first run, Oct 2)

Every friction point Adam hit in the gate test. Goal: a judge goes from install to first enhanced note in under 2 minutes with zero hunting.

| # | What happened | Fix |
|---|---|---|
| 1 | Window opened hidden / off the top of the screen | Center and show the main window on first launch (plugins/windows) |
| 2 | Loud looping onboarding music; small mute icon | Remove the BGM, or start it muted (onboarding/index.tsx:130) |
| 3 | Account step opened a browser to localhost:3000 → error page; "Skip" was not obvious | Hide the account step (no sign-in in this app) |
| 4 | Calendar step adds a step nobody needs for the demo | Make it skippable by default or move it to Settings |
| 5 | No transcription provider preselected; "Transcription provider needed" box | Preselect Apple Speech on first run |
| 6 | Apple Speech download hung on "Downloading apple-speech" | Retry or re-check AssetInventory.status after install; show progress |
| 7 | Anthropic key rejected though valid | FIXED: provider-fetch.ts strips Origin for all hosts |
| 8 | Default LLM was Apple Intelligence; long provider list (Copilot, Cohere, Fireworks…); "Connect Claude" confusing | KEEP all providers (Adam, Oct 2). Make the first-run path clear: one "Paste your API key" step; "Set as current" automatic after a valid key |
| 9 | Locked items in Settings (Teams, Sync, Dictation, Dictionary…) | Hide them (per blueprint) |
| 10 | No obvious "New note / Record" button; only ⌘⇧N works | One visible "Record" button on the main screen |
| 11 | Demo meeting is a stranger's video; unclear what to do; "Join & record" vanishes after one use | Replace with a short guided first recording, or explain the demo in one line |
| 12 | Enhance summary ended mid-markdown ("**Settings →") | Cause not proven (logs lost). Only silent-truncation path found: tasks.ts saves partial text after a 15 s stream pause, on purpose (upstream test tasks.test.ts:349). Added a console.warn there. If it repeats, grep the dev log for "[ai-task] stream idle" |
| 13 | Permission row can show "allowed" for ~1 s before the real check | Fix per sops/features.md (onboarding/permissions.tsx:158) |
| 14 | Dev only: macOS permission prompts named "Claude" | Not an issue in the release DMG |
