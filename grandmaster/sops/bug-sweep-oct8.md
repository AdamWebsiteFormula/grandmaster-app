# Bug sweep, Oct 8 (5b3d36d..HEAD)

Scope: every change since 5b3d36d, the last release tested in the app (78 commits, app and Worker): required sign-in with Google and Microsoft, the Worker account check, Connect calendar and its Worker switch, the Granola import change, and the picture-review UI rounds.

## Checks

| Check | Result |
| --- | --- |
| vitest (apps/desktop) | 561 files, 4,978 tests pass, 11 skipped |
| tsc --noEmit | 0 errors |
| rebrand-check | 0 |
| Worker test.mjs | 69 tests, 0 fail |

Note: the shell's default Node is 20.20. Vitest and pnpm need Node 22 or later (`node:fs` globSync). Use `/usr/local/bin` (Node 24) or `~/.local/bin` (Node 26) first in PATH.

## Findings, ranked

How found: CR = code review of the range (`/code-review high`); LIVE = a request to the live Worker; GRANOLA = a real call to Granola's MCP; APP = the built app on a test profile.

1. **Fixed. Granola import puts UK and EU meetings on import day.** `apps/desktop/src/imports/parser.ts:163`. Granola's MCP answers with tagged text whose only date is `date="Oct 5, 2026 12:00 PM BST"`; there is no `created_at`. JavaScript reads only US zone names, so BST, CEST, IST and most others gave no date, and `queries.ts:298` used "now". Found: CR, then GRANOLA (`list_meetings` and `get_meetings` have no other date field) and Node (`new Date("… BST")` is Invalid Date). Fix: read Granola's date parts and a known zone's offset; an unknown zone is read as this computer's time. Tests: EDT, BST, CEST, IST and an unknown zone.
2. **Fixed (Oct 9). Live transcription could stop after about an hour.** `crates/listener-core/src/actors/session/supervisor/children.rs:144`, `apps/desktop/src/stt/useStartListening.ts:124`. The app passes the Upshot access token (about one hour) once, at start. When the connection drops and the listener reconnects, it reuses that token; the Worker now rejects an expired token with 401. Found: CR. Fix: a meeting pass. When recording starts, the app asks the Worker (`POST /stt/pass`) for a sealed pass that works only for transcription and lasts 3 hours; reconnects reuse it. Practice: Deepgram and AssemblyAI check a token only when a stream opens, and AssemblyAI's streaming token allows a session of up to 3 hours; an expired JWT is never accepted (RFC 7519). No transcription code changed: the app part is `getUpshotSttPass` in `upshot-plan/session.ts`, used by `useStartListening.ts`. Without a pass (offline, older Worker) the app sends the access token as before.
3. **Open. A signed-in user can be told "Sign in to use Upshot AI".** `apps/desktop/src/upshot-plan/session.ts:503`. The app turns every Worker 401 into the sign-in message but keeps the session. Causes: the session was revoked on the server, or item 4. Found: CR.
4. **Open. A Supabase outage reads as "not signed in".** `grandmaster/worker/src/auth.js:505`. `getUser` returns null for any Supabase error (5xx, 429), so chat and transcription answer 401 "Sign in … Download the new Upshot" instead of "try again". Found: CR.
5. **Fixed (Oct 9). Old apps could still sign in with email and password.** `grandmaster/worker/src/auth.js:474`. `/auth/signup` answers 410 with the download link, but `/auth/login` still signs in password accounts. The old app then showed "signed in" while every AI call said "Sign in to use Upshot AI…". Found: CR and LIVE. Fix: `/auth/login` answers 410 like `/auth/signup`: "Upshot now signs in with Google or Microsoft. Use the same email to keep your account and plan. Download the new Upshot: … No Google or Microsoft email? Write to adam@websiteformula.co." Supabase links a Google or Microsoft sign-in to the account with the same confirmed email, so nobody signs up again.
6. **Open. Connect calendar can switch the signed-in account.** `apps/desktop/src/upshot-plan/session.ts:365`. Connect calendar runs a full sign-in and saves the session it gets back. If the person picks another Google or Microsoft account at consent, Upshot is now signed in as that account. Calendar is switched off on the Worker today, so nobody can hit this yet. Found: CR.
7. **Open. Sign out during a token refresh can sign back in.** `apps/desktop/src/upshot-plan/session.ts:395`. A refresh that finishes after Sign out saves the new session. Rare. Found: CR.
8. **Open. Calendar routes crash on a Supabase error.** `grandmaster/worker/src/calendar.js:363`. `connectionsFor` throws, nothing catches it, and the Worker answers a non-JSON 500. Calendar is switched off today. Found: CR.
9. **Open. The Granola tag reader stops at a child tag with attributes.** `plugins/importer/src/connected_mcp.rs:759`. A child like `<transcript speaker="x">` never finds its close tag, so the rest of that meeting's fields are lost. Granola does not send such a tag today. Found: CR.

