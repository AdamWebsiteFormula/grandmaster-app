# Granola gap plan (Oct 4)

Read-only research. No app code changed. Granola sources: every feature page in docs.granola.ai/llms.txt (fetched Oct 4) plus the product updates page (www.granola.ai/updates). Upshot status comes from the code at the paths given.

## 1. Summary

Granola's help center and updates page describe 106 user-facing features. Upshot has 39 of them today and part of 14 more. Another 22 are already written in the upstream Anarlog code but hidden, and almost all of those are cloud features: note sharing, workspaces, Shared with me, Slack, Notion and CRM, People and Companies, and seat billing. 31 are missing. The biggest gaps are sharing and teams (they need a backend; the upstream schema and screens can be reused, but not `crates/cloudsync` or `enterprise/`), calendars off the Mac, follow-up emails and chat actions, saved recipes and briefs, integrations, and the mobile apps. Upshot already beats Granola in 19 ways, among them Linux, no account, kept audio, an editable transcript, on-device transcription, Apple Calendar, a current model picker, and a local MCP server.

## 2. Every Granola feature, and where Upshot stands

Status: Present = in the app and visible. Partial = some of it. Hidden = code is here but the UI hides it or no server runs it. Missing = no code.
Server = needs Upshot's backend beyond the AI and transcription proxy it already runs (accounts, storage, OAuth, jobs).
Short URLs: `hc/` means `https://docs.granola.ai/help-center/`. `upd` means `https://www.granola.ai/updates`.

### Setup, sign-in and platforms

| Feature | Granola | Upshot | Where in Upshot | Server |
|---|---|---|---|---|
| Desktop apps | Mac and Windows (hc/ios/getting-started) | Present (also Linux) | `.github/workflows/upshot-release.yaml` | no |
| Sign in with Google or Microsoft | Required to use the app (hc/signing-in-and-connecting-your-calendar) | Partial: optional email and password | `grandmaster/worker/src/auth.js` | yes |
| SSO sign-in, SCIM, domain capture | Enterprise (hc/sso-setup-guide) | Hidden: admin client and schema, no server | `apps/desktop/src/settings/team/client.ts`, `supabase/migrations/20260826120000_enforce_required_sso.sql` | yes |
| Managed installs (MDM) | IT guide (hc/getting-started/managed-installations) | Missing | none | no |
| First-run demo meeting | Guided demo (hc/getting-started/setting-up-granola-for-the-first-time) | Partial: onboarding and a welcome note | `apps/desktop/src/onboarding/` | no |
| Switch between accounts | Personal and work accounts (hc/managing-your-account/granola-account-and-email-changes) | Missing | none | yes |

### Calendar and notifications

| Feature | Granola | Upshot | Where in Upshot | Server |
|---|---|---|---|---|
| Google and Outlook calendar sync | By account sign-in (hc/getting-started/syncing-your-calendars) | Partial: Mac reads Google, Outlook and iCloud through the Mac's Calendar; nothing off a Mac | `apps/desktop/src/calendar/`, `crates/apple-calendar` | yes |
| Choose which calendars show | Toggle per calendar (hc/getting-started/syncing-your-calendars) | Present (Mac) | `apps/desktop/src/settings/calendar/` | no |
| "Coming up" on Home | Upcoming meetings (hc/getting-started/granola-101) | Present (Mac) | `apps/desktop/src/home/home-view.tsx` | no |
| Meeting reminder | 1 minute before (hc/taking-notes/notifications) | Present (Mac) | `apps/desktop/src/settings/general/notification.tsx` | no |
| Unscheduled call detection | Offers to take notes (hc/taking-notes/notifications) | Present | `crates/detect` | no |
| Notes-ready notification | (hc/taking-notes/notifications) | Present | `apps/desktop/src/services/enhancer/summary-notification.ts` | no |

### Recording and transcription

| Feature | Granola | Upshot | Where in Upshot | Server |
|---|---|---|---|---|
| Live transcript of mic and system audio | (hc/taking-notes/transcription) | Present | `apps/desktop/src/stt/`, `grandmaster/worker/src/stt.js` | no |
| Live meeting indicator | Floating, over other apps (hc/taking-notes/transcription) | Present | `apps/desktop/src/meeting-float/` | no |
| Stop, resume, auto-stop | Stops at call end or 15 min of silence (hc/taking-notes/transcription) | Present | `apps/desktop/src/session/components/resume-recording.tsx` | no |
| Transcript search, copy, delete parts | (hc/taking-notes/transcription) | Present: Search, Copy and Edit transcript | `apps/desktop/src/session/components/note-input/transcript-toolbar.tsx:66-68` | no |
| Speaker labels | Speaker A, B on mobile (hc/ios/transcription) | Present: You and Them, assign speakers | `.../transcript/renderer/speaker-assign.tsx` | no |
| Speaker names from Zoom, Meet, Teams | Via Accessibility or extension (hc/taking-notes/speaker-attribution) | Missing: Accessibility reads meeting details only | `crates/detect/src/meeting_ax/` | no |
| Screen snapshots | Mac beta, Teams only (hc/taking-notes/capture-shared-screens) | Missing: pasted images do feed the summary | `apps/desktop/src/store/zustand/ai-task/task-configs/enhance-workflow.ts:30` | no |
| Microphone choice | Auto follows the meeting app (hc/troubleshooting/transcription-issues) | Present | `apps/desktop/src/settings/general/index.tsx:198` | no |
| 32 languages | Switch mid-meeting on desktop (hc/customising-granola/multi-language) | Partial: pick it from the transcript bar; a live switch mid-recording is not verified | `apps/desktop/src/session/components/note-input/transcript-toolbar.tsx:148` | no |
| Personal jargon | Up to 30 terms (hc/customising-granola/customising-transcription) | Present: Dictionary | `apps/desktop/src/settings/dictionary/` | no |
| Workspace jargon | Admin, up to 50 terms (same page) | Missing | none | yes |

