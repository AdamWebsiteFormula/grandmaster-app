# Best practices gap: Upshot vs Granola and the other AI notetakers

Oct 2, 2026. Research only, no code changed. Sources were fetched on Oct 2. Each Upshot claim was checked by grep in `apps/desktop/src` (paths below are relative to it unless they start with `crates/`, `plugins/` or `apps/`).

Key: Granola docs base = `https://docs.granola.ai/help-center` (written as `G/...`). Impact = how much it changes a judge's 2-minute test (record, stop, look at the notes, poke around). Effort: S = under 1 h, M = 1 to 3 h, L = more than 3 h.

Caveats: Reddit pages could not be fetched, so the user complaints marked "(excerpt)" come from search snippets. Comparison posts by Krisp, tl;dv, Shadow and Klu are written by competitors, so treat what they say about rivals with care.

## 1. Gap table

| Practice | Who does it (source) | Upshot today | Impact | Effort |
|---|---|---|---|---|
| Built-in template library for each meeting type | Granola: 29 built-in templates, opened with `/` (G/taking-notes/customise-notes-with-templates, https://www.granola.ai/updates). Jamie: a template library with auto-apply (https://docs.meetjamie.ai/enterprise/users/templates) | **Effectively missing.** The gallery loads from `https://anarlog.so/api/templates` (`shared/ui/resource-list/hooks.ts`), which returns `[]` today, so the picker shows only "Auto". This is also a network call to the upstream host that the README's "What leaves your Mac" section does not mention | High | S |
| One-click copy of the notes | Granola: "Copy as markdown" (G/sharing/sharing-notes). Otter: copy to clipboard (https://help.otter.ai/hc/en-us/articles/360047733634-Export-conversations) | **Hidden.** Copy is only on a right-click of the Summary tab title (`session/components/note-input/header-enhanced.tsx`, `contextMenu`). The Memo and Transcript headers do have Copy | High | S |
| Follow-up email draft | Granola: paid plan with Gmail (G/taking-notes/follow-up-emails). Fathom: Ask Fathom drafts it in your voice (https://help.fathom.video/en/articles/6220097). Shadow: drafts it automatically after the meeting (https://www.eesel.ai/blog/shadow-review) | **Partial.** Only a chat chip, "Draft follow-up email." (`chat/components/body/empty.tsx`), and you have to open chat with ⌘J to see it | High | S |
| Regenerate notes with another template | Granola: sparkle picker plus regenerate (G/taking-notes/ai-enhanced-notes) | **Exists.** Click the Summary title for the template picker. Regenerate is also on right-click (`note-input/template-picker.tsx`) | Med | done |
| Notes enhance automatically on stop | Granola (G/taking-notes/ai-enhanced-notes) | **Exists** (`services/enhancer/index.ts`). An empty summary shows "Generate summary" (`note-input/enhanced/generate-summary.tsx`) | High | done |
| Next steps with owners | Granola templates. Fireflies and Krisp assign action items (https://krisp.ai/ai-meeting-assistant/) | **Exists.** A "# Next Steps" section with owners and deadlines when no template is chosen (`crates/template-app/assets/enhance.format.md.jinja`). Missing: a list of todos across meetings. The Reminders/Linear "todo" settings tab is routed but has no menu entry (`settings/todo/*`) | Med | M |
| Chat across all meetings, with starter prompts | Granola: chat from home over all meetings, plus Recipes (G/getting-more-from-your-notes/chatting-with-your-meetings, G/getting-more-from-your-notes/recipes). Fathom: account-wide Ask (https://help.fathom.video/en/articles/6220097) | **Exists, but blank on home.** Chat tools search every meeting (`chat/tools/index.ts`). The starter chips show only when a note is in context (`hasContext` in `chat/components/body/empty.tsx`), so home chat opens with no ideas | Med | S |
| Search note contents from ⌘K | Granola: offline search by person or company (https://www.granola.ai/updates). Fireflies: sentence-level search (https://fireflies.ai/). Notion: searchable meetings list (https://www.notion.com/help/ai-meeting-notes) | **Partial.** ⌘K matches titles only (`shared/open-note-dialog.tsx`, lines 235-250). The full-text engine exists but is used only by chat and @-mentions (`search/contexts/engine/index.tsx`, `plugins/tantivy`) | Med | M |
| Recording notice / consent message | Granola: automated chat message and a camera watermark (G/consent-security-privacy/transparency-solutions/introduction). Fathom: always a notice (https://help.fathom.video/en/articles/6150977). Fireflies desktop: badge, spoken notice and chat message, on by default (https://guide.fireflies.ai/articles/7003995379) | **Exists, but hard to find and off by default.** Settings › Meetings › "Post recording disclosure in meeting chat" (`stt/meeting-disclosure.ts`; `consent_auto_send_chat` defaults to false in `settings/schema.ts`) | Med | S |
| Calendar connected at first run | Granola: calendar during setup, plus "Coming up" (G/getting-started/setting-up-granola-for-the-first-time, G/getting-started/syncing-your-calendars). Granola has no Apple Calendar | **Hidden.** Apple Calendar works (Settings › Calendar; 5-min reminders; tray agenda), but the onboarding step was removed with Google and Outlook (`onboarding/config.tsx`, line 13). The step component is still there (`onboarding/calendar.tsx`) | Med | S |
| Prompt before a meeting, with one click to record | Granola: popup 1 minute before, and "Meeting detected" for ad-hoc calls (G/taking-notes/notifications). Jamie: prompt or auto-start with a cancel countdown (https://docs.meetjamie.ai/getting-started/auto-start-recording) | **Exists.** Mic detection prompt (on by default), event reminders, and "Start when meeting begins" (default on) (`stt/detect-events.ts`, `settings/general/notification.tsx`) | Med | done |
| Auto-stop when the call ends | Granola: stops on call end or 15 min of silence (G/taking-notes/transcription) | **Exists.** "Stop when meeting ends" defaults to on (`stt/auto-stop.ts`) | Med | done |
| Resume a finished meeting | Granola (G/taking-notes/transcription) | **Exists.** "Resume listening" (`note-input/header-transcript.tsx`, `outer-header/overflow/listening.tsx`) | Low | done |
| Capture health while recording | No vendor documents a live meter. Granola tells you to check afterward (G/troubleshooting/transcription-issues). Users call silent failure a dealbreaker (Reddit, excerpt: https://www.reddit.com/r/ArtificialInteligence/comments/1r05e7g/) | **Exists, better.** You/Them meters plus a "Can't hear the other side" banner (`session/components/floating/capture-health.ts`, `recording-bar.tsx`) | High | done |
| Speaker labels and naming | Granola: Me/Them, with names via Accessibility (G/taking-notes/speaker-attribution). Otter: tag once and it learns (https://help.otter.ai/hc/en-us/articles/40586357592471-Speaker-Management) | **Exists, better.** Click a label to assign a person or "Apply to all". Voice memory is on by default (`transcript/renderer/speaker-assign.tsx`, `services/voiceprint.ts`, `crates/pyannote-local`) | Med | done |
| Audio playback and retention | Granola deletes audio and has no playback (G/consent-security-privacy/getting-consent). Krisp: delete audio but keep notes (help.krisp.ai, excerpt) | **Exists, better.** Retention runs from none to forever (`settings/general/audio-settings.tsx`), with a waveform player and click-a-word-to-hear (`audio-player/*`) | High | done |
| Transcript auto-delete | Granola: 1 day to 1 year (G/consent-security-privacy/transcript-auto-deletion). Fireflies: auto-delete (https://guide.fireflies.ai/articles/7870593373) | **Missing** for transcripts. Audio retention exists | Low | M |
| Model-training opt-out | Granola trains on anonymized data by default, with an opt-out (G/consent-security-privacy/model-training) | **Not needed.** No Upshot server and no training. Your key goes straight to your provider (README) | Med (Loom) | done |
| Source links from a summary line to the transcript | Granola: a magnifying glass on each line (G/taking-notes/ai-enhanced-notes). Notion: hover a citation and jump to it (https://www.notion.com/help/ai-meeting-notes) | **Missing.** The closest is click-a-word playback in the transcript | Med | L |
| Your typed words vs AI text shown apart | Granola: raw notes in black (G/taking-notes/ai-enhanced-notes; the AI color is not stated). Fathom: highlights scratch-pad notes (https://help.fathom.video/en/articles/11577345) | **Missing.** Memo and Summary are separate tabs | Med | L |
| Instant example on first run | Granola: a 2-minute demo meeting at first run (G/getting-started/setting-up-granola-for-the-first-time) | **Partial.** The welcome note is text only and has no demo (`onboarding/welcome-note.ts`) | Med | M |
| People and companies pages | Granola: built from calendar attendees (G/people-and-companies) | **Hidden.** `contacts/*` exists. Hidden by `HIDDEN_SETTINGS` "contacts" (`sidebar/settings-nav-groups.ts`) because of a sample "Unnamed" person | Med | M |
| Folders | Granola: spaces and folders (G/sharing/folders/spaces-and-folders) | **Exists.** Folders also take attached materials and per-folder instructions (`folders/*`, `session/folder-instructions.tsx`) | Low | done |
| Export to files | Otter: TXT, DOCX, PDF, SRT (Otter export URL above). Granola: copy, email, CSV (G/sharing/exporting-notes) | **Exists.** "…" › Export: PDF, TXT, Markdown, Org (`outer-header/overflow/export-modal.tsx`) | Med | done |
| Sharing by link, Slack, CRM | Granola: links, Slack, HubSpot, Notion, Zapier (G/sharing/*) | **Hidden on purpose** (it needs the upstream cloud). Local webhooks and an MCP server cover it (`settings/developers/webhooks.tsx`, `apps/cli/src/mcp.rs`) | Low | — |
| MCP / AI-tool access | Granola: hosted MCP with 6 tools (G/sharing/integrations/mcp). Jamie: MCP and API (https://www.meetjamie.ai/) | **Exists, better.** A local MCP server with no account, plus the Glaido bridge. Writes need approval (`settings/developers/glaido.tsx`) | Med | done |
| Keyboard shortcuts you can find | Granola: ⌘J chat, ⌘S sidebar (G/sharing/folders/spaces-and-folders). No vendor publishes a full list (not verified) | **Partial.** About 12 shortcuts exist (⌘N, ⌘⇧N, ⌘K, ⌘J, ⌘\, ⌘F, Space and more), but there is no help sheet and only 3 are shown as hints | Low | S |
| Global shortcut to start recording | Shadow: a global shortcut for each skill (https://www.eesel.ai/blog/shadow-review) | **Missing.** The tray has "Start a new meeting" (`plugins/tray`). The only global shortcut belongs to dictation, which is hidden | Low | M |
| Saved chat prompts (recipes) | Granola: `/` recipes in chat (G/getting-more-from-your-notes/recipes) | **Missing.** There are 3 fixed chips | Low | M |
| Local or offline AI | Shadow: on-device transcription (https://www.eesel.ai/blog/shadow-review). Notion: not offline (Notion help URL) | **Exists, better.** Apple Speech and Parakeet transcribe on device. Apple Intelligence, Ollama and LM Studio summarize (`settings/ai/llm/shared.tsx`) | High (Loom) | done |
| Import from other notetakers | — (Granola imports nothing) | **Exists, better.** Granola import with no account, plus about 30 others (`imports/providers.ts`) | Med | done |

## 2. Top 10 recommendations (ranked by impact ÷ effort)

All of these are UI or prompt changes. None touches audio capture, transcription, `crates/cloudsync` or the `@anlg/*` names. They add no cloud service and bundle no key.

1. **Ship a local template library (High ÷ S).** Today the picker shows only "Auto" because the upstream gallery is empty.
   - Add `templates/bundled-templates.json`, about 8 entries in the same shape the API returns (`slug, title, description, category, targets, sections`): 1:1, Standup, Sales call, Customer discovery, Interview, Project kickoff, Brainstorm, Follow-up email.
   - In `shared/ui/resource-list/hooks.ts`, return the bundled list when `endpoint === "templates"` and skip the fetch. That also removes an undisclosed call to `anarlog.so`, so the README's privacy promise becomes fully true.
   - Tests: `templates/utils.test.ts` and the template-picker tests.
2. **Visible Copy button on the Summary (High ÷ S).**
   - In `session/components/note-input/header-enhanced.tsx`, render a ghost icon button that calls the existing `handleCopy`. Use the same size and style as the F6 hard-drive icon and add a tooltip, "Copy notes".
   - Keep the right-click menu. This is the first thing a judge does after the notes appear.
3. **Follow-up email in one click (High ÷ S).**
   - Comes almost free with #1: a "Follow-up email" template whose sections are Subject, Thanks and recap, Decisions, Next steps with owners, and Close.
   - Picking it opens a second summary tab. `header-enhanced.tsx` already creates a new note per template (`onSelectNote(result.noteId)`). With #2 the judge can copy and paste it straight away.
   - Optional: a "Draft follow-up email" item in the Summary context menu that runs that template.
4. **Starter prompts for chat on home (Med ÷ S).**
   - In `chat/components/body/empty.tsx`, when `!hasContext`, show 3 cross-meeting chips instead of nothing: "What did I commit to this week?", "Summarize this week's meetings", "Prep me for my next meeting".
   - The chat tools already search every meeting. This is Granola's Recipes idea at zero cost.
5. **Make the recording notice visible (Med ÷ S).**
   - Add one switch row to the onboarding final step (`onboarding/final.tsx`): "Post a short notice in the meeting chat when Upshot starts". It writes the existing `consent_auto_send_chat` setting through the same setter used in `settings/general/index.tsx`.
   - It is one sentence in the Loom: bot-free, and still honest with the people on the call.
6. **Bring back an Apple Calendar step in onboarding (Med ÷ S).**
   - Add `"calendar"` to `STEPS_MACOS` after `transcription` in `onboarding/config.tsx`.
   - In `onboarding/calendar.tsx`, render only `AppleCalendarProvider`, without the Google and Outlook rows.
   - Add one line: "Google or Outlook calendars added in macOS Internet Accounts show up here too". That gives meeting titles, attendees, reminders and auto-start, with no cloud. Granola can't read Apple Calendar.
   - Make it skippable like the imports step.
7. **Instant example meeting on first run (Med-High ÷ M).**
   - Extend `onboarding/welcome-note.ts` to seed one sample meeting: a short two-speaker transcript, a memo and a finished summary, with the same demo flag the home stats already exclude.
   - The judge sees what good output looks like in 3 seconds, before speaking a word. This matches Granola's 2-minute demo.
8. **Search note contents from ⌘K (Med ÷ M).**
   - In `shared/open-note-dialog.tsx`, when the query has 2 or more characters, call `useSearchEngine().search(query)` (`search/contexts/engine/index.tsx`, the same engine as chat and @-mentions).
   - Show a "In notes" group with the title and a snippet. Keep the title matches first.
9. **Keyboard shortcuts sheet (Low ÷ S).**
   - Add a small dialog on ⌘/ (register it in `shared/useMainShortcuts.tsx`) listing the 12 shortcuts in the table above.
   - Add a "Keyboard shortcuts" item to the Help menu. Use one type size and sentence case.
10. **Show People and companies again (Med ÷ M).**
    - First drop or fix the sample "Unnamed" person that caused the hide: find where it is seeded and leave unnamed rows out of the list in `contacts/*`.
    - Then remove `"contacts"` from `HIDDEN_SETTINGS` in `sidebar/settings-nav-groups.ts`. This matches Granola's People and Companies pages, built locally from Apple Calendar attendees and speaker assignments.

Next in line after these: summary-line source links to the transcript (L), your words vs AI text styling (L), transcript auto-delete (M), and a list of todos across meetings (M).

## 3. Already better than Granola (for the Loom)

| Claim | Evidence in Upshot | Granola evidence |
|---|---|---|
| Your audio is kept, and you can click any word to hear it | `audio-player/*`, `transcript/renderer/word-span.tsx`; retention setting in `settings/general/audio-settings.tsx` | Audio is not stored on desktop (G/consent-security-privacy/getting-consent). Playback is the complaint people repeat most (https://krisp.ai/blog/granola-ai-review-alternatives/) |
| It warns you live when it can't hear the other side | You/Them meters and banner, `session/components/floating/capture-health.ts` | Its docs say to check for missing grey bubbles afterward (G/troubleshooting/transcription-issues) |
| No account, no sign-in, all history free | Onboarding has no sign-in (`onboarding/config.tsx`); no history limit | Google or Microsoft sign-in required; Basic plan keeps 30 days of history (G/consent-security-privacy/security-privacy-data-faqs, https://www.granola.ai/pricing) |
| Transcription on your Mac, and summaries can be on your Mac too | Apple Speech and Parakeet; Apple Intelligence, Ollama, LM Studio (`settings/ai/stt/shared.tsx`, `settings/ai/llm/shared.tsx`) | Uses a cloud blend of OpenAI and Anthropic (G/taking-notes/ai-enhanced-notes) |
| No training on your data | No Upshot server at all (README "Where your data lives") | Trains on anonymized data by default, with an opt-out (G/consent-security-privacy/model-training) |
| Pick any current model, the day it ships | F1 picker: New badges, refresh at launch, offline list (`settings/ai/shared/model-catalog.ts`, `model-registry.ts`) | Basic gets "Auto" only. Model choice needs Business or Enterprise (G/getting-more-from-your-notes/understanding-model-selection-in-granola-chat) |
| Works with Apple Calendar | `calendar/components/sidebar.tsx` (local calendars) | Google and Outlook only; Apple Calendar is unsupported (G/getting-started/syncing-your-calendars) |
| Speakers you can name, and it remembers voices | `transcript/renderer/speaker-assign.tsx`, `services/voiceprint.ts` (on by default) | Me/Them, with names only for Meet, Zoom and Teams via Accessibility (G/taking-notes/speaker-attribution) |
| A local MCP server, with no account and approval before writes | `apps/cli/src/mcp.rs`, `settings/developers/glaido.tsx` | Hosted MCP behind OAuth, about 100 requests a minute (G/sharing/integrations/mcp) |
| Brings your Granola meetings with you, plus about 30 other tools | `imports/providers.ts` | No importer |
| Export to PDF, TXT, Markdown and Org | `outer-header/overflow/export-modal.tsx` | Copy, email or CSV (G/sharing/sharing-notes, G/sharing/exporting-notes) |
| Free to run | Apple Intelligence or a free Gemini key. The home card shows "AI cost this month ≈ $X" against Granola Business at $14/mo (`home/stat-cards.tsx`) | Business costs $14 per user per month (https://www.granola.ai/pricing) |
| Chat can't change your notes without your OK | Approval cards (`chat/components/message/tool/approval-tools.tsx`) | Granola confirms only before sending actions (G/getting-more-from-your-notes/workflows-in-chat). Roughly even here, so mention it only in passing |
