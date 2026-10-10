# Release blockers: what Upshot can never ship with, and how we find them

Goal: a market-ready Upshot has **zero open S1 bugs** and **zero open S2 bugs in the core loop** (sign in, record, Stop, transcript, summary, chat). Every change and every night is checked against this list. Open items live in `grandmaster/sops/bug-ledger.md`.

## Where the levels come from

- Mozilla (Firefox bug severity): S1 "catastrophic" = data loss, crashes with data loss, no workaround, many users; S2 "serious" = major function impaired with no good workaround, or would make a user switch products; crashes default to S2. firefox-source-docs.mozilla.org/bug-mgmt/guides/severity.html
- Chromium release blockers: "Critical" = privacy leak of user data, loss of user data, crash on startup; these block every release. Lesser bugs block by severity × how many users they hit. chromium.googlesource.com/chromium/src/+/HEAD/docs/process/release_blockers.md
- Apple App Review 2.1 (App Completeness): builds that crash, show obvious technical problems, placeholder content or dead links are rejected. developer.apple.com/app-store/review/guidelines/#app-completeness
- Google Play vitals: a user-perceived crash rate above 1.09% (or ANR above 0.47%) is "bad behavior". We use it as our crash budget. developer.android.com/vitals
- Recording law: Otter.ai (N.D. Cal. 2025) and Chamberlain v. Granola (N.D. Cal., July 30, 2026) are wiretap class actions against bot-free notetakers; all-party-consent states and the GDPR make missing notice and silent model training a legal risk. Not legal advice; a lawyer checks the terms (launch-gates.md, gate 4).

Rule (Chromium's): use "blocker" only when the product must not ship with the bug, never to draw attention.

## The levels, for Upshot

### S1: never ship (fix before anything else, even mid-feature)

1. **Data loss or corruption.** A note, recording, transcript, summary, folder, template or setting is lost, overwritten, mixed up between notes, or unreadable. Includes: a database migration that fails or drops rows, an import that overwrites, Undo that does not undo, sign-out or update that removes local data.
2. **Silent recording failure.** Upshot shows "Recording" but captures nothing, stops without saying so, or Stop loses the audio. A failed transcription that is not retried or explained.
3. **Crash or hang at startup or in the core loop.** The app does not open, opens blank, crashes on record, Stop, summary or chat, or freezes the window for more than 5 seconds. After an update the app does not open.
4. **Privacy and security.** User data or audio goes anywhere the privacy policy does not say; a key, token or secret is in the bundle, the logs or a URL; one account can read or spend another's data; the Worker can be used without an account or past its limits; recording without the visible recording indicator; anything trains a model on user data.
5. **Money.** A wrong or double charge, Pro not given after payment, Pro given without payment, cancel impossible.
6. **Locked out.** Google or Microsoft sign-in cannot finish, onboarding has a dead end, or a signed-in user is told to sign in in a loop.
7. **Install and update.** An installer does not install or open (beyond the documented unsigned-app step), an update fails to apply or breaks the app, the update feed or signature is wrong, a release mixes files from different commits.
8. **Legal must-haves.** Credits for Anarlog (MIT) and sqlite-sync (ELv2) missing; privacy policy or in-app text promising something the app does not do.

### S2: blocks a release when it hits the core loop or most users

- A main feature broken with no workaround (summary, chat, transcript, search, folders, templates, calendar, import).
- A crash outside the core loop, or a crash rate above the 1.09% budget.
- The main path broken on Windows or Linux (Upshot ships on all three; not-everyone-uses-a-mac).
- Wrong or misleading error text on a blocker path (for example "Sign in" when the server is down).
- Accessibility: a core-loop control that a keyboard or VoiceOver cannot reach.

### S3 and S4: fix in normal work, never block

S3: a feature works with a workaround, or a rare edge case. S4: cosmetic, wording, spacing, color.

## The sweeps

| Sweep | When | What |
|---|---|---|
| A. Change check | Every feature or fix, before its commit | `/code-review high` on the diff; tests for each fixed bug; the S1 list for the areas touched; an in-app test of the changed flow (scripts/test-tools/README.md). |
| B. Nightly sweep | Every night (scheduled task "upshot-blocker-sweep") | 1) Review every commit since the last sweep (the ledger's "last swept commit") for S1 and S2, all sessions' work included. 2) Then take the next deep audit from the queue below. Fix clear S1/S2 bugs with small diffs and tests; log the rest. |
| C. Deep audits | Worked through by the nightly sweep, one per night, repeated before each release | Whole-codebase audit of one S1 class, not just new diffs. |
| D. Release gate | Before every publish | Zero open S1; zero open core-loop S2; full in-app main path in light and dark on Apple silicon; Intel under Rosetta; Windows and Linux run screenshots; key scan 0 on every file; one commit for all files; update feed checked after publishing. Adam publishes. |

### Deep audit queue (C)

Each audit reads the code paths for its class end to end, writes probes or tests that try to break them, and lists what it checked.

1. **Data safety:** database writes and migrations, Undo, delete, import, sync, sign-out, crash during a write. Probe: kill the app mid-recording and mid-save, then reopen.
2. **Recording reliability:** start, Stop, resume, mic or device change, sleep and wake, network drop, long meetings (meeting pass), audio file kept when transcription fails.
3. **Startup and update:** clean install, first run, an old profile from 1.0.0, update 1.0.x to the next version from a local feed, a missing or broken settings file.
4. **Privacy and security:** every network call from the app (what leaves, to where), Worker auth on every route, rate limits, secrets in bundle and logs, the privacy policy against real behavior, recording indicator.
5. **Money:** checkout, webhook, Pro status, cancel, refund, deleted account, test and live keys.
6. **Sign-in:** Google, Microsoft, cancel, wrong account, expired and revoked sessions, offline, Worker or Supabase down.
7. **Windows and Linux:** the main path in the cloud run, platform-only code (paths, shortcuts, audio), copy that assumes a Mac.
8. **Crash budget:** unwraps and panics on user-reachable Rust paths, unhandled promise rejections in the app, error boundaries.

When a new feature lands, the nightly sweep adds an audit line for it if it touches an S1 class.

## How a sweep works (rules for the session that runs it)

- Read this file, `bug-ledger.md`, `scripts/test-tools/README.md` and the newest handoff first.
- Fix only clear S1/S2 bugs with small diffs, each with a test that fails before the fix. Never re-architect; never touch audio capture or transcription internals without Adam's OK (CLAUDE.md).
- Checks before each commit: vitest, tsc, rebrand-check, Worker `node test.mjs`, the Rust tests of touched crates. Use Node 22 or later (`PATH=/usr/local/bin:$PATH`).
- Commit explicit paths only (other sessions work in the same folder); push with `grandmaster/scripts/push.sh`.
- In-app tests only on a throwaway HOME, never while Adam's real Upshot runs (test-copy-single-instance), never during a Keynote slideshow, and only one `release.sh` at a time.
- Never publish, never deploy the Worker, never merge or change other sessions' uncommitted files. Worker changes wait in the ledger under "Adam: deploy".
- Anything needing Adam (decisions, deploys, sign-in consent, legal) goes in the ledger's "For Adam" list in plain words.
- Update the ledger: last swept commit, what was checked, what was fixed (with commit), what is open (S1/S2, file:line, how found).