### Notes and AI

| Feature | Granola | Upshot | Where in Upshot | Server |
|---|---|---|---|---|
| Type your own notes, Markdown | (hc/taking-notes/taking-notes-in-granola) | Present | `apps/desktop/src/session/components/note-input/raw.tsx` | no |
| Images in notes | Paste or drag (same page) | Present | `packages/editor/src/plugins/file-handler.ts` | no |
| AI-enhanced notes | Your notes plus transcript (hc/taking-notes/ai-enhanced-notes) | Present | `apps/desktop/src/session/components/note-input/enhanced/` | no |
| Source of each summary point | Magnifying glass (same page) | Missing | none | no |
| Regenerate; switch template | (same page) | Present | `apps/desktop/src/session/components/note-input/template-picker.tsx` | no |
| @-mentions in notes | (upd, Dec 19, 2025) | Present | `apps/desktop/src/editor-bridge/mention-config.ts` | no |
| Ask AI to rewrite a note or a selection | (hc/getting-more-from-your-notes/chatting-with-your-meetings) | Partial: chat can rewrite, no rewrite-selection action | `apps/desktop/src/chat/` | no |
| Pre-meeting briefs | Overnight, Business, Google Calendar (hc/taking-notes/pre-meeting-briefs) | Missing | none | no |
| Follow-up email drafts | Auto-draft, send from Gmail (hc/taking-notes/follow-up-emails) | Partial: "Draft follow-up email" chip, no auto-draft or send | `apps/desktop/src/chat/components/recipes.tsx` | yes |
| Trash and restore | 30 days (hc/taking-notes/deleting-notes) | Partial: undo toast only | `apps/desktop/src/session/pending-soft-deletes.ts` | no |
| Chat during the meeting | (upd, Jan 16, 2025) | Present | `apps/desktop/src/chat/components/chat-panel.tsx` | no |

### Templates

| Feature | Granola | Upshot | Where in Upshot | Server |
|---|---|---|---|---|
| Built-in templates | (hc/taking-notes/customise-notes-with-templates) | Present: 9 | `apps/desktop/src/templates/bundled-templates.ts` | no |
| Custom templates | (same page) | Present | `apps/desktop/src/templates/template-form.tsx` | no |
| Pick a template mid-meeting with "/" | (same page) | Missing | none | no |
| Share templates with the workspace | (same page) | Hidden | `apps/desktop/src/resource-sharing/share-dialog.tsx:51` | yes |

### Chat and recipes

| Feature | Granola | Upshot | Where in Upshot | Server |
|---|---|---|---|---|
| Chat across all meetings | (hc/getting-more-from-your-notes/chatting-with-your-meetings) | Present | `apps/desktop/src/chat/components/chat-page.tsx` | no |
| Chat with one meeting | (same page) | Present | `apps/desktop/src/chat/components/chat-panel.tsx` | no |
| Chat with a folder or space | (hc/sharing/folders/spaces-and-folders) | Present for folders | `apps/desktop/src/folders/folder-ask.tsx` | no |
| Chat with a person or company | (hc/people-and-companies) | Hidden (Contacts hidden) | `apps/desktop/src/contacts/` | no |
| Attach files to chat | Desktop only (chatting-with-your-meetings) | Present | `apps/desktop/src/chat/components/input/index.tsx` | no |
| Chat history | Find and delete threads (same page) | Partial: Recents, no search | `apps/desktop/src/chat/store/queries.ts` | no |
| Model choice | Auto; manual on paid plans (hc/getting-more-from-your-notes/understanding-model-selection-in-granola-chat) | Present: Auto free, this week's models on Pro | `apps/desktop/src/ai/upshot-models.ts` | no |
| Inline citations in answers | (upd, Apr 21, 2026) | Missing | none | no |
| Chat actions: send email, Slack post, calendar event | With a review step (hc/getting-more-from-your-notes/workflows-in-chat) | Partial: drafts text only | `apps/desktop/src/chat/components/recipes.tsx` | yes |
| Recipes | Saved prompts, "/" menu, Discover, remix, share (hc/getting-more-from-your-notes/recipes) | Partial: fixed recipe chips | `apps/desktop/src/chat/components/recipes.tsx` | no |
| Dictation into chat | Mic in the chat bar (hc/getting-more-from-your-notes/granola-chat-dictation-vs-transcription) | Hidden ("dictation" hidden) | `apps/desktop/src/dictation/` | no |

