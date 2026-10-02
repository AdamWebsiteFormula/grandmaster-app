# Onboarding fixes (from Adam's first run, Oct 2)

Every friction point Adam hit in the gate test. Goal: a judge goes from install to first enhanced note in under 2 minutes with zero hunting.

| # | What happened | Fix |
|---|---|---|
| 1 | Window opened hidden / off the top of the screen | Center and show the main window on first launch (plugins/windows) |
| 2 | Loud looping onboarding music; small mute icon | DONE: starts muted; music plays only after the speaker button (onboarding/index.tsx) |
| 3 | Account step opened a browser to localhost:3000 → error page; "Skip" was not obvious | DONE: login step removed from STEPS_MACOS (onboarding/config.tsx) |
| 4 | Calendar step adds a step nobody needs for the demo | DONE: calendar step removed from onboarding (its Google/Outlook buttons led to sign-in); still in Settings |
| 5 | No transcription provider preselected; "Transcription provider needed" box | DEFERRED: Apple Speech needs macOS 26+ (app allows 15) and an asset download; a silent default could break STT. Do with a first-run check + download, test on a clean account |
| 6 | Apple Speech download hung on "Downloading apple-speech" | Retry or re-check AssetInventory.status after install; show progress |
| 7 | Anthropic key rejected though valid | FIXED: provider-fetch.ts strips Origin for all hosts |
| 8 | Default LLM was Apple Intelligence; long provider list (Copilot, Cohere, Fireworks…); "Connect Claude" confusing | KEEP all providers (Adam, Oct 2). Make the first-run path clear: one "Paste your API key" step; "Set as current" automatic after a valid key |
| 9 | Locked items in Settings (Teams, Sync, Dictation, Dictionary…) | Hide them (per blueprint) |
| 10 | No obvious "New note / Record" button; only ⌘⇧N works | One visible "Record" button on the main screen |
| 11 | Demo meeting is a stranger's video; unclear what to do; "Join & record" vanishes after one use | Replace with a short guided first recording, or explain the demo in one line |
| 12 | Enhance summary ended mid-markdown ("**Settings →") | Cause not proven (logs lost). Only silent-truncation path found: tasks.ts saves partial text after a 15 s stream pause, on purpose (upstream test tasks.test.ts:349). Added a console.warn there. If it repeats, grep the dev log for "[ai-task] stream idle" |
| 13 | Permission row can show "allowed" for ~1 s before the real check | DONE: isComplete uses confirmedStatus; tests updated + new test for the optimistic case |
| 14 | Dev only: macOS permission prompts named "Claude" | Not an issue in the release DMG |