## Old builds and the Worker (LIVE, Oct 8, 11:19 PM)

Requests to the live Worker as a signed-out old app sends them:

- Chat, no token: 401 "Sign in to use Upshot AI and transcription. It's free. Don't see Sign in? Download the new Upshot: https://github.com/AdamWebsiteFormula/grandmaster-app/releases/latest"
- Transcription, file and live (WebSocket upgrade), no token: the same 401 and text.
- Create account (`/auth/signup`): 410 "Upshot now signs in with Google or Microsoft. Download the new Upshot: …/releases/latest"
- Sign in with a password (`/auth/login`): 410 with the message in item 5 (live from Oct 9, Worker version dc3d8ee7).

10. **Open, small. The browser page says "Connected successfully" after a sign-in.** `plugins/deeplink2/src/server/mod.rs` (`ui_content`). The Google or Microsoft sign-in returns a `code`, and the page for any code says "Connected successfully. Returning to Upshot to finish connecting." That page is meant for Connect calendar. It shows even when the code then fails. Found: APP (a fake code, Oct 9).

## In-app test (Oct 9, 1:27 to 1:35 AM)

Build: `release.sh aarch64` from HEAD bfb5ddd plus this fix, plus the other sessions' unsaved edits in the same folder at that time (DMG SHA-256 30fdaadc…, signature ok, 0 key-shaped strings). Opened from the scratchpad on throwaway HOME folders, never /Applications. The Mac was locked (Adam asleep). Window captures worked with `caffeinate -d`; keys went in with `CGEvent.postToPid`.

| Test | Result |
| --- | --- |
| First run, empty profile, light | Pass. "Sign in to Upshot", Step 1 of 6, Continue with Google and Continue with Microsoft, privacy link. No skip. |
| Continue with Google: waiting state | Pass. "Finish signing in with Google in your browser." and Cancel. |
| Canceled at Google (callback with `error=access_denied`) | Pass. Browser page: "Sign-in did not finish". App: "Sign-in didn't finish. Try again." |
| Bad code (callback with a fake code) | Pass. App: "Sign-in didn't finish. Try again." Browser page says "Connected successfully" (item 10). |
| Real Google sign-in | Pass. The Google tab finished by itself (the browser was already signed in to Google; nothing was typed or clicked there). App: "Signed in as adam@websiteformula.co", then moved on to Step 2 of 6. |
| Signed-out home, copy of Adam's notes, light and dark | Pass. Coming up, Granola meetings with the right EDT times, Record meeting, Ask anything. Nothing on Home says the account is signed out until AI or transcription is used. |

Not tested in the app, and why:

- Microsoft sign-in, sign out and back in, record, Stop, summary, transcript and audio, chat, folders, templates, settings and the meeting popup. While the Mac is locked, typed text did not reach the chat field, mouse events cannot be sent to the app, and the screen-control tools need Adam to approve access. Recording also needs the microphone prompt answered for this new ad-hoc build. A test profile has no keychain, so a sign-in there lasts only until the app quits.
- The Granola date fix in the app: a test profile cannot connect Granola (no keychain; see `scripts/test-tools/README.md`). Checked instead in JavaScriptCore, Safari's engine, which the Mac app uses (`osascript -l JavaScript`): EDT 12:00 PM to 16:00Z, BST to 11:00Z, CEST 12:30 AM to 22:30Z the day before, IST 9:05 PM to 15:35Z, unknown zone as this Mac's time.
- The old app's own screens: covered by the live Worker requests above (same answers the old app gets).

## Done on Oct 9 (Adam: "Do your recommendations")

- Items 2 and 5 fixed in the Worker and the app. Worker deployed by Adam (version dc3d8ee7-41a0-4c80-96e0-c0a6ab6a987c). Live checks: `POST /stt/pass` with no session is 401 sign_in_required; a forged pass on `/stt/listen` is 401; `/auth/login` is 410 with the new message; chat with no session is still 401 with the download link.
- Worker tests: 70 pass. New: password sign-in and sign-up are 410 and never reach Supabase; a Google account gets a 3-hour pass that opens a live stream without asking Supabase again; expired, forged, other-purpose and other-key passes are refused.
- Deploy note: Wrangler needs Node 22 or later; the shell default is Node 20. Use `PATH=/usr/local/bin:$PATH npx wrangler deploy --var REQUIRE_ACCOUNT:1`.
- Trade-off: a deleted or signed-out account keeps its pass until it ends (3 hours at most), as AssemblyAI's session tokens do.

## Decisions for Adam

1. **Finish the in-app test** with the screen unlocked: Microsoft sign-in, sign out and in, record, Stop, summary, transcript and audio, chat, folders, templates, settings, meeting popup, light and dark.