### Folders, search and organizing

| Feature | Granola | Upshot | Where in Upshot | Server |
|---|---|---|---|---|
| Folders with icon and description | (hc/sharing/folders/spaces-and-folders) | Present | `apps/desktop/src/folders/` | no |
| Files in folders | 1 GB, 30 MB a file, 200 files (hc/troubleshooting/increased-file-limits) | Present: folder Materials | `apps/desktop/src/sidebar/folder-materials.tsx` | no |
| Subfolders | One level (spaces-and-folders) | Missing | none | no |
| Multi-select notes, bulk add to folder | (spaces-and-folders) | Missing | none | no |
| Drag notes onto sidebar folders | (spaces-and-folders) | Missing (backlog item 15) | `grandmaster/sops/ux-backlog-after-submission.md` | no |
| Auto-add a recurring meeting to its folder | (spaces-and-folders) | Missing (backlog item 16) | `grandmaster/sops/ux-backlog-after-submission.md` | no |
| Fast search | (upd, Dec 16, 2024) | Present: ⌘K across note text | `apps/desktop/src/shared/open-note-dialog.tsx` | no |
| Offline read and edit | (upd, Dec 18, 2024) | Present (local-first) | `apps/desktop/src/db/` | no |
| Dark mode | (upd, Nov 29, 2024) | Present | `apps/desktop/src/settings/appearance/` | no |

### Sharing and teams

| Feature | Granola | Upshot | Where in Upshot | Server |
|---|---|---|---|---|
| Copy notes, email, export | From the note menu (hc/sharing/sharing-notes) | Present | `apps/desktop/src/session/components/outer-header/share-menu.tsx` | no |
| Share a note by link | "Shared" button, Copy link (hc/sharing/sharing-notes) | Hidden | `apps/desktop/src/session-sharing/index.tsx` | yes |
| Invite people to a note; Viewer or Collaborator | (hc/sharing/sharing-notes) | Hidden | `apps/desktop/src/session-sharing/invite-recipients.tsx`, `access-management.tsx` | yes |
| Link access and a default for new notes | Anyone, company, private (hc/consent-security-privacy/sharing-controls) | Hidden | `apps/desktop/src/session-sharing/general-access.tsx`, `default-access.ts` | yes |
| Web viewer for shared notes | Summary only (hc/sharing/sharing-notes) | Hidden (upstream web app, not deployed) | `apps/web/src/routes/share/` | yes |
| Shared with me | (upd, Sep 17, 2025) | Hidden | `apps/desktop/src/sidebar/shared-notes.tsx`, `apps/desktop/src/shared-notes/` | yes |
| Workspaces: create, switch | Personal or team (hc/workspaces) | Hidden ("team") | `apps/desktop/src/settings/team/index.tsx` | yes |
| Invite teammates | Email, link, people you meet (hc/workspaces) | Hidden | `apps/desktop/src/settings/team/invitation.ts` | yes |
| Roles; remove; leave; delete workspace | Admin and Member (hc/workspaces) | Hidden | `apps/desktop/src/settings/team/index.tsx` | yes |
| Domain auto-join | (hc/workspaces) | Hidden | `apps/desktop/src/settings/team/email-auto-join.tsx` | yes |
| Spaces | My notes, team space, custom spaces (spaces-and-folders) | Missing | none | yes |
| Share a folder with members or a link | Owner and member rights (spaces-and-folders) | Hidden: shares a frozen copy, not a live folder | `apps/desktop/src/resource-sharing/payloads.ts` | yes |
| User groups | Enterprise (hc/sharing/user-groups) | Missing | none | yes |
| Move notes to another workspace | One or all (hc/transfer-notes-between-workspaces) | Missing | none | yes |

### Integrations, API and MCP

| Feature | Granola | Upshot | Where in Upshot | Server |
|---|---|---|---|---|
| Slack | Share a note; auto-post a folder (hc/sharing/integrations/slack) | Hidden ("automations": slack_recap) | `apps/desktop/src/automations/`, `apps/desktop/src/session-sharing/delivery-client.ts` | yes |
| Notion | Send a note to a database (hc/sharing/notion) | Hidden (automations: notion_update) | `apps/desktop/src/automations/` | yes |
| HubSpot, Attio | File notes on records by folder (hc/sharing/integrations/hub-spot, hc/sharing/integrations/attio) | Hidden ("crm") | `apps/desktop/src/crm/` | yes |
| Affinity | (hc/sharing/integrations/affinity) | Missing | none | yes |
| Zapier | 8,000 apps (hc/sharing/integrations/zapier) | Partial: webhooks work with Zapier "Catch Hook" | `apps/desktop/src/settings/developers/webhooks.tsx` | yes |
| Per-folder auto-post rules | (spaces-and-folders) | Missing | none | yes |
| REST API with keys | Business (hc/sharing/integrations/granola-api) | Hidden: upstream cloud API keys page, never rendered | `apps/desktop/src/settings/developers/cloud-api.tsx`, `apps/desktop/src/cloud-api/client.ts` | yes |
| Webhooks | Signed events (docs.granola.ai/webhooks) | Present (local, signed) | `apps/desktop/src/settings/developers/webhooks.tsx` | no |
| MCP for Claude, ChatGPT, Cursor | Hosted (hc/sharing/integrations/mcp) | Present: local MCP via the CLI | `apps/cli/src/mcp.rs` | no |
| Audit log, legal holds | Enterprise API (docs.granola.ai/legal-holds) | Missing | none | yes |

