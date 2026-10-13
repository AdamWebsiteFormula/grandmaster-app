# Bug ledger (release blockers)

Levels and rules: `release-blockers.md`. The nightly sweep updates this file; any session that finds an S1 or S2 adds it here.

## State

- Last swept commit: a853ed1611 (Oct 12 sweep)
- Next deep audit: 2. Recording reliability
- Released: v1.0.1 (commit 79ed048)

## Open S1

(none known)

## Open S2

(none known)

## For Adam

(none)

## Adam: deploy

(none)

## Sweep log

- Oct 8–10: bug sweep of 5b3d36d..HEAD (`bug-sweep-oct8.md`): 12 bugs found, 12 fixed; Worker deployed twice by Adam; 1.0.1 published.
- Oct 12: sweep of 974dad82a5..a853ed1611 (9 commits; `/code-review high`): no S1/S2 (3 S3/S4 notes: a create already running can drop a "record" request, `shared/useNewNote.ts:15`; error routing by translated text, `templates/auto-format-examples-dialog.tsx:67`; recording-bar tooltips not translated). Deep audit 1, data safety: database, migrations, delete and Undo, empty-note cleanup, audio retention, folders, templates, imports, legacy cleanup, transcript Undo, sign-out, settings and store files, write queue. Fixed: S1 Undo restored a note without its audio (45deba6e97); S1 closing the tab of a recorded note with a failed transcription deleted it (5b8cbca594); S2 folder LIKE matching mixed folders, subfolder rows left behind on rename, "clients" next to "Clients" shared one disk folder (6a1a4663b0). In-app test on an empty throwaway HOME: "clients" next to "Clients" refused. Not tested in the app (needs a recording): the two S1 fixes; covered by a db-app test on real SQLite (audio) and a unit test (tab close). Low-confidence, not filed: `crates/storage/src/fs.rs:19` async atomic write does not fsync before rename. Checks: vitest 5055 passed, tsc 0, rebrand-check 0, Worker 73/73, db-app 263/263, plugin-session folder tests; live Worker /health 200, chat and /stt/listen 401 sign_in_required.
- Oct 12 (later): Adam approved the audio retention fix. Fixed S2: retention counted from the note, not the audio, and deleted audio with no transcript under timed settings (ad3ccd0689). Tests: transcription plugin 52/52, db-app 264/264, vitest 5058 passed, tsc 0, rebrand-check 0, Worker 73/73. Not tested in the app (needs a non-default retention setting and an imported recording). Adam: drop the nightly-task permission item.
