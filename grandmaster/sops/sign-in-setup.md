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
6. Docs (README, GUIDE, ROADMAP, HOW-I-BUILT-THIS, Skool post, Loom script, live roadmap page).

## Open items (found in Adam's in-app test, Oct 5)

Each has a task chip in the account-requirement session; start it there, or paste the line into a new session.

- [ ] Granola import: the browser says "Granola connected", but onboarding's Granola row still shows Connect (`plugins/importer/src/connected_mcp.rs`, `apps/desktop/src/onboarding/imports.tsx`). Not caused by sign-in.
- [ ] Calendar step: "No calendars yet" on a fresh profile although Internet Accounts has a Google account with Calendars on (`apps/desktop/src/onboarding/calendar.tsx`). Check the Calendar permission for the new ad-hoc build first.
- [ ] Microsoft shows "unverified" on its consent screen. Fix: Microsoft publisher verification (free; needs a Partner One ID and a verified domain).
- [ ] Google's screen names `uexdqfhszkwnguehvxal.supabase.co`. Fix: Supabase custom domain, then Google brand verification.
- [ ] Microsoft client secret expires Oct 4, 2028. Renew before then.