### People, export and account

| Feature | Granola | Upshot | Where in Upshot | Server |
|---|---|---|---|---|
| People and Companies | Built from meetings (hc/people-and-companies) | Hidden ("contacts") | `apps/desktop/src/contacts/` | no |
| CSV export of all notes | Emailed link (hc/sharing/exporting-notes) | Missing: one note at a time | `apps/desktop/src/session/components/outer-header/overflow/export-modal.tsx` | no |
| Import from another account | (hc/transfer-notes-between-accounts) | Partial: imports Granola meetings | `apps/desktop/src/imports/` | no |
| Change email; Google to Microsoft | (hc/migrating-to-a-microsoft-account-in-granola) | Missing | none | yes |
| Delete account | (hc/deleting-your-account) | Present | `grandmaster/worker/src/billing.js`, `apps/desktop/src/settings/profile/` | yes |
| Profile for better notes | Name, job title, context (hc/customising-granola/profile-and-preferences) | Present | `apps/desktop/src/settings/profile/` | no |
| Beta features opt-in | (same page) | Missing | none | no |

### Billing

| Feature | Granola | Upshot | Where in Upshot | Server |
|---|---|---|---|---|
| Plans | Basic free (30 days), Business $14 a user, Enterprise from $35 (hc/managing-your-account/subscriptions-and-billing) | Partial: Free and Pro ($14 monthly, $11 yearly), per person | `apps/desktop/src/settings/plan.tsx` | yes |
| Per-workspace, per-seat billing | Prorated (hc/managing-your-account/understanding-your-invoice) | Hidden (upstream schema) | `supabase/migrations/20260811170000_workspace_billing_and_seats.sql` | yes |
| Invoices, tax IDs, cancel any time | Stripe portal (subscriptions-and-billing) | Present | `grandmaster/worker/src/billing.js` | yes |
| Coupons; checkout link for an approver | (subscriptions-and-billing) | Missing | none | yes |
| Referral program | 2 months free (hc/managing-your-account/referral-program) | Missing | none | yes |
| Affiliate, startup and student programs | (hc/managing-your-account/affiliate-program) | Missing | none | yes |

### Privacy, consent and admin

| Feature | Granola | Upshot | Where in Upshot | Server |
|---|---|---|---|---|
| Model training opt-out | Opt-out toggle (hc/consent-security-privacy/model-training) | Present: no training at all | `README.md` | no |
| Transcript auto-deletion | 1 day to 1 year (hc/consent-security-privacy/transcript-auto-deletion) | Partial: audio retention only | `apps/desktop/src/services/audio-retention-policy.ts` | no |
| Recording notice to participants | Auto chat message (hc/consent-security-privacy/transparency-solutions/introduction) | Present: optional chat message in Zoom, Meet, Teams, Slack, Webex | `apps/desktop/src/stt/meeting-disclosure.ts`, `apps/desktop/src/settings/general/index.tsx:343` | no |
| Watermark on your video | Virtual camera (hc/consent-security-privacy/transparency-solutions/for-individuals/watermark) | Missing | none | no |
| Admin policies | Sharing, export, transfer, training, retention (hc/workspaces) | Hidden (policy RPCs) | `apps/desktop/src/settings/team/client.ts` | yes |
| SOC 2, GDPR DPA, HIPAA BAA | (hc/consent-security-privacy/security-privacy-data-faqs) | Missing (company work) | none | yes |
| Network check | Settings › Troubleshooting (hc/troubleshooting/network-troubleshooting) | Missing | none | no |

### Mobile and watch

| Feature | Granola | Upshot | Where in Upshot | Server |
|---|---|---|---|---|
| iOS and Android apps | In-person notes (hc/ios/getting-started) | Missing (upstream Expo app unused) | `apps/mobile/` | yes |
| Sync with desktop | (hc/ios/syncing-with-desktop) | Hidden (sqlite-sync, needs SQLite Cloud) | `apps/desktop/src/auth/cloudsync.ts` | yes |
| Apple Watch | watchOS 11 (hc/ios/apple-watch) | Missing (upstream app unused) | `apps/watch/` | yes |
| Phone call notes | iOS, outbound (hc/ios/phone-calls) | Missing | none | yes |

## 3. Upshot already does more

