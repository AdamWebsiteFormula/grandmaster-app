# Sign-in setup: Google and Microsoft (Oct 5)

Adam's decision (Oct 5): Upshot signs in with Google or Microsoft only, as Granola ("Granola only supports Google and Microsoft single sign on", docs.granola.ai setup guide). A free account is required for Upshot AI and Upshot transcription. Notes, folders and search work signed out.

How it works:
- The app opens `<Worker>/auth/oauth/start?provider=google|azure&code_challenge=…&redirect_to=http://127.0.0.1:<port>/auth/callback` in the browser (RFC 8252: system browser, PKCE, loopback redirect). The Worker sends the browser on to Supabase's authorize page.
- Google or Microsoft returns to Supabase, Supabase returns the code to the app's loopback port (the deeplink2 callback server), and the app swaps code + verifier at `POST <Worker>/auth/oauth/exchange`.
- `/llm/chat/completions` and `/stt/listen` need a session whose account has a Google or Microsoft identity (`requireAccount` in `grandmaster/worker/src/auth.js`), with a per-account limit (`USER_RATE_LIMITER`, 30 a minute) next to the per-IP one.
- `REQUIRE_ACCOUNT=0` (deploy flag) turns the requirement off. Only the first deploy uses it, before the new installers are out.

Project: Supabase `upshot`, ref `uexdqfhszkwnguehvxal`. Callback URL for both providers: `https://uexdqfhszkwnguehvxal.supabase.co/auth/v1/callback`.

## Adam's steps (Claude does not change these settings)

### Google (supabase.com/docs/guides/auth/social-login/auth-google)
1. console.cloud.google.com › create project "Upshot".
2. Google Auth Platform › Branding: app name "Upshot", support email, developer email.
3. Audience: External. Then **Publish app** (In production). In Testing, only listed test users can sign in.
4. Data Access: scopes `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`. These are non-sensitive, so no Google review is needed.
5. Clients › Create client › Web application. Authorized redirect URI: the callback URL above. Copy the Client ID and Client secret.
6. Supabase › Authentication › Sign In / Providers › Google: on, paste both, Save.

Known gap: until Upshot has its own domain, Google's screen says "to continue to uexdqfhszkwnguehvxal.supabase.co". Supabase calls this something that "does not inspire trust". Fix later: a Supabase custom domain, then Google brand verification.

### Microsoft (supabase.com/docs/guides/auth/social-login/auth-azure)
1. entra.microsoft.com › App registrations › New registration. Name "Upshot". Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**. Redirect URI, type Web: the callback URL above. Register.
2. Certificates & secrets › New client secret (24 months). Copy the **Value** (not the Secret ID). Put a reminder in the calendar before it expires.
3. Manifest: set `optionalClaims` to add `xms_edov` and `email` to the ID token and `xms_edov` to the access token (exact JSON in the Supabase doc above). This tells Supabase whether Microsoft verified the email domain.
4. Supabase › Authentication › Sign In / Providers › Azure: on, Client ID = Application (client) ID from Overview, secret = the Value, Azure Tenant URL empty (any account). Save.

Known gap: many work accounts can't consent to an app from an unverified publisher (learn.microsoft.com, publisher verification). Personal Microsoft accounts work. Fix later: Microsoft AI Cloud Partner Program ID + a verified domain (free).

