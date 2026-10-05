# Calendar from sign-in (Adam chose "A", Oct 5)

## Goal

The Google or Microsoft account you sign in with also gives Upshot its calendar, as Granola does. No macOS Internet Accounts step. Works on Mac, Windows and Linux.

Update (Adam, Oct 5): calendar access is asked from a "Connect Google Calendar" / "Connect Outlook calendar" button (onboarding and Settings › Calendar), not at sign-in. This is Google's incremental authorization, and it keeps the unverified-app screen off sign-in until Google verifies the scope. App side: branch `calendar-connect`. Worker side: grandmaster 68af07921e (start with `calendar=1`; exchange sends `provider` and `calendar: true`).

## Sources

- Granola setup guide: sign-in opens the browser, then "you'll be prompted to choose your calendar permissions" (docs.granola.ai/help-center/getting-started/setting-up-granola-for-the-first-time).
- Granola calendars: "Your primary calendar in Google or Microsoft/Outlook is synced by default. You can toggle on any additional calendars in Settings." Granola does not support Apple Calendar (docs.granola.ai/help-center/getting-started/syncing-your-calendars).
- Google: reading Calendar events is a sensitive scope and needs verification. Until verified, users see the unverified-app screen and the app is capped at 100 new users (developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification; support.google.com/cloud/answer/7454865).
- Supabase returns `provider_token` and `provider_refresh_token` when Google is asked with `access_type=offline` and `prompt=consent`. Supabase does not refresh provider tokens; we must store and refresh them ourselves (supabase.com/docs/guides/auth/social-login/auth-google, "Saving Google tokens").
- Microsoft Graph: `Calendars.Read` and `offline_access` are delegated scopes a user can consent to (learn.microsoft.com/graph/permissions-reference).

## Why the Oct 5 test failed (for the record)

Not a permission problem. macOS logged "Allowed" for Upshot. Not the changed HOME either: a test app with a changed HOME read 21 calendars. In Settings, a grant while the app was running loaded 21 calendars. An empty profile with access already on also loaded 21. The onboarding-time failure did not happen again, so its cause is still unknown. The Mac route stays only as a fallback, so this plan does not depend on that cause.

## Design: reuse the calendar client the app already has

The app already speaks Anarlog's cloud calendar API (crates/calendar/src/fetch.rs, crates/api-calendar, crates/api-nango). The Worker implements the same five routes, so the app needs almost no new sync code:

| Route | Body | Returns |
|-|-|-|
| `GET /nango/connections` | none | `{ connections: [{ integration_id: "google-calendar" or "outlook", connection_id }] }` |
| `POST /calendar/google/list-calendars` | `{ connection_id }` | Google `calendarList` response |
| `POST /calendar/google/list-events` | `{ connection_id, calendar_id, time_min, time_max, max_results, page_token, single_events, order_by }` | Google `events` response |
| `POST /calendar/outlook/list-calendars` | `{ connection_id }` | Graph `/me/calendars` response |
| `POST /calendar/outlook/list-events` | see crates/api-calendar/src/outlook/routes.rs | Graph calendarView response |

All five use the Upshot session token (`Authorization: Bearer`). A dead provider token returns 424, as upstream does.

## Work

### Worker (owned by the account session; one Worker session at a time)

1. `/auth/oauth/start`: Google adds `https://www.googleapis.com/auth/calendar.readonly` plus `access_type=offline` and `prompt=consent`. Microsoft adds `Calendars.Read offline_access` next to `email`.
2. `/auth/oauth/exchange`: keep `provider_refresh_token` server side, encrypted, keyed by the Supabase user id. Never send it to the app.
3. The five routes above. Refresh the provider access token with Google or Microsoft as needed.
4. Tests in grandmaster/worker/test.mjs.

### App (this session can do it)

1. Calendar plugin base URL: the Worker origin (`VITE_AI_API_URL`) instead of `VITE_API_URL`.
2. Calendar token: the Upshot session token (upshot-plan/session.ts `getUpshotAccessToken`) instead of the old Supabase auth store.
3. Onboarding step "Connect calendar": signed in means connected. Show the calendars with the primary one on, as Granola does. No Internet Accounts text.
4. Settings › Calendar: "Connected with Google (adam@…)". The Mac route moves under "More calendars on this Mac" (Mac only, off by default) to avoid duplicate events.
5. Tests: onboarding calendar, settings calendar, calendar sync with the Worker routes mocked.

### Adam only

1. Google Cloud console › OAuth consent screen: add the `calendar.readonly` scope. Submit for verification when the domain is ready. Until then, testers see the unverified-app screen.
2. Azure app registration › API permissions: add `Calendars.Read` and `offline_access` (delegated).

## Open questions

- Users who signed in before this change: ask again for calendar access on the next sign-in, or show "Connect calendar" once.
- The duplicate rule if someone turns on the Mac route too.

## Release gate (Oct 6)

Do not merge `calendar-connect` or ship it until the "Release gate: Connect calendar" steps in `grandmaster/sops/sign-in-setup.md` are done: calendar.readonly back in Google's Data Access, the demo video recorded, and the sensitive-scope review submitted. The Worker routes are live (version d6ef976b); Google and Azure consent settings are done.