| Upshot has, Granola does not | Granola evidence | Upshot code |
|---|---|---|
| Linux builds (AppImage and .deb), plus Mac and Windows | Granola desktop is macOS and Windows only (hc/ios/getting-started) | `.github/workflows/upshot-release.yaml`, `apps/desktop/flatpak/` |
| Notes, folders and search work signed out (Oct 5: Upshot AI and transcription need Google or Microsoft sign-in, as Granola) | Sign-in with Google, Microsoft or SSO is required for everything (hc/signing-in-and-connecting-your-calendar) | `grandmaster/sops/sign-in-setup.md` |
| Keeps your audio; click a word to hear it | "Audio or video recording and storage: not planned" (hc/feature-requests) | `apps/desktop/src/audio-player/`, `apps/desktop/src/services/audio-retention-policy.ts` |
| Edit the transcript text | "Not currently possible to edit transcript sections" (hc/feature-requests) | `apps/desktop/src/session/components/note-input/transcript/renderer/segment.tsx:360` |
| On-device transcription on Apple Silicon (Apple Speech, Parakeet) | Audio goes to Granola's transcription provider (hc/taking-notes/transcription) | `crates/transcribe-speechanalyzer`, `crates/transcribe-soniqo`, `apps/desktop/src/settings/ai/stt/select.tsx` |
| Notes live on your computer; no training on your data | Notes are stored on AWS in the US, no regional choice; Free and Business data may train Granola's models unless you opt out (hc/consent-security-privacy/security-privacy-data-faqs) | `README.md` ("Where your data lives"), `apps/desktop/src/db/` |
| Apple Calendar and iCloud calendars | "Apple Calendar: not supported" (hc/feature-requests) | `crates/apple-calendar`, `apps/desktop/src/calendar/` |
| Model picker with this week's models from Anthropic, OpenAI and Google, rebuilt at launch | Auto, or a short fixed list on Business (hc/getting-more-from-your-notes/understanding-model-selection-in-granola-chat); "bring your own models: not supported" (hc/feature-requests) | `apps/desktop/src/ai/upshot-models.ts` |
| Set a default template | "Not currently possible to set a default template" (hc/feature-requests) | `apps/desktop/src/templates/template-form.tsx:269-285` |
| Full note history on the free plan | Basic shows only the last 30 days (hc/managing-your-account/subscriptions-and-billing) | Local SQLite, no history limit (`apps/desktop/src/db/`) |
| Locked notes, kept out of chat, MCP and export until unlocked | No equivalent in the help center | `apps/desktop/src/lock/` |
| Local MCP server and CLI, offline, no account | Granola MCP is hosted and needs sign-in (hc/sharing/integrations/mcp) | `apps/cli/src/mcp.rs` |
| Local webhooks with a signing secret on every plan | Webhooks need Business or Enterprise (docs.granola.ai/webhooks) | `apps/desktop/src/settings/developers/webhooks.tsx` |
| Import Granola meetings | Granola imports only from another Granola account (hc/transfer-notes-between-accounts) | `apps/desktop/src/imports/` |
| Folder files stay on your disk, with no size cap in code | 1 GB per folder, 30 MB per file, 200 files (hc/troubleshooting/increased-file-limits) | `apps/desktop/src/sidebar/folder-materials.tsx`, `apps/desktop/src/session/folder-attachments.ts` |
| Live "can't hear the other side" warning while recording | Not in the help center | `README.md` (recording bar meters) |
| The recording notice stops listening when a participant declines | Granola's chat message only announces (hc/consent-security-privacy/transparency-solutions/introduction) | `apps/desktop/src/stt/useStartListening.ts:318-324` |
| Insights page with meeting stats | Not in the help center | `apps/desktop/src/settings/stats/` |
| Yearly price ($11 a month billed yearly) | Business is monthly only; annual is Enterprise only (hc/managing-your-account/subscriptions-and-billing) | `apps/desktop/src/settings/plan.tsx`, `grandmaster/worker/src/billing.js` |

## 4. Phased plan

Sizes: S = up to 1 day. M = 2 to 5 days. L = 1 to 3 weeks. XL = more than 3 weeks.

### Phase 1: Sharing and Teams

How Granola does it (the bar to match):
- Notes are private by default. The "Shared" button shows who has access, copies a link, and invites people by email. Recipients are Viewers by default; a Collaborator can edit. Viewers can read, hover for transcript context, and use Chat, but not read the full transcript. The web viewer shows the summary only. Sharing a note never adds a seat. (hc/sharing/sharing-notes)
- Link access per note: Anyone with the link, Only my company, or Private. A default for new notes lives in Settings › Preferences › Data & sharing. Enterprise admins can force one level for all notes and folders. (hc/consent-security-privacy/sharing-controls)
- Workspaces: personal or team, same account. Switch from the workspace name at bottom left. Create with name and logo, optional auto-join by email domain, discoverable or not. Invite by email, invite link, or "people you meet with". Roles: Admin and Member. Remove, leave (needs another workspace), delete (needs no other members and no subscription). Move one note or all notes to another workspace. (hc/workspaces, hc/transfer-notes-between-workspaces)
- Spaces: "My notes" (private) and the team space (everyone in the workspace). Admins can add custom spaces with their own members. Folders belong to a space; subfolders inherit it. Folder members are added by email and get an email; link access is Invited only, Everyone at the workspace, or Anyone with the link. Owners vs members have different rights. App collaborators get transcripts; web viewers do not. (hc/sharing/folders/spaces-and-folders)
- "Shared with me" lists notes others shared (upd, Sep 17, 2025). Templates and recipes can be shared with the workspace or by link (hc/taking-notes/customise-notes-with-templates, hc/getting-more-from-your-notes/recipes). User groups are Enterprise only (hc/sharing/user-groups).
- Billing is per workspace and per seat, prorated when people join or leave (hc/managing-your-account/understanding-your-invoice).

