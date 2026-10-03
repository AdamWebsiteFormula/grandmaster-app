# Granola vs Upshot, page by page (Oct 3)

Read-only comparison. Reference: 19 private screenshots of Granola (Business plan, light theme, captured Oct 3) described in words only. Upshot evidence: code at the file:line given, plus window captures of the installed Upshot.app (Settings › General, a note's Summary and Transcript views). The installed build may lag the working tree; every claim below was checked in code.

Rules kept: Upshot's brand stays (true black, one orange accent, Geist, flat 1 px borders). We match Granola's structure, density, hierarchy and features, not its serif, cream colors, logo or copy.

Practices cited: line length 45 to 75 characters (Baymard Institute, "Readability: the optimal line length"; Butterick, Practical Typography, "Line length"); raised surfaces are lighter in dark mode (Apple HIG, Dark Mode); grouped settings rows in inset cards with an icon, title and description (Apple HIG, "Settings" and macOS System Settings); menus put frequent actions first and destructive actions last, in red, after a separator (Apple HIG, Menus).

Priority: P1 = a big visual gap a judge notices in 3 seconds. P2 = noticeable on use. P3 = polish. FEATURE = Granola has it, Upshot does not.

## Counts

| Page | P1 | P2 | P3 | FEATURE items |
|---|---|---|---|---|
| 1. Note page | 4 | 3 | 2 | 1 |
| 2. Transcript | 1 | 2 | 1 | 1 |
| 3. Template menu | 0 | 3 | 1 | 0 |
| 4. Note chat | 0 | 3 | 1 | 2 |
| 5. Note ⋯ menu | 0 | 2 | 1 | 1 |
| 6. Chat page | 1 | 0 | 0 | 1 |
| 7. Spaces / folder page | 0 | 3 | 1 | 2 |
| 8. Settings | 2 | 6 | 2 | 3 |
| Total | 8 | 22 | 9 | 11 |

(FEATURE items are also counted in their priority column.)

## Top 12

1. P1 Note body spans the full pane (about 1,300 px at a normal window); Granola sets a centered column of about 620 to 680 px. Center it at `max-w-[680px]`.
2. P1 Summary section headings render at 23 px bold, almost the size of the title; Granola's are body-size semibold. Bring them down to 1.2em/600 and drop the extra weight.
3. P1 Date, attendees and folder are hidden behind header icons; Granola shows them as a chip row right under the title. Add the chip row.
4. P1 The bottom "Ask anything" pill is clipped to "Ask anythi…" (150 px container around a 196 px pill). Widen it into a Granola-style bottom bar: transcript toggle, Ask field, one "Draft follow-up email" chip.
5. P1 Settings rows are a flat full-width list; Granola groups rows into rounded cards with hairline dividers in a centered 680 px column. Add a settings card group.
6. P1 FEATURE: no Chat page or Chat item in the sidebar. Add a Chat tab: "Hi {first name}, ask anything", a composer with the model menu, Recents (the chat history that already exists), and recipe chips.
7. P1 Transcript is a block of paragraphs with no timestamps; Granola uses chat bubbles (you on the right, others on the left), speaker names, and centered timestamps. Restyle the segments.
8. P2 FEATURE: the note ⋯ menu has 13 items and no "Copy notes" or "Send notes via email". Put Copy notes, Send notes via email and Export first, and Delete note last in red.
9. P2 FEATURE: no follow-up chips after an answer ("Say more") and no recipe chip row above the note chat composer. Add both.
10. P2 FEATURE: Settings › Plan has two cards and no comparison table or usage summary. Add a usage row and a Free vs Pro table.
11. P2 Settings sidebar has a search field on top and no account header; Granola shows avatar, name and email. Add the header and keep search under it.
12. P2 Template menu shows no check on the template in use and has no "New template" row. Add the check, a "New template" row and menu-style footer rows.

---

## 1. Note page (enhanced notes)

Granola: a back-to-Home button at top left; ⋯, a Share pill and a link button at top right; nothing else in the header. Title in a large display face (about 26 px, regular weight). Directly under it, one row of small outlined chips (about 24 px tall, 12 px text): a notes-view toggle (lines icon), the template pill ("Enhanced ▾" with a sparkle), a date chip with calendar icon plus an attendee count with people icon, and "Add to folder". Body is a centered column about 620 px wide, about 14 to 15 px text, muted dark gray, section headings at body size and semibold, about 20 px between sections, tight bullets. A floating bottom bar: a round transcript toggle (waveform icon and caret) on the left, then a wide pill "Continue chat" with a "Write follow up email" chip at its right end.

| Gap | Granola does | Upshot does (file:line) | Exact change | Priority |
|---|---|---|---|---|
| Body width | Centered column, about 620 to 680 px | Full pane width, `h-full px-3` scroll container (`apps/desktop/src/session/components/note-input/index.tsx:368-374`); no max-width anywhere in the editor CSS | Wrap the Enhanced, Raw and Transcript children in `<div className="mx-auto w-full max-w-[680px]">` inside that container. Keep `px-3` outside so the hover-row inset (`note-typography.css:30-35`) still lines up | P1 |
| Section heading size | Heading at body size, semibold, about 20 px gap above | Summary sections are `h1`, 1.44em (23 px) weight 700 (`packages/editor/src/styles/prosemirror/note-typography.css:46-50`); in the capture "Next Steps" is nearly as big as the title | Add `.enhanced-summary-editor h1:not(:first-child), .enhanced-summary-editor h2 { font-size: 1.2em; font-weight: 600; margin-top: 1.25em; }` and `h3 { font-size: 1em; font-weight: 600; }`. Title stays 1.728rem. Keeps the 1.2 ratio | P1 |
| Chip row under title | Template pill, date, attendee count, Add to folder, in one row 8 px under the title | Template pill lives in the top header segmented control (`note-input/header.tsx:50-128`, `header-enhanced.tsx:246-300`); date and attendees only in a popover behind a calendar icon (`outer-header/index.tsx:137`, `151-172`); folder is a header icon (`outer-header/index.tsx:131`) | New `NoteMetaChips` rendered right after the title block (above the editor, in `note-input/index.tsx` before line 376): `flex flex-wrap gap-1.5 mb-4`. Chip: `h-6 px-2 rounded-md border border-border text-xs text-muted-foreground hover:bg-accent inline-flex items-center gap-1`, icons `size-3.5`. Chips: template pill (move `HeaderViewEnhanced` trigger here), date (opens `MetadataPopoverContent`), attendee count (same popover), folder ("Add to folder" or the folder name, opens `FolderPicker`). Remove the calendar and folder header icons once the chips exist | P1 |
| Bottom bar | Round transcript toggle + wide "Continue chat" pill (about 330 px) + "Write follow up email" chip | Container is `w-[150px]` (`session/components/floating/index.tsx:33`) around a `w-[196px]` pill (`shared/chat-cta.tsx:38`, `45`), so the label shows "Ask anythi…" in the capture | Container `w-[min(520px,calc(100%-2rem))] h-11`. Left: `size-9 rounded-full border border-input bg-popover` transcript toggle (waveform icon; switches `currentView` to transcript and back). Middle: the Ask pill `flex-1 h-10`. Right end inside the pill: one chip `h-7 rounded-full border border-border px-2.5 text-xs` "Draft follow-up email" that opens chat and sends the existing prompt (`chat/components/body/empty.tsx:63-65`). Keep ⌘J | P1 |
| Title weight | Display face, regular weight | Geist 1.728rem weight 700 (`note-typography.css:46-50`, `70-74`) | Keep Geist; set the first-child title to `font-weight: 600; letter-spacing: -0.01em; margin-bottom: 0.5rem` (the chip row adds the rest) | P2 |
| Header clutter | Header right: ⋯, Share, link. Nothing else | Header right: audio-saved icon, folder, calendar, ⋯, orange New note (`outer-header/index.tsx:125-143`); left: 4-part segmented view switcher with Copy, raw, transcript icons | After the chip row lands: drop folder and calendar icons; move the raw-notes toggle into the chip row (Granola's lines icon left of the template pill); move the transcript toggle to the bottom bar. Header keeps back, ⋯ and New note | P2 |
| Share | "Share" pill opens sharing; link button copies a link | Hidden on purpose (cloud sharing) (`outer-header/index.tsx:200-204`) | FEATURE (local): a "Share" outline button `h-7 px-3 text-sm` that opens a small menu: Copy notes, Send notes via email, Export as PDF. No cloud | P2 |
| Body text color | Body is a softer gray than headings | Body at `--foreground` 96% | Optional: body `color: hsl(var(--foreground) / 0.88)` in `.enhanced-summary-editor p, li`; headings stay 96%. Stays above 4.5:1 | P3 |
| Orange New note on a note | Not present on a note page | Orange filled New note in every header, including Settings (capture) | Keep on Home; on note and Settings headers use the outline variant so the one accent marks the page's own main action (design-system "The one accent") | P3 |

## 2. Transcript

Granola: opens as a panel over the lower half of the note. Top toolbar: search, copy, collapse. Messages as bubbles: your lines right-aligned in a tinted bubble; other people left-aligned in gray bubbles, speaker name above the first bubble of a run in a colored small label. A centered small timestamp (for example "42:24") between runs. Bottom: transcript toggle, "Resume", a settings icon and a language picker ("English ▾").

| Gap | Granola does | Upshot does (file:line) | Exact change | Priority |
|---|---|---|---|---|
| Bubble layout | Chat bubbles, you on the right | Full-width paragraphs with a speaker label (`transcript/renderer/segment.tsx:121-145`) | In the `section`: if `segment.key.channel` is the mic (you), `ml-auto max-w-[80%] rounded-2xl bg-accent px-3 py-2`; else `mr-auto max-w-[80%] rounded-2xl bg-muted px-3 py-2`. Text stays `text-sm leading-relaxed`. Gap between bubbles `mt-1.5`, between speakers `mt-4` | P1 |
| Timestamps | Centered time between runs | None; only a "~ ~ ~" separator (`renderer/separator.tsx:1-16`) | Render a centered `text-xs text-muted-foreground font-mono tabular-nums py-2` label with `mm:ss` from `offsetMs` before a segment when 60 s or more passed since the last label | P2 |
| Speaker label weight | Small, colored, medium weight | `text-xs font-light` (`renderer/segment-header.tsx:26-31`) | `text-xs font-medium`; hide it on your own bubbles (as Granola does) | P2 |
| Language picker | "English ▾" in the transcript footer | None in the transcript view; language lives in Settings › General | P3 FEATURE: show the spoken language as a read-only chip in the transcript footer that opens Settings › General. Do not touch transcription code | P3 |
| Where Upshot wins | No audio playback | Audio player with waveform, speed and click-to-seek words (capture; `session/index.tsx:311-320`) | Keep it. Mention it in the demo | — |

## 3. Template menu

Granola: dropdown under the template pill, about 240 px wide. First row is the template in use with a regenerate icon and a check. Then a "Templates" heading with a search icon at its right, then templates with emoji icons, a separator, "All templates…" and "+ New template".

| Gap | Granola does | Upshot does (file:line) | Exact change | Priority |
|---|---|---|---|---|
| Current template | Check mark on the one in use, regenerate icon next to it | No check; a "Regenerate" text button appears on the used row (`note-input/template-picker.tsx:446-472`, `603-641`) | Add `<Check className="size-3.5 text-foreground" />` at the row end when `isUsedTemplate`; turn "Regenerate" into an icon button `size-6` with tooltip "Regenerate" | P2 |
| New template | "+ New template" row at the bottom | Only by typing a name into search (`template-picker.tsx:308-325`) | Add a footer row "New template" (Plus icon) that creates an untitled template and opens it | P2 |
| Footer style | Menu rows: "All templates…", "New template", left-aligned 13 px | Centered `text-xs` link "See all templates ›" (`template-picker.tsx:490-498`) | Two rows `h-8 px-2.5 rounded-md text-sm hover:bg-accent flex items-center gap-1.5` with icons, after a `border-t border-border` separator | P2 |
| Width and search | 240 px; search hidden behind an icon | `w-80` (320 px) with a search field always on top (`template-picker.tsx:394-427`) | `w-64`. Keep the always-on search (faster by keyboard; we beat Granola here) | P3 |

## 4. Note chat panel

Granola: a sheet that rises from the bottom bar over the note (about 370 px wide). Header: history clock with caret on the left; open-in-window and expand on the right. Answer in prose, then a hairline, then the model's follow-up question and a "Say more" chip. Above the composer, a row of recipe chips ("Write follow up email", "List my todos", "Make notes longer", "Write tldr", "All recipes"). Composer: "Ask anything", model name with caret, attach (paperclip), round mic.

| Gap | Granola does | Upshot does (file:line) | Exact change | Priority |
|---|---|---|---|---|
| Follow-up chips after an answer | "Say more" and similar under the last answer | None (`chat/components/body/non-empty.tsx:68-81`) | FEATURE: under the last assistant message when idle, a row of 1 to 3 chips `h-7 rounded-full border border-border px-2.5 text-xs` ("Say more", "Make it shorter", "Turn into an email") that send that prompt | P2 |
| Recipe row above composer | Always-visible chip row with "All recipes" | Starter prompts only in the empty state, as a vertical list (`chat/components/body/empty.tsx:116-148`) | FEATURE: a horizontal, scrollable chip row directly above the input (same chip style, icon `size-3.5`), shown in both empty and non-empty states; last chip "All templates" opens Templates | P2 |
| Empty state layout | Chips, not a list | Vertical list of 3 rows (`empty.tsx:120-145`) | Same chips as above; drop the list | P2 |
| Attach button | Paperclip in the composer | Editor accepts attachments (`chat/components/input/index.tsx:150`) but shows no button (`input/index.tsx:172-212`) | Add a `size-7 rounded-full` Paperclip button left of the mic that opens a file picker into the same attachment path | P3 |

## 5. Note ⋯ menu

Granola: four items. Copy notes, Send notes via email, Send to Slack, then a separator and "Move to trash" in red.

| Gap | Granola does | Upshot does (file:line) | Exact change | Priority |
|---|---|---|---|---|
| Order and length | 4 items, share actions first, delete last | 13 items: Export, Version history, Transcribe again, Upload audio, Upload transcript, Open floating panel, Copy transcript, Open in new window, Show in Finder, Lock note, Delete recording, Delete note (`outer-header/overflow/index.tsx:158-271`) | Group 1: Copy notes, Send notes via email, Export… Group 2: Version history, Open in new window, Show in Finder, Lock note. Group 3 (submenu "Recording"): Transcribe again, Upload audio, Upload transcript, Copy transcript, Open floating panel, Delete recording. Group 4: Delete note in `text-destructive` | P2 |
| Send notes via email | Yes | No | FEATURE: open `mailto:?subject=<title>&body=<plain-text notes>` through `openerCommands.openUrl` (the same plain-text builder as Copy notes, `note-input/header-shared.tsx:155`). Cap the body near 1,800 characters and add "Full notes copied to clipboard" when cut | P2 |
| Copy notes | In the menu | An icon in the view switcher only (`note-input/header-enhanced.tsx:292`, `311-337`) | Add the same action to the menu (keep the icon if wanted) | P3 |

## 6. Chat page

Granola: sidebar item "Chat". Page: centered greeting "Hi {first name}, ask anything" (about 22 px), a large composer (about 340 px wide, 2 lines tall) with attach, "Auto ▾" and mic; "Recents" list with a chat icon, title and age ("23h", "1d"), "See all"; "Recipes" chips with "See all ›".

| Gap | Granola does | Upshot does (file:line) | Exact change | Priority |
|---|---|---|---|---|
| Chat page and sidebar item | Yes | No chat tab type (`store/zustand/tabs/schema.ts:125-169`); sidebar has Home, Search, Folders only (`sidebar/home-nav.tsx:58-77`); chat history exists only inside the chat toolbar popover (`chat/components/toolbar-controls.tsx:182-239`) | FEATURE: add a `chat` tab and a "Chat" sidebar row under Home. Layout: `mx-auto max-w-[560px] pt-24 flex flex-col gap-8`; greeting `text-xl font-semibold`; composer `rounded-2xl border border-input bg-card p-3 min-h-[88px]` with the existing `ChatModelMenu` and mic; "Recents" `text-sm font-medium` + rows `h-9 text-sm` with age in `text-xs text-muted-foreground tabular-nums` (from the same history store); recipe chips as in section 4. Sending opens the chat in the right panel | P1 |

## 7. Spaces, My notes, folder page

Granola: centered header: small lock tile, title about 28 px, a one-line description, a meta line ("private notes and folders · 4 folders"); a dismissible info banner; a space-scoped "Ask anything" composer with recipe chips; pill tabs "Notes", "Companies", "People"; then the notes list grouped by day (avatar, title, attendees, "Add to folder" suggestion, time).

| Gap | Granola does | Upshot does (file:line) | Exact change | Priority |
|---|---|---|---|---|
| Folder header | Centered icon tile, large title, meta line | 48 px top bar with icon and a 13 px semibold name field (`folders/folder-editor.tsx:214-258`) | Header block `mx-auto max-w-[680px] pt-10 flex flex-col items-center gap-2`: icon tile `size-10 rounded-xl bg-muted`, name field `text-2xl font-semibold text-center`, meta `text-sm text-muted-foreground` ("12 notes · 3 files"). ⋯ stays top right | P2 |
| Tabs | Notes / Companies / People pills | Stacked sections: Team folder, Context, Materials, Notes in a left-aligned `max-w-2xl` column (`folder-editor.tsx:305-430`) | Pill tabs `h-7 rounded-full px-3 text-sm` "Notes", "Materials", "Context"; Notes first. Notes tab uses the Home note row component | P2 |
| Scoped Ask | "Ask anything" composer for the space | None | FEATURE: an Ask pill under the header that opens chat with the folder's notes as context refs | P2 |
| Companies and People | Tabs inside the space | Code exists but hidden (`contacts/index.tsx`, `humans.tsx`, `organization-details.tsx`; hidden by `sidebar/settings-nav-groups.ts:69-82`) | FEATURE: add "People" and "Companies" tabs that list contacts seen in this folder's notes, reusing `person-item.tsx` and `organization-item.tsx` | P3 |

## 8. Settings

Granola layout: settings sidebar starts with an avatar circle, full name and email; then Preferences, Profile, Calendar, Notifications, Connectors, Get help; a "Workspace" group (General, Members, Spaces, Billing, Referrals). Content: a centered column about 680 px; page title about 26 px; each section has a small label above a rounded white card; rows inside the card are split by hairlines; each row has a small icon tile, a 13 px medium title, a 12 px muted description, and a control on the right (toggle, select, chevron, "Enabled ›").

| Gap | Granola does | Upshot does (file:line) | Exact change | Priority |
|---|---|---|---|---|
| Grouped cards | Rows inside rounded cards with hairline dividers | Flat rows, `gap-6`, no cards (`settings/setting-row.tsx:26-49`; pages like `settings/general/index.tsx:205-245`) | New `SettingsCard` = `rounded-xl border border-border bg-muted divide-y divide-border`; rows `px-4 py-3.5`. Switch tracks inside it use `bg-accent` (design-system Contrast: raised is lighter). Wrap each section's rows in it | P1 |
| Centered column | About 680 px, centered | Full width with `px-6 pt-6` (`settings/index.tsx:111-113`); capture shows controls pinned to the far right | Inner wrapper `mx-auto w-full max-w-[680px]` | P1 |
| Row icon | Small icon tile left of each title | No icon slot (`setting-row.tsx:8-36`) | Optional `icon` prop: `size-8 rounded-lg bg-accent flex items-center justify-center`, icon `size-4 text-muted-foreground`; row `gap-3` | P2 |
| Section label | Small label above each card | `SettingsSectionTitle` is `text-base font-semibold` (`settings/page-title.tsx:19-26`) | `text-sm font-medium text-muted-foreground mb-2` (sentence case, a real heading, not an eyebrow) | P2 |
| Sidebar header | Avatar, name, email on top | Search field on top, no account header (`sidebar/settings.tsx:71-110`) | Header `flex flex-col items-center gap-1 py-4`: initial circle `size-10 rounded-full bg-accent`, name `text-sm font-medium`, email `text-xs text-muted-foreground` (signed in) or "Upshot Free" (signed out). Search stays below it | P2 |
| Calendar | In Settings: Display toggles, Permissions, "Visible calendars" with color dots and toggles, "Reset" | "Calendar" jumps out of Settings to a separate calendar tab (`sidebar/settings-nav-groups.ts:178-183`); colors exist as colored checkboxes (`calendar/components/calendar-selection.tsx:180-237`) | Render the same calendar list inside Settings in a `SettingsCard`: `size-2.5 rounded-full` color dot + title + Switch on the right. Keep the calendar tab for the month view | P2 |
| Billing / Plan | Active plan card, workspace usage card (meeting counts), "Compare all plans" table with the current column tinted and Upgrade/Manage buttons in the header | Two side-by-side plan cards with bullet lists (`settings/plan.tsx:52-290`) | FEATURE: (a) a usage row `grid grid-cols-3` with large `text-2xl tabular-nums` numbers (notes this month, hours recorded, notes total) from the Insights stats; (b) a Free vs Pro table (rows: record and transcribe on your Mac, AI notes, chat with Auto, pick the newest models, folders and templates, price), checks in `text-foreground`, current column `bg-muted rounded-xl`, header buttons Upgrade or Manage | P2 |
| Profile and company | Profile page: name, job title, LinkedIn; "Your company" with a description used when summarizing; import/export | Account page hidden (`sidebar/settings-nav-groups.ts:69-82`); its profile form has name, job title, email, phone, LinkedIn, company, notes (`settings/general/account-profile.tsx:89-178`) | FEATURE: a local "Profile" page (no account needed): name, job title, company, and a "What your company does" textarea, passed into the enhance prompt context. No transcription code touched | P2 |
| Notifications | Three cards: meeting notifications, sharing, marketing | One long flat list, more options than Granola (`settings/general/notification.tsx:199-410`) | Split into cards "Meetings", "When notes are ready", "Sound" | P3 |
| Connectors | List card: logo, name, one-line description, chevron | No Connectors page; Developers page has CLI, MCP, webhooks, API key (`settings/developers/index.tsx`) | FEATURE: a "Connectors" page in the list-card style showing what Upshot has: Apple Calendar, MCP, CLI, Webhooks, Export folder; each row opens its existing settings | P3 |

## Home (another helper owns it): items that are easy to miss

- Sidebar: a "Chat" row under Home (section 6), and a "My notes"-style space list.
- Note rows: an attendee avatar on the left, attendees under the title, time on the right in a smaller muted face, and an inline "Add to › folder" suggestion pill with accept (check) and dismiss (×) on hover.
- "Coming up" card: big day numeral, month and weekday stacked beside it, a thin vertical color bar before each event in that calendar's color, and prev/next arrows on the card header.
- Bottom composer: history icon, recipe chips, "All recipes", then the input with an "Auto ▾" model menu, attach and a round mic.
- Top right: "New note" is a quiet outline button, not a filled one.
