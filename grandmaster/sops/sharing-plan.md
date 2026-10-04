# Sharing and team workspaces plan (Oct 4)

Plan only. No app, database or Worker code changed. It covers ROADMAP.md Phase 1, steps 1a and 1b, and goes one level below `grandmaster/sops/granola-gap-plan.md` §4 (server work S1 to S8, app work A1 to A5, A7 and A8).

Sources, all read Oct 4, 2026:
- Granola: [Sharing notes](https://docs.granola.ai/help-center/sharing/sharing-notes), [Sharing controls](https://docs.granola.ai/help-center/consent-security-privacy/sharing-controls), [Workspaces](https://docs.granola.ai/help-center/workspaces), [Spaces and folders](https://docs.granola.ai/help-center/sharing/folders/spaces-and-folders), [Shared with me](https://www.granola.ai/blog/shared-with-me) (blog, Sep 17, 2025), [Pricing](https://www.granola.ai/pricing).
- Supabase: [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking), [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [Pricing](https://supabase.com/pricing), [Billing FAQ](https://supabase.com/docs/guides/platform/billing-faq).
- Cloudflare: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Email Service](https://developers.cloudflare.com/email-service/), [Registrar](https://www.cloudflare.com/products/registrar/).
- Security: [W3C TAG, Good practices for capability URLs](https://www.w3.org/TR/capability-urls/) (draft), [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
- Sign-in: [Tauri deep linking](https://v2.tauri.app/plugin/deep-linking/), [Google OAuth app verification](https://support.google.com/cloud/answer/13463073), [Microsoft publisher verification](https://learn.microsoft.com/en-us/entra/identity-platform/publisher-verification-overview).
- Email: [Resend pricing](https://resend.com/pricing).
- Live, read-only checks: Supabase project `upshot` (ref `uexdqfhszkwnguehvxal`, us-east-1) is in the "Website Formula" organization on the Free plan. It has one table, `public.subscriptions`, with RLS on and one read-own policy, and 2 users, both email sign-ups.

Paths below are under `apps/desktop/src/` unless they start with another top folder.

## 1. Summary

In 1a, Upshot users share a note by link or by email, read notes others shared in "Shared with me", and pick the default link access for new shares. In 1b, they create team workspaces with members, roles and invitations, switch workspaces, and share folders. Almost all of the app side already exists, hidden, in the Anarlog code: the Share popover, Shared with me with an offline cache, the default-access setting, and the whole Teams settings page. The database rules exist too, as 53 upstream migrations with 64 SQL tests.

The plan ports a trimmed copy of that schema into the `upshot` Supabase project with RLS on every table. Every call goes through the existing Cloudflare Worker, so the app still ships no key. The Worker also serves a small read-only web page.

One security gap must close first. Upshot auto-confirms email sign-ups, so the email on an account is not proven. Sharing by email would then leak notes to whoever registers that address (section 7.3).

Running cost: $0 at launch on free tiers. About $30 a month with Supabase Pro and Workers Paid. About $57 a month at 10,000 sharing users. The steps add up to 15 to 33 working days for 1a and 14 to 36 for 1b. No Worker change starts until the spend guard session is merged.

## 2. How Granola does it, and what Upshot does

| What | Granola | Upshot plan |
|---|---|---|
| Share a note | Share control with "Copy link" and email. Link access: "Anyone with the link", "Only my company", "Private" (sharing-notes) | Same popover. 1a offers Private and Anyone with the link. 1b adds Everyone at the workspace |
| What a viewer sees | Summarized notes only, no full transcript "for privacy reasons". Link viewers need no account. Viewers can use Granola Chat (sharing-notes) | Title, date, sharer and summary. No sign-in for link viewers. Transcript and audio never leave the owner's computer. Chat for viewers waits (section 12) |
| Share with a person | Add their email. Granola users see the note at once in "Shared with me" in the sidebar. Others get an email with the notes (blog, Sep 17, 2025) | Same, but an email only unlocks a note for an account whose email is proven (section 7.3) |
| Default link access | Settings > Preferences > Data & sharing. Applies to notes created after the change. Enterprise admins set a workspace default (sharing-controls). Granola's own starting value is not stated | Settings › Privacy › Default link access. It starts at Private (ROADMAP.md 1a). Nothing is uploaded until the owner presses Share |
| "Only my company" | People "authenticating with your workspace's email" (sharing-controls) | "Everyone at <workspace>" in 1b, for signed-in members |
| Seats and price | Sharing a note adds no seat (sharing-notes). Shared folders and team workspaces are on the free plan (pricing) | Sharing and workspaces are free. Seat billing is step 1d |
| Workspaces | Workspace name at the bottom left, then "Add workspace". Name and picture. Optional auto-join by email domain. Invite by email or link. Roles Admin and Member. Remove in Settings > Workspace > Members. Leave in General > Danger zone (workspaces) | Same, from the hidden Teams page. Auto-join only for proven work emails |
| Spaces and folders | "My notes" and the team space. Folder link access: "Invited people only", "Everyone at [workspace]", "Anyone with the link". Owners manage notes and sharing. Members add their own notes and add members (spaces-and-folders) | Same, built as live membership. Upstream shared folders were frozen copies |

## 3. What the user sees

### 1a

1. **Share popover.** The note header's "Share" pill opens it (Granola sharing-notes). From top to bottom:
   - "Invite people": an email field and "Invite". Invited people get Viewer access.
   - "People with access": you as Owner, then each person as Viewer, or "Invited" until they accept.
   - "Link access": "Private" (only you and people you invite) or "Anyone with the link" (no sign-in needed). It starts at the default from Settings.
   - "Copy link", shown only for "Anyone with the link". Granola makes no link for restricted notes (sharing-controls).
   - "Stop sharing", which deletes the copy on the server.
   - Below a line, today's items stay: "Copy notes", "Send notes via email", "Export…".
   - One line of small text: "Sharing uploads this note's summary. The transcript and audio stay on this computer."
   - Signed out, the popover shows "Sign in to share" with Google, Microsoft and email.
2. **Web page** at `https://<web address>/n/<token>`. It shows the title, the date, "Shared by <name>", then the summary. It follows the system's light or dark mode and Upshot's design (`grandmaster/design-system.md`: Geist, the 1.2 type scale from 16 px, one orange accent, nothing touches the edges, no eyebrow labels). It needs no sign-in. A dead link shows "This link no longer works. Ask the person who shared it."
3. **Invitation email.** Subject: "<Name> shared “<Title>” with you". People who use Upshot get "Open in Upshot". Others get the summary in the email and "Get Upshot" (decision 4).
4. **Shared with me** in the sidebar. It lists notes others shared, newest first, each with the sharer and the date. A note opens read-only. Once synced, it opens offline too (ROADMAP.md 1a).
5. **Settings › Privacy › Default link access.** Private (the default) or Anyone with the link. It sets where link access starts when a note is first shared. It changes no note that is already shared (Granola sharing-controls).
6. **Sign in.** "Continue with Google", "Continue with Microsoft", and email with a 6-digit code. Upshot still works with no account. Sign-in is only for sharing, workspaces and Pro.

### 1b

1. **Workspace switcher** at the bottom left. It shows the current workspace's name. Its menu lists your workspaces and "Add workspace" (Granola workspaces).
2. **Add workspace.** Name, picture, and "Let anyone with an @company.com email join". That checkbox shows only for a proven work email.
3. **Settings › Workspace.** The hidden "Teams" page, renamed as in Granola:
   - "General": name, picture, auto-join. A "Danger zone" with "Leave workspace" (type the name to confirm) and, for the owner, "Delete workspace".
   - "Members": each member with a role menu (Admin, Member), "Invite by email", "Copy invite link", "Remove".
4. **Invitation.** An email with "Join <Workspace>". The `/i/<token>` page opens Upshot, or asks the person to sign in on the web.
5. **Sidebar spaces.** "My notes" (private), the team space named after the workspace (everyone in it), and "Shared with me". Each space lists its folders and has a "+".
6. **Folder Share popover.** Members by email. Link access: "Invited people only", "Everyone at <Workspace>" or "Anyone with the link". "Copy link". Members also see "Leave folder". Owners add or remove any note and change sharing. Members add their own notes and add members (Granola spaces-and-folders).
7. **Note link access** gains "Everyone at <Workspace>". On the web, those links ask the viewer to sign in with Google, Microsoft or email.

## 4. What we reuse

| Piece | Where | What it does | Plan |
|---|---|---|---|
| Share popover | `session-sharing/` (`index.tsx` SessionShareButton, `general-access.tsx`, `invite-recipients.tsx`, `access-management.tsx`, `invitation-management.ts`) | Share, link access, invitations, access list | Reuse. Restyle into today's `session/components/outer-header/share-menu.tsx` |
| Client and contract | `session-sharing/client.ts`, `client-contract.ts`, `urls.ts` | RPC and REST calls, strict parsers, link builders | Reuse. Point at the Worker |
| Publishing | `session-sharing/sync.tsx` (OwnedSharedNotePublisher, 800 ms), `reconciliation.ts`, `source.ts` | Re-publishes the shared copy after edits | Reuse |
| Default access | `session-sharing/default-access.ts`, `settings/general/default-share-access.tsx` (orphaned), `settings/schema.ts:349` | Starting access for a new share | Reuse. Options become Private and Anyone with the link |
| Shared with me | `shared-notes/` (`cache.ts`, `sync.tsx`, `preview.tsx`, `deeplink.ts`), `sidebar/shared-notes.tsx` (unreachable today) | SQLite cache and pull | Reuse. Add the sidebar entry. Pull every 5 minutes, not every 60 seconds |
| Teams page | `settings/team/` (`index.tsx`, `client.ts`, `invitation.ts`, `mirror.ts`, `email-auto-join.tsx`) | Workspaces, members, roles, invitations, leave, delete, auto-join | Reuse in 1b. Rename to Workspace |
| Deep links | `shared/hooks/useDeeplinkHandler.ts:72,152`, `plugins/deeplink2/` | Sign-in callback and `share/open` | Reuse with the `upshot` scheme |
| Schema and SQL tests | `supabase/migrations/` (53 of 153 files), `supabase/tests/` (64 files) | Tables, functions, RLS, tests | Port a trimmed copy (section 6) |
| Web viewer | `apps/web/src/routes/share/` | Read-only page (TanStack Start on Vercel) | Copy the layout into one Worker page. Do not deploy `apps/web` |
| Resource sharing | `resource-sharing/` (`SHARING_AVAILABLE = false` at `share-dialog.tsx:51`) | Frozen copies of folders, templates and recipes | Not in 1a or 1b. Folders are rebuilt as live membership. Templates and recipes are 1c |

Blockers found in the code, and the fix:
1. The release builds no Supabase client (`auth/client.ts:78`), so the session stays undefined (`auth/context.tsx:646,700`). Fix: build the supabase-js client against the Worker (`${VITE_AI_API_URL}/sb`), keep its Tauri fetch (`auth/client.ts:80-82`, so CORS does not apply), and hand it the Upshot session token. supabase-js 2.103.0 is installed and has the `accessToken` option. RPC call sites stay as they are.
2. Deep links accept only `anarlog*` schemes (`plugins/deeplink2/src/types/share_open.rs:18`, `shared/utils.ts:17`). Fix: `upshot`, already registered in `apps/desktop/src-tauri/tauri.conf.json:107`.
3. `anarlog.so` and Loops are hard-coded (`session-sharing/urls.ts:164`). Fix: Upshot's web address. The Worker sends the email.
4. Pro gates. The upstream server requires Pro to publish, and the app checks `isPaid` (`session-sharing/index.tsx:513,583`). Fix: drop both. Sharing is free, as in Granola.
5. The personal workspace row comes only from the cloudsync projection (`crates/db-app/src/cloudsync/projection.rs:440`), so `session-sharing/source.ts:299-327` throws. Fix: a database function creates the personal workspace at first sign-in, and `settings/team/mirror.ts` writes it locally. `crates/cloudsync` stays untouched.
6. Two sign-in systems. Fix: the fork's session (`upshot-plan/session.ts`) stays the only one. It is stored through `plugins/store2`, which uses the `keyring` crate, so it works on Mac, Windows and Linux. The upstream web sign-in (`auth/context.tsx:795`) is not used.

Not used: `crates/cloudsync` and the Sync page (`settings/sync/`), `crates/api-sync` and `apps/api` (the Rust server on Fly.io), `apps/web`, `enterprise/`, comments, attachments, Slack and email recaps, and live co-editing.

## 5. How it fits together

```
Upshot app ── user token ──▶ Worker (upshot-ai) ── user token + publishable key ──▶ Supabase "upshot"
                                   │                                              RLS on every table
Web browser ── link ──────▶ Worker /n/<token> ── anon, one read function ────────▶
                                   │
                                   └──▶ email sender (invitations, sign-in codes)
```

Rules:
1. The app ships no Supabase key (CLAUDE.md). The Worker adds the publishable key and forwards the user's own token, so the database checks every call as that user.
2. The Worker's `/sb/` door passes only an allow-list: the function names the reused clients call, plus reads of `workspaces` and `workspace_memberships`. Anything else gets 404.
3. The secret key stays for billing only (`grandmaster/worker/src/billing.js`). Sharing never uses it, so a Worker bug cannot skip RLS.
4. Link viewers have no account. The Worker calls one function as `anon`, `read_shared_note_by_link(token)`. It returns only the title, date, sharer name and summary of a live link.
5. If someone calls Supabase directly with the publishable key, RLS still returns only what that user may see.

New Worker routes (all after Gate 0, section 8):

| Route | Purpose | Step |
|---|---|---|
| `POST /sb/rest/v1/rpc/{name}`, `GET /sb/rest/v1/workspaces`, `GET /sb/rest/v1/workspace_memberships` | Door to Supabase with the user's token, allow-listed | 1a.6 |
| `PUT /sync/shares/{id}/snapshot` | Publish or update the shared copy (the contract the client already uses) | 1a.6 |
| `POST /shared-notes/invitations/{id}/email` | Send a note invitation | 1a.6 |
| `POST /auth/verify`, `POST /auth/resend`, `POST /auth/recover` | 6-digit email code and password reset | 1a.7 |
| `GET /n/{token}` | Read-only note page | 1a.8 |
| `POST /auth/oauth/exchange` | Google or Microsoft sign-in: swap the code for a session (PKCE) | 1a.9 |
| `POST /workspaces/invitations/{id}/email`, `GET /i/{token}` | Workspace invitations | 1b.2 |
| `GET /auth/web/*` | Web sign-in for Private and workspace links (PKCE, HttpOnly cookie) | 1b.2 |
| `GET /f/{token}` | Read-only folder page | 1b.5 |

## 6. Data model

New SQL goes in `grandmaster/supabase/migrations/`, with tests in `grandmaster/supabase/tests/`. The upstream `supabase/` folder stays as a reference and is never applied. Step 1a.2 first saves the live `subscriptions` table as migration 0, because its DDL is not in the repo today.

Port, do not replay. Start from the upstream files named below. Keep the table and function names the reused clients call. Leave out e2ee, seats, billing, Pro gates, workspace policies, SSO, subdomains, comments, attachments, web editing and live documents.

### 1a tables

| Table | Key columns | Upstream source |
|---|---|---|
| `workspaces` | id (equals the owner's user id for a personal workspace), owner_user_id, kind (`personal`), name, deleted_at | `20260716082318_personal_workspaces.sql` |
| `workspace_memberships` | workspace_id, user_id, role (`owner`, `admin`, `member`), one row per pair | same |
| `session_shares` | id, workspace_id, session_id (the local note id), created_by_user_id, general_scope (`restricted` is Private, `link` is Anyone with the link), access_version, deleted_at. One share per note | `20260716153701_session_sharing_authority.sql` |
| `session_share_links` | share_id, token_hash (SHA-256, 32 bytes), revoked_at | same, and `20260824130000_stable_session_share_links.sql` |
| `session_share_snapshots` | share_id, content_revision, title (up to 4 KB), body_json (the summary as a ProseMirror document, up to 2 MB), published_by_user_id, published_at | `20260716172713_session_share_snapshots.sql` |
| `session_access_grants` | share_id, grantee_user_id, capability (`viewer` only until 1c), revoked_at | `20260716153701_session_sharing_authority.sql` |
| `session_access_invitations` | share_id, invitee_email (lowercase), invitee_user_id, token_hash, expires_at, accepted_at, revoked_at | same |

Functions for 1a: share create, get, delete and scope; `enable_session_share_link` and `rotate_session_share_link`; invitations and grants; the feed `list_my_session_share_snapshot_page_v2` and `read_my_session_share_snapshot_v2`; publish (from `publish_session_share_snapshot_with_attachments`, without attachments); delete (`20260716194856_delete_session_share.sql`); creator checks (`20260918120000_session_share_creator_authority.sql`). Two are new: `read_shared_note_by_link(token)` for `anon`, and `ensure_personal_workspace()`.

Tests to port: `007-workspace-tenancy.sql`, `010-session-share-snapshots.sql`, `014-session-share-deletion.sql`, `043-stable-session-share-links.sql`, `061-session-share-creator-authority.sql`.

### 1b tables

| Table | Key columns | Source |
|---|---|---|
| `workspaces` (kind `team`) | adds name, picture, auto-join, primary owner | `20260811130000_shared_workspace_lifecycle.sql` (without e2ee), `20260831120000_workspace_logo.sql`, `20260918042502_workspace_primary_owner.sql` |
| `workspace_invitations` | workspace_id, invitee_email, token_hash, role (`member`), expires_at, accepted_at, revoked_at | `20260716145904_workspace_invitations.sql`, `20260826121000_inspect_workspace_invitation.sql`, `20260826130000_resend_workspace_invitation.sql`, `20260912120000_my_workspace_invitations.sql` |
| `workspace_verified_domains`, `private.public_email_domains` | auto-join domains, and the list of free email domains that can never auto-join | `20260908163829_workspace_email_auto_join.sql` |
| Member roster and profiles | names and emails of fellow members | `20260912140000_workspace_member_profiles.sql`, `20260913000000_workspace_member_roster_access.sql` |
| `folders` (new) | id, workspace_id, space (`my_notes` or `team`), name, owner_user_id, general_scope (`restricted`, `workspace`, `link`), deleted_at | Upshot's own (Granola spaces-and-folders) |
| `folder_members` (new) | folder_id, user_id, role (`owner`, `member`) | Upshot's own |
| `folder_notes` (new) | folder_id, share_id, added_by_user_id | Upshot's own |
| `folder_links` (new) | folder_id, token_hash, revoked_at | same pattern as `session_share_links` |
| Storage bucket `workspace-pictures` | private. Members read, admins write, through RLS on `storage.objects` | Supabase Storage |

`session_shares.general_scope` gains `workspace` (Everyone at the workspace).

Tests to port: `008-workspace-invitations.sql`, `031-shared-workspace-lifecycle.sql`, `045-workspace-logo.sql`, `051-workspace-email-auto-join.sql`, `053-my-workspace-invitations.sql`, `055-workspace-member-profiles.sql`, `057-workspace-primary-owner.sql`.

Local SQLite tables already exist in `packages/db/src/schema.ts`: `shared_session_cache`, `session_share_sync_state`, `session_share_activation`, `workspaces`, `workspace_memberships`. 1b adds one local table that maps a local folder to its cloud folder (a new migration in `crates/db-app/migrations/`).

## 7. Security model

### 7.1 Row-level security on every table

Following the Supabase RLS guide:
1. Each table turns RLS on in the migration that creates it. The guide's `rls_auto_enable` event trigger goes in first, so no table in `public` can be created without RLS.
2. A pgTAP test fails if any table in `public` has RLS off, or if `anon` can read any table.
3. Every policy names its role (`to authenticated`) and wraps `auth.uid()` as `(select auth.uid())`. Every column a policy uses has an index.
4. Membership checks are `security definer` helpers in a `private` schema that the API does not expose (for example `private.is_workspace_member`, `private.can_read_share`). Policies call them as `(select ...)`.
5. Clients get read policies only. Every write goes through a `security definer` function with `set search_path = ''` that checks the caller first, as upstream does. `execute` is revoked from `public` and `anon` and granted to `authenticated`, except for the one link-reading function.
6. No policy reads `user_metadata`, because users can edit it (RLS guide).
7. After every migration, the Supabase security and performance advisors (MCP `get_advisors`) must show no new findings.

Who can read what:

| Table | Read | Write |
|---|---|---|
| `workspaces` | members | functions only |
| `workspace_memberships` | your own rows; in 1b, members of the same workspace | functions only (admins) |
| `workspace_invitations` | workspace admins; the invitee, by proven matching email | functions only |
| `session_shares`, `session_share_snapshots` | the owner; people with a live grant; in 1b, workspace members when the scope is `workspace`, and folder members when the note is in their folder | functions only (owner) |
| `session_share_links`, `folder_links` | the owner only | functions only |
| `session_access_grants` | the owner; the grantee's own row | functions only |
| `session_access_invitations` | the owner; the invitee, by proven matching email | functions only |
| `folders`, `folder_members`, `folder_notes` | folder members; workspace members for team-space folders | functions only |
| `subscriptions` (exists) | your own row | the Worker, with the secret key |
| `private.*` | nobody through the API | migrations only |

### 7.2 Link tokens

Following W3C capability URLs and OWASP:
- 256 random bits from a secure random generator, 43 characters (the upstream format). OWASP asks for at least 64 bits.
- Only the SHA-256 hash is stored, so a database leak gives no working links.
- The owner can turn a link off or make a new one (`rotate_session_share_link`). A dead link returns 404.
- HTTPS only.

### 7.3 Proven email addresses (must ship before email sharing)

Finding: the `upshot` project auto-confirms sign-ups. Both accounts were confirmed 0 seconds after sign-up, and no confirmation email was sent (checked Oct 4). Supabase's built-in email sends only to the organization's team, so confirmation could not be switched on (Supabase custom SMTP guide; `grandmaster/sops/journey-account-settings.md:18`).

Why it matters:
- The upstream rules give access by email when `email_confirmed_at` is set (`supabase/migrations/20260716153701_session_sharing_authority.sql:396,433,981`; auto-join at `20260908163829_workspace_email_auto_join.sql:13857`). With auto-confirm, anyone can register bob@company.com, receive what is shared with Bob, or auto-join Bob's company.
- When someone signs in with Google or Microsoft, Supabase links that identity to an existing user with the same email. It removes only unconfirmed identities (identity linking guide). So a password account that someone else made in advance, auto-confirmed, would stay linked when the real Bob signs in.

Fix, in step 1a.7, before any email-based sharing and before Google and Microsoft sign-in:
1. Custom SMTP in Supabase Auth, through the chosen email sender.
2. Switch on "Confirm email". Sign-up then asks for a 6-digit code. A code works on every computer and needs no deep link.
3. Invitation links stay valid for whoever holds them, because the token was sent to that mailbox (the upstream invitation design).
4. Domain auto-join needs a proven work email, never a free email domain (upstream `private.public_email_domains`).
5. On Supabase Pro, switch on leaked-password protection. It is Pro only, and it is the one open advisor finding today.

### 7.4 The web page

- The Worker renders it from the stored ProseMirror JSON through an allow-list of node and mark types. Every text node is escaped. Links allow only `https:`, `http:` and `mailto:`, with `rel="noopener noreferrer"`.
- Headers: `Content-Security-Policy: default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store` (so turning a link off works at once), `X-Content-Type-Options: nosniff`.
- No third-party scripts, fonts or analytics (W3C capability URLs). The CSS and the Geist fonts are static files in `grandmaster/worker/public/`. Static files are free on Workers.

### 7.5 Limits

- The Worker's rate limiter (`RATE_LIMITER`, 60 a minute, keyed by route and IP in `grandmaster/worker/src/http.js:47-52`) gets new keys for `/n/`, `/sb/` and invitations.
- In SQL: at most 20 recipients per invitation (the upstream recap cap), and a daily invitation cap per user, so one account cannot use up the email quota. Resend Free allows 100 emails a day in total.
- The request body limit stays at 1 MB (`grandmaster/worker/src/index.js:28-29`). SQL caps a snapshot at 2 MB, and a summary is far smaller.
- All of these sit under the spend guard's limits once that session is merged.

### 7.6 What leaves the computer

- Only when the owner presses Share: the title, the summary as shown in the Summary tab, the meeting date, and the owner's name and email.
- Never: the transcript, the audio, the attendee list, chat history, or any note that was not shared.
- "Stop sharing" deletes the server copy. Deleting a note deletes its share (`session/hooks/useDeleteSession.ts:55` already does this once a client exists). Deleting the account removes every share, grant and membership through `on delete cascade` on `auth.users`.
- The privacy page (`grandmaster/worker/public/privacy.html`) gets a section on shared notes, stored in Supabase in us-east-1.

## 8. Steps and sizes

Sizes as in ROADMAP.md: S is up to a day, M is 2 to 5 days, L is 1 to 3 weeks.

Gate 0: no change under `grandmaster/worker/**` until the spend guard session is merged into `grandmaster`. Database and app steps can start now. Sharing stays hidden behind today's gate (`session/components/outer-header/index.tsx:148-151`) until step 1a.10 passes, so every release in between stays shippable.

Coordination: `sidebar/index.tsx` and the template files have uncommitted edits from another session today. Step 1a.4 starts from that work once it is committed.

### 1a: share a note (15 to 33 working days)

| # | Step | Who | Size | Starts after |
|---|---|---|---|---|
| 1a.1 | Accounts: web address, email sender (DNS records, SMTP settings in Supabase), Google OAuth client (basic scopes only), Microsoft Entra app (work and personal accounts), redirect URLs in Supabase › Auth. Claude gives one step per message | Adam | S | decisions 1 to 3 |
| 1a.2 | Database: save `subscriptions` as migration 0; port the 1a tables and functions; RLS trigger and tests; no Pro gate; apply to `upshot`; advisors clean | Claude | M | now |
| 1a.3 | App: the Share popover from `session-sharing/` inside today's Share menu; supabase-js through the Worker; `upshot` scheme; personal workspace mirror; Pro gates off; comments, attachments, recaps and web editing stay hidden | Claude | M | 1a.2 |
| 1a.4 | App: "Shared with me" in the sidebar, from `shared-notes/` and `sidebar/shared-notes.tsx`; offline cache; check at start, on focus and every 5 minutes (a 60-second pull would pass the Workers free limit at about 200 users) | Claude | S | 1a.3 |
| 1a.5 | App: Settings › Privacy › Default link access, from `settings/general/default-share-access.tsx` | Claude | S | 1a.3 |
| 1a.6 | Worker: the `/sb/` door with its allow-list, snapshot publish, invitation email, rate-limit keys, tests in `grandmaster/worker/test.mjs` | Claude | M | Gate 0, 1a.2 |
| 1a.7 | Proven emails: custom SMTP, "Confirm email" on, 6-digit code screen in the app, `/auth/verify` and password reset in the Worker | Claude | M | Gate 0, 1a.1 |
| 1a.8 | Worker: read-only page `/n/{token}` in Upshot's design, headers from 7.4, 404 for dead links | Claude | M | Gate 0, 1a.2 |
| 1a.9 | Sign in with Google or Microsoft: PKCE through `upshot://auth/callback`, Worker code exchange, buttons on the sign-in screen. Windows already has the single-instance plugin with deep links (`apps/desktop/src-tauri/Cargo.toml:74`). On Linux and Windows the app also registers the scheme at run time, because a moved AppImage loses it (Tauri deep linking) | Claude | M | 1a.1, 1a.7 |
| 1a.10 | Privacy page; end-to-end test on Mac, Windows and Linux; `/security-review`; remove the hide gate; release | Claude, then Adam | S | all above |

### 1b: team workspaces (14 to 36 working days)

| # | Step | Who | Size | Starts after |
|---|---|---|---|---|
| 1b.1 | Database: team workspaces, invitations, roster, auto-join for proven work emails, the `workspace` scope; RLS and tests | Claude | M | 1a released |
| 1b.2 | Worker: workspace invitation email, the `/i/{token}` page, web sign-in for Private and workspace links (PKCE with an HttpOnly cookie) | Claude | M | 1b.1 |
| 1b.3 | App: Settings › Workspace › General and Members from `settings/team/` (unhide it in `sidebar/settings-nav-groups.ts:78-91`); invite by email or link, roles, remove, leave, delete | Claude | M | 1b.1 |
| 1b.4 | App: workspace switcher at the bottom left with "Add workspace"; sidebar spaces "My notes" and the team space; "Shared with me" stays | Claude | M | 1b.3 |
| 1b.5 | Shared folders end to end: folder tables and functions, the `/f/{token}` page, the folder Share popover, adding a note to a shared folder publishes it, owner and member rights | Claude | L | 1b.4 |
| 1b.6 | End-to-end test with three accounts on Mac, Windows and Linux; `/security-review`; release | Claude, then Adam | S | all above |

## 9. What it costs to run

Today (checked Oct 4): Supabase costs $0. The "Website Formula" organization is on the Free plan, and its 2 free active projects are `upshot` and `rascal-rally`. The Worker's Cloudflare plan was not checked. Workers Free allows 100,000 requests a day.

Prices on Oct 4, 2026:

| Service | Free | Paid |
|---|---|---|
| Supabase | 500 MB database, 50,000 monthly active users, 5 GB egress, no backups, pauses after 1 week without use, 2 active projects | Pro, $25 a month per organization: 8 GB disk, 100,000 users, 250 GB egress, daily backups kept 7 days, spend cap on by default, $10 compute credit (one project). Each extra active project is about $10 a month |
| Cloudflare Workers | 100,000 requests a day, 10 ms CPU per request | $5 a month: 10 million requests and 30 million CPU ms, then $0.30 per million requests |
| Resend | 3,000 emails a month, 100 a day | $20 a month for 50,000 |
| Cloudflare Email Service | sending needs Workers Paid | 3,000 a month included, then $0.35 per 1,000 (public beta) |
| Web address | none | registry price with no markup on Cloudflare Registrar, about $10 to $12 a year for a .com |
| Google and Microsoft sign-in | free in Supabase; Microsoft publisher verification is free | none |

Usage estimates. Assumptions are in brackets.
- Database: [a shared summary is about 20 KB of JSON]. Free's 500 MB holds about 25,000 shared notes. Pro's 8 GB holds about 400,000.
- Egress: each web view reads one snapshot. Free's 5 GB covers about 250,000 views a month. Traffic from the Worker to the browser is Cloudflare's, and it is free.
- Requests: Shared with me checks every 5 minutes while the app is open [8 hours a day]. That is 96 requests per person per day, so 1,000 people use about 96,000 a day, the Workers Free limit.
- Users: only signed-in people count. Link viewers do not sign in.
- Email: one per invitation [5 per sharer per month].

| Monthly | Launch (up to 1,000 sharers) | 10,000 sharers |
|---|---|---|
| Supabase | $0 (Free), or $25 (Pro, recommended before 1b) | $25 |
| Cloudflare Workers | $0, then $5 near 1,000 daily users | about $11 (29 million requests) |
| Email (Resend) | $0 | $20 |
| Web address | about $1 | about $1 |
| Total | $0 to $31 | about $57 |

AI and transcription costs are separate; the spend guard covers them. Sharing adds no AI cost in 1a and 1b.

## 10. Decisions for Adam

1. Email sender.
   - Resend (recommended): generally available. $0 up to 3,000 emails a month (100 a day). SMTP for Supabase Auth. Works with any DNS host.
   - Cloudflare Email Service: same account as the Worker, and cheaper at volume ($0.35 per 1,000). But it is in public beta and needs Workers Paid.
2. Web address for links and email.
   - Buy an Upshot domain (recommended): email needs a verified sending domain, Microsoft publisher verification needs a verified domain, and links look like Upshot's. About $10 to $12 a year.
   - Keep `upshot-ai.adam-694.workers.dev`: free, but no domain to send email from, and every link shows "adam-694".
3. Supabase plan.
   - Pro before 1b ships (recommended): daily backups, leaked-password protection, spend cap on by default. Move `upshot` to its own organization first, so `rascal-rally` does not add about $10 a month.
   - Stay on Free: $0, but no backups, and the project pauses after a week without use.
4. Email to people who do not use Upshot yet.
   - Put the summary in the email, as Granola does (recommended). No web sign-in is needed in 1a, and owners can already send notes by email today.
   - Send only a link. The note stays behind sign-in, but web sign-in moves from 1b into 1a (one more M).

## 11. How we test it

- Database: `npx supabase test db` with Docker Desktop running. It runs the ported tests plus new ones: RLS is on for every table; `anon` reads nothing but a live link; a turned-off link returns nothing; a stranger cannot read a share; an unconfirmed email cannot claim an invitation by email. Then `get_advisors` (security and performance) shows no new findings.
- App: `pnpm -F @anlg/desktop exec vitest run src/session-sharing src/shared-notes src/settings/team`, then `pnpm -F @anlg/desktop typecheck`, then `bash grandmaster/scripts/rebrand-check.sh` (no output means pass).
- Worker: `node grandmaster/worker/test.mjs`, with new tests: the door refuses names not on the allow-list; `/n/` sends the 7.4 headers; a dead link gives 404.
- Headers on the live page: `curl -sI https://<web address>/n/<token>`.
- By hand, 1a: account A shares a note. A private browser window opens the link without signing in. A turns the link off, and a refresh shows 404. Account B sees the note in Shared with me, turns Wi-Fi off and still reads it. Google and Microsoft sign-in work on Mac, Windows and Linux.
- By hand, 1b: three accounts. Create a workspace. Invite by email and by link. Check Admin and Member rights. Remove a member and leave. Auto-join works for a work domain and is refused for gmail.com. A shared folder shows up for members, and its link page works.
- Before each release: `/security-review` on the diff.

## 12. Not in this plan

- 1c: Collaborator editing, sharing templates and recipes, moving notes between workspaces, admin custom spaces.
- 1d: per-seat billing for team workspaces.
- Chat about a shared note on the web. Granola offers it to viewers, but it spends AI money for people without an account. It waits for the spend guard and its own plan.
- Phase 2 and later: the transcript behind a summary line, comments, attachments, Slack and email recaps, live co-editing, SSO and SCIM.