What is already in this repo (upstream Anarlog):

| Piece | Where | What it does | Reuse or rebuild |
|---|---|---|---|
| Note share dialog | `apps/desktop/src/session-sharing/` (`index.tsx` SessionShareButton, `general-access.tsx`, `invite-recipients.tsx`, `access-management.tsx`, `comments.tsx`, `delivery-panel.tsx`) | Share button, link access (restricted, link, workspace, public), email invites, access grants, comments, Slack and email delivery | Reuse the client and logic; restyle as Granola's "Shared" popover. Hidden today by an early return in `apps/desktop/src/session/components/outer-header/index.tsx:148-152` |
| Shared with me | `apps/desktop/src/shared-notes/`, `apps/desktop/src/sidebar/shared-notes.tsx` | Local cache of notes others shared, preview, deep links | Reuse |
| Team settings | `apps/desktop/src/settings/team/` ("team" in HIDDEN_SETTINGS) | Create a workspace, name, logo, members, roles, invitations, seat usage, email-domain auto-join, ownership transfer, leave, delete | Reuse; split into Settings › Workspace › General and Members, as Granola |
| Share templates, recipes, folders | `apps/desktop/src/resource-sharing/` (`SHARING_AVAILABLE = false` at `share-dialog.tsx:51`) | Publishes a copy to a guest or the whole team; a library section imports it | Reuse for templates and recipes. A shared folder here is a frozen copy (`payloads.ts`, SharedFolderPayload), so rebuild folders as live membership |
| Database and rules | `supabase/migrations/` (53 workspace and sharing files of 153), `supabase/tests/` (64 SQL test files) | Workspaces, members, invitations, note shares, snapshots, grants, comments, shared resources, policies, SSO and SCIM, seat billing | Port a trimmed subset into Upshot's own Supabase project, which has Upshot's `subscriptions` table (`grandmaster/sops/night-log.md:67`); the upstream `supabase/` folder is unused today (`grandmaster/sops/red-team.md:6`) |
| Share service | `crates/api-sync` (`routes/session_shares.rs`, `shared_attachments.rs`, `live_docs.rs`), run by `apps/api` on Fly.io ("sync" role) | Publishes snapshots (RPC `publish_session_share_snapshot_with_attachments`), web edits, live Yjs editing, attachments | Rebuild the publish and read endpoints in the Cloudflare Worker first. Leave live co-editing for later |
| Web viewer and invites | `apps/web/src/routes/share/`, `apps/web/src/routes/invite/`, `apps/web/src/routes/team/`, `apps/web/src/cloudflare/workspace-share-router.ts` | Read a shared note in a browser; accept an invite | Port a small viewer into the Worker (`grandmaster/worker/public/`), in Upshot's brand |
| Seat billing | `supabase/migrations/20260811170000_workspace_billing_and_seats.sql`, `apps/stripe/` | Per-seat Stripe billing for team workspaces | Rebuild on the Worker's existing Stripe code (`grandmaster/worker/src/billing.js`) with a seat quantity |
| Cloud sync | `crates/cloudsync` (sqlite-sync, ELv2), `apps/desktop/src/auth/cloudsync*.ts`, SQLite Cloud settings in `crates/api-sync/src/config.rs` | Syncs the whole database; upstream team workspaces ride on it with end-to-end key grants | Do not use. CLAUDE.md says do not touch `crates/cloudsync`, and it needs a SQLite Cloud account, a third-party service |
| Enterprise | `enterprise/` | Control plane, Meet, Zoom and Teams capture workers | Do not use. Not MIT: `LICENSE.enterprise` grants no rights without a written agreement with Fastrepl |

Limits that shape the build:
- CLAUDE.md: do not touch `crates/cloudsync`, LICENSE files, `@anlg/*` and `anlg-*` names. No dependency upgrades. No API keys in the repo, build or bundle.
- The upstream clients call Supabase straight from the app with an anon key (`apps/desktop/src/auth/client.ts:78-79` builds the client only when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set). Upshot ships no Supabase key, so every call goes through the Worker: it adds the key and forwards the user's token (the pattern `grandmaster/worker/src/auth.js` already uses).
- Everything outside `enterprise/` is MIT (root `LICENSE`). Keep the Anarlog credit in README and NOTICE.

Two ways to build it:
1. Run the upstream stack: apply the Supabase migrations, deploy `apps/api` (Fly.io) and `apps/web` (Vercel). Most code is done, but it adds two services, Anarlog's billing model, and a key in the app unless proxied.
2. Recommended: port the trimmed schema into Upshot's Supabase, put every call behind the existing Worker, reuse the desktop UI and clients, and serve a small web viewer from the Worker. One backend, no keys in the app. Live co-editing and synced workspaces wait.

