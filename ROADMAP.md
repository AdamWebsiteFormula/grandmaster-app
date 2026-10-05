# Upshot roadmap

Upshot 1.0 is out for Mac, Windows and Linux. The plan is to match everything Granola does, then go further.

## Where Upshot stands today

Granola's help center describes 106 features (counted on Oct 4, 2026).

| | Features |
|---|---|
| In Upshot today | 39 |
| Partly in Upshot | 14 |
| Designed, waiting for the server | 22 |
| Still to build | 31 |

"Designed" means the screens and data model already exist in Anarlog, the open-source app Upshot is built on. They need Upshot's own server before they can switch on, so they come faster than starting from zero.

## Where Upshot already goes further

- Runs on Linux as well as Mac and Windows.
- Works with no account and no sign-in.
- Keeps your audio. Click any word in the transcript to hear it.
- Lets you edit the transcript.
- Transcribes on your Mac on Apple silicon, if you choose.
- Reads Apple Calendar and iCloud calendars.
- Lets Pro users pick this week's models from Anthropic, OpenAI and Google.
- Keeps your full note history on the free plan, on your computer.
- Includes a local MCP server, a CLI and webhooks, with no account.
- Stops recording if a participant declines the meeting-chat notice.

## The plan

Sizes: S is up to a day, M is 2 to 5 days, L is 1 to 3 weeks, XL is more than 3 weeks.

### Phase 1: Sharing and teams (starts right after launch)

| Step | What | Size |
|---|---|---|
| 1a | Share a note by link or email, with a read-only web view | L |
| 1a | Client recap link with proof: summary, transcript and the real audio, private by default, with an expiry | M |
| 1a | "Shared with me" in the sidebar, readable offline | S |
| 1a | Default link access for new notes, private unless you choose | S |
| 1a | Sign in with Google or Microsoft | M |
| 1a | A free account for hosted AI and transcription, with limits per person; notes, folders and search keep working without one | M |
| 1b | Team workspaces with members, roles and invitations | M |
| 1b | Workspace switcher and a team space beside My notes | M |
| 1b | Shared folders with members and link access | L |
| 1c | Collaborators who can edit a shared note | M |
| 1c | Share templates and recipes with your team | S |
| 1c | Move notes between workspaces | M |
| 1d | Per-seat billing for team workspaces; sharing a note stays free | M |

### Phase 2: Better meeting notes

| What | Size |
|---|---|
| Trash with 30-day restore | S |
| Select many notes and add them to a folder; drag notes onto folders | S |
| Auto-add future meetings from a recurring series to its folder | M |
| Saved recipes with a "/" menu in chat | M |
| See the transcript behind any summary line; citations in chat answers | M |
| People and companies, with chat about a person | M |
| Subfolders, pre-meeting briefs and transcript auto-delete | M |
| Speaker names from Zoom, Meet and Teams | L |
| Video recording, kept on your computer, free | L |
| Cloud video storage for Pro, 10 GB per person (as Zoom Pro) | M |
| A monthly cloud transcription limit (Pro 1,200 minutes, Free less); on-device transcription stays unlimited | S |
| Automatic updates, so fixes arrive without a new download | M |
| Save every note as plain Markdown files in a folder you pick, such as an Obsidian vault | S |
| Your own actions: drop a prompt file in a folder and it becomes a one-click action on any note | M |
| Promises across meetings: who owes whom what, with a morning reminder | M |
| Never miss a recording: a check before each calendar meeting, and an alert when a call happened but nothing was captured | S |

### Phase 3: Calendar, email and accounts

| What | Size |
|---|---|
| Google Calendar and Outlook by account, so Windows and Linux get reminders | M |
| Follow-up emails: auto-draft, edit, then send from your own Gmail or Outlook with an undo, or save as a draft | M |
| Chat actions with a review step: email, Slack, calendar events | M |
| Account switching, email changes and a referral program | M |

### Phase 4: Integrations and developers

| What | Size |
|---|---|
| Slack and Notion, including auto-post from a folder | M |
| HubSpot, Attio and Affinity | L |
| Zapier app, public API keys and a hosted MCP server | M |
| Export every note to CSV | S |

### Phase 5: Phone and watch

| What | Size |
|---|---|
| Notes that sync between your devices | XL |
| iPhone and Android apps for in-person meetings | XL |
| Apple Watch app and phone-call notes | L |

### Phase 6: Enterprise and trust

| What | Size |
|---|---|
| Admin policies, SSO, SCIM and user groups | L |
| Audit log and legal holds | L |
| Signed and notarized builds with a managed-install guide | M |
| SOC 2 Type II, DPA and HIPAA BAA | XL |

## Ideas to consider later

Not planned yet. Research notes in `grandmaster/sops/feature-research-oct5.md`.

- A proposal draft from a discovery call, in your own template, with signing handed to PandaDoc or DocuSign.
- A highlight reel of the key moments, cut from the real audio.
- Notes sent where your work lives: Google Docs, task managers and Salesforce.
- An audio recap read by an AI voice.
- A video recap with highlights and voiceover, after video recording ships.
- Social posts, reels and carousels from talks meant to be public, such as podcasts, interviews and webinars.

Feature counts and comparisons come from Granola's public help center, read on Oct 4, 2026. Sizes are estimates.