### Supabase
1. Authentication › URL Configuration › Redirect URLs: add `http://127.0.0.1:*/auth/callback`.
2. Authentication › Sign In / Providers › Email: **off**. New accounts then come only from Google or Microsoft. This also closes the account pre-registration risk in `sharing-plan.md` §7.3 (an auto-confirmed password account linking to someone's later Google sign-in).

## Order
1. Code + tests, commit, push.
2. Adam: Google, Microsoft and Supabase steps above.
3. Worker deploy A: `npx wrangler deploy --var REQUIRE_ACCOUNT:0` (new routes, privacy page; nothing required yet). Old apps keep working.
4. Build from a clean worktree, install, test sign-in and the gates on a test profile in light and dark. Publish Mac, Windows and Linux (Adam's OK).
5. Worker deploy B: `npx wrangler deploy --var REQUIRE_ACCOUNT:1` (requirement on). Set it explicitly: `keep_vars` in wrangler.jsonc keeps deploy A's `0` otherwise. Then `curl -s -X POST -H "content-type: application/json" -d '{"messages":[{"role":"user","content":"hi"}]}' <Worker>/llm/chat/completions` must answer 401 `sign_in_required`, and a 1.0.0 app must show the download message in chat.
6. Docs (README, GUIDE, ROADMAP, HOW-I-BUILT-THIS, Skool post, Loom script, live roadmap page). ROADMAP and the live page also get a Phase 1 row: "Continue with email (6-digit code)", after the domain and Resend.

## Open items (found in Adam's in-app test, Oct 5)

Each has a task chip in the account-requirement session; start it there, or paste the line into a new session.

- [ ] Granola import: the browser says "Granola connected", but onboarding's Granola row still shows Connect (`plugins/importer/src/connected_mcp.rs`, `apps/desktop/src/onboarding/imports.tsx`). Not caused by sign-in.
- [ ] Calendar step: "No calendars yet" on a fresh profile although Internet Accounts has a Google account with Calendars on (`apps/desktop/src/onboarding/calendar.tsx`). Check the Calendar permission for the new ad-hoc build first.
- [ ] Microsoft shows "unverified" on its consent screen. Fix: Microsoft publisher verification (free; needs a Partner One ID and a verified domain).
- [ ] Google's screen names `uexdqfhszkwnguehvxal.supabase.co`. Fix: Supabase custom domain, then Google brand verification.
- [ ] Microsoft client secret expires Oct 4, 2028. Renew before then.
- [ ] Add "Continue with email" with a 6-digit code (Adam chose this, Oct 5: Google and Microsoft now, email later, as Fireflies offers). Blocked on: Adam buys a domain and sets up Resend. Then: custom SMTP in Supabase, Email provider on with "Confirm email", the email template with `{{ .Token }}`, Worker `/auth/email/start` and `/auth/email/verify`, a code screen in `upshot-plan/sign-in.tsx`. Same as `sharing-plan.md` step 1a.7.

## Release gate: Connect calendar (do not skip)

Before the `calendar-connect` branch merges or ships in any installer:
1. Google Auth Platform › Data Access: calendar.readonly is listed (Adam removed it on Oct 6 so the brand review could go first).
2. Record the demo video Google asks for: sign in, click Connect Google Calendar, Google's consent screen with the app name, then the calendar events showing in Upshot.
3. Verification Center: submit the sensitive-scope review with that video and this justification: "Upshot reads calendar events to name meeting notes, list attendees and remind the user before meetings. Read-only; never written or shared."
Until Google approves, people who click Connect Google Calendar see the unverified-app screen, and Google caps it at 100 users.

## Upshot's own name on Google's sign-in screen (Adam, Oct 5-6)

Adam declined Supabase's paid custom domain ($25 Pro + $10 add-on a month). Instead the Worker handles Google's return on `upshotnotes.com` (bought Oct 6 on Cloudflare): Google → `https://upshotnotes.com/auth/google/callback` → the Worker swaps the code (Google client secret), signs in to Supabase with `grant_type=id_token` (raw nonce to Supabase, its SHA-256 to Google), and hands the app a sealed one-time code (`u1.…`, AES-GCM, OAUTH_STATE_KEY) that only the app's PKCE verifier opens at `/auth/oauth/exchange`. The app is unchanged. Microsoft stays on the Supabase flow (its screen already says "Upshot"). Without the Worker secrets, Google falls back to the Supabase flow.

Free plan note: Supabase pauses free projects after inactivity; sign-ins and token refreshes count as activity. If sign-in ever stops after a quiet week, un-pause the project in the Supabase dashboard.

Steps:
1. Done: domain `upshotnotes.com` on Cloudflare.
2. Done Oct 6: Google client › Authorized redirect URIs: add `https://upshotnotes.com/auth/google/callback` (keep the Supabase one).
3. Done Oct 6: Worker secrets (`npx wrangler secret put <NAME>` in `grandmaster/worker`): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET. Claude generates OAUTH_STATE_KEY and CALENDAR_TOKEN_KEY (`openssl rand -base64 32 | npx wrangler secret put …`) without printing them.
4. Done Oct 6 (version d6ef976b; Adam ran the SQL; live check: / and /privacy 200, chat 401 signed out, Google sign-in via upshotnotes.com into the existing account, chat answers): apply `grandmaster/supabase/migrations/20261005170000_calendar_connections.sql`, then deploy (wrangler.jsonc adds the `upshotnotes.com` custom domain and PUBLIC_ORIGIN). Check `https://upshotnotes.com/`, `/privacy`, a Google sign-in in the app, and a curl 401 on chat.
5. Adam: Google Search Console › add `upshotnotes.com` (DNS TXT at Cloudflare). Google Auth Platform › Branding: logo, home page `https://upshotnotes.com`, privacy `https://upshotnotes.com/privacy`, authorized domain `upshotnotes.com`. Verification Center: submit brand verification. Data Access: add `calendar.readonly`; enable the Google Calendar API; submit sensitive-scope verification (needs a demo video).
6. Adam: Azure › API permissions: add Microsoft Graph delegated `Calendars.Read` and `offline_access`.