Server work (option 2):

| # | Build | Granola source | Size |
|---|---|---|---|
| S1 | Google and Microsoft sign-in (Supabase OAuth) next to email and password, so invites and domain auto-join work | hc/signing-in-and-connecting-your-calendar | M |
| S2 | Workspaces: personal by default, team workspaces, name, logo, domain auto-join, discoverable flag, Admin and Member roles, remove, leave, delete rules | hc/workspaces | M |
| S3 | Invitations: by email and by link, accept, decline, resend, revoke, expiry; invite email sender | hc/workspaces | M |
| S4 | Note shares: publish a snapshot (summary and my notes; no transcript for web viewers), access list with Viewer and Collaborator, link access (Private, Workspace, Anyone with link), per-user default | hc/sharing/sharing-notes, hc/consent-security-privacy/sharing-controls | L |
| S5 | Spaces and shared folders: My notes, team space, admin custom spaces, folder members, folder link access, owner vs member rights, notes in a shared folder readable by members | hc/sharing/folders/spaces-and-folders | L |
| S6 | "Shared with me" list and change feed | upd (Sep 17, 2025) | S |
| S7 | Web viewer for shared notes and folders (summary only), with "Open in Upshot" and sign-in for invited people | hc/sharing/sharing-notes | M |
| S8 | Row-level security for every table, rate limits on the new Worker routes, and the upstream SQL tests ported | hc/consent-security-privacy/sharing-controls | M |
| S9 | Team plan: per-workspace, per-seat Stripe billing, prorated; sharing a note stays free | hc/managing-your-account/understanding-your-invoice | M |
| S10 | Shared templates and recipes (workspace or link) | hc/taking-notes/customise-notes-with-templates, hc/getting-more-from-your-notes/recipes | S |
| S11 | Move one note or all notes to another workspace, with a preview | hc/transfer-notes-between-workspaces | M |

App work:

| # | Build | Granola source | Size |
|---|---|---|---|
| A1 | "Share" button in the note header opens a popover: who has access, invite by email, role per person, link access, Copy link. Copy notes, Email and Export stay in the menu | hc/sharing/sharing-notes | M |
| A2 | Workspace switcher at the bottom left, with "Add workspace" | hc/workspaces | S |
| A3 | Sidebar spaces: "My notes" and the team space, each with folders and a "+"; "Shared with me" view | hc/sharing/folders/spaces-and-folders | M |
| A4 | Settings › Workspace › General and Members, from the hidden team page, restyled to the Settings cards | hc/workspaces | M |
| A5 | Folder header "Share": members, link access; "Leave folder" for members | hc/sharing/folders/spaces-and-folders | M |
| A6 | Note row ⋯ "Move to workspace"; Settings danger zone "Transfer notes" | hc/transfer-notes-between-workspaces | S |
| A7 | Shared copies cached for offline reading; badges for new shared notes | upd (Dec 18, 2024 offline access) | S |
| A8 | Settings › Privacy: default link access for new notes | hc/consent-security-privacy/sharing-controls | S |

Order:
- 1a: share one note by link and email, Viewer access only, web viewer, Shared with me (S1, S4, S6, S7, S8, the email sender from S3, A1, A7, A8).
- 1b: workspaces, members, invitations, team space folders (S2, S3, S5, A2 to A5).
- 1c: Collaborator editing, custom spaces, shared templates and recipes, transfers (S10, S11, A6).
- 1d: Team billing (S9).

### Phase 2 and later

Ordered by user value, then effort. Each line: what to build, the Granola source, size.

**Phase 2: meeting quality (local, high value, no new server)**

| Build | Granola source | Size |
|---|---|---|
| Trash: deleted notes stay 30 days, with a Trash view and Restore | hc/taking-notes/deleting-notes | S |
| Multi-select notes (checkbox, Shift-click, Select all) and "Add to folder" for the selection | hc/sharing/folders/spaces-and-folders | S |
| Drag notes onto sidebar folders (backlog item 15) | hc/sharing/folders/spaces-and-folders | S |
| "Auto-add future meetings?" after filing a recurring meeting (backlog item 16) | hc/sharing/folders/spaces-and-folders | M |
| People and Companies: restyle and unhide Contacts, with chat about a person or company | hc/people-and-companies | M |
| Dictation: unhide it and add a mic button to the chat bar | hc/getting-more-from-your-notes/granola-chat-dictation-vs-transcription | S |
| Chat history search | hc/getting-more-from-your-notes/chatting-with-your-meetings | S |
| Subfolders, one level deep, by menu or drag | hc/sharing/folders/spaces-and-folders | M |
| Saved recipes: create, edit, "/" menu in chat, run on one note or a folder, remix | hc/getting-more-from-your-notes/recipes | M |
| Show the transcript source of any summary line (Granola's magnifying glass) | hc/taking-notes/ai-enhanced-notes | M |
| Inline citations to meetings in chat answers | upd (Apr 21, 2026, Agentic Chat) | M |
| Pick a template mid-meeting by typing "/" in my notes | hc/taking-notes/customise-notes-with-templates | S |
| Pre-meeting briefs from past notes with the same people (Granola: Google Calendar only, Business) | hc/taking-notes/pre-meeting-briefs | M |
| Transcript retention: auto-delete after 1 day to 1 year, next to the audio setting | hc/consent-security-privacy/transcript-auto-deletion | S |
| Screen snapshots of shared screens attached to the note (Granola: Mac beta, Teams only) | hc/taking-notes/capture-shared-screens | L |
| Speaker names from Zoom, Meet and Teams | hc/taking-notes/speaker-attribution | L |

**Phase 3: calendar, email and accounts (server, OAuth)**

| Build | Granola source | Size |
|---|---|---|
| Google Calendar and Outlook by account, so Windows and Linux get "Coming up" and reminders | hc/getting-started/syncing-your-calendars | M |
| Follow-up email: auto-draft after external meetings, edit, send or save to Gmail drafts, undo | hc/taking-notes/follow-up-emails | M |
| Chat actions with a review step: send an email, post to Slack, create a calendar event | hc/getting-more-from-your-notes/workflows-in-chat | M |
| Switch between accounts; change email; import notes from another Upshot account | hc/managing-your-account/granola-account-and-email-changes, hc/transfer-notes-between-accounts | M |
| Billing extras: coupon codes, a checkout link for an approver | hc/managing-your-account/subscriptions-and-billing | S |
| Referral program (2 months free for both) | hc/managing-your-account/referral-program | M |

**Phase 4: integrations and developer platform**

Reuse first: hidden upstream automations (`apps/desktop/src/automations/`: slack_recap, notion_update, linear_issues, google_drive_export) and CRM code (`apps/desktop/src/crm/`: HubSpot, Attio, Salesforce). Their sign-ins run through Nango in `apps/api` (core role, per `apps/api/AGENTS.md`), so each needs a server piece.

| Build | Granola source | Size |
|---|---|---|
| Slack: share a note to a channel; auto-post notes added to a folder | hc/sharing/integrations/slack | M |
| Notion: send a note to a Notion database | hc/sharing/notion | M |
| HubSpot, Attio, Affinity: file notes on contacts, companies and deals, by folder rule | hc/sharing/integrations/hub-spot, hc/sharing/integrations/attio, hc/sharing/integrations/affinity | L |
| Zapier app (Upshot's webhooks already work with "Catch Hook") | hc/sharing/integrations/zapier | M |
| Per-folder auto-post rules (folder header "Integrations") | hc/sharing/folders/spaces-and-folders | M |
| Public REST API with personal and workspace keys | hc/sharing/integrations/granola-api | M |
| Hosted MCP for Claude, ChatGPT and Cursor, next to the local one | hc/sharing/integrations/mcp | M |
| CSV export of every note (title, summary, transcript, attendees) | hc/sharing/exporting-notes | S |

**Phase 5: mobile and watch**

| Build | Granola source | Size |
|---|---|---|
| Note sync between devices on Upshot's own backend (not sqlite-sync) | hc/ios/syncing-with-desktop | XL |
| iOS and Android apps for in-person meetings, from the upstream Expo app in `apps/mobile/` | hc/ios/getting-started | XL |
| Apple Watch app, from `apps/watch/` | hc/ios/apple-watch | L |
| Phone call notes on iOS | hc/ios/phone-calls | L |

**Phase 6: enterprise and trust**

| Build | Granola source | Size |
|---|---|---|
| Network check in Settings, plus an allowlist page for IT | hc/troubleshooting/network-troubleshooting | S |
| Watermark on your video (virtual camera) | hc/consent-security-privacy/transparency-solutions/for-individuals/watermark | XL |
| Admin policies: link sharing level, export and transfer rights, retention, allowed models | hc/workspaces, hc/consent-security-privacy/transcript-auto-deletion | M |
| SSO and SCIM, domain capture, user groups | hc/sso-setup-guide, hc/sharing/user-groups | L |
| Audit log and legal holds APIs | docs.granola.ai/api-reference/list-audit-events, docs.granola.ai/legal-holds | L |
| MDM install guide, signed and notarized builds | hc/getting-started/managed-installations | M |
| SOC 2 Type II, DPA, HIPAA BAA (company work, not code) | hc/consent-security-privacy/security-privacy-data-faqs, hc/consent-security-privacy/is-granola-hipaa-compliant | XL |

## 5. Open questions for Adam

1. Backend: port the sharing schema into Upshot's Supabase behind the Worker (recommended), or run Anarlog's Fly.io and Vercel services?
2. Default link access: Granola offers Anyone with the link, Only my company, or Private. Upshot's pitch calls public links a Granola weakness (`grandmaster/features.md:24`). Should new notes default to Private (invited people only)?
3. Pricing: is sharing free on every plan (as in Granola), with a per-seat Team plan for workspaces? At what price per seat?
4. Sign-in: add Google and Microsoft sign-in in Phase 1? It makes domain auto-join safe. Calendar and Gmail access later need Google's app verification.
5. Shared notes and audio: Granola gives app collaborators the transcript. Should members also hear the audio, which is Upshot's edge, or should audio never leave the owner's computer?
