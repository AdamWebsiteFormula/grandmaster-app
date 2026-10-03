# Fresh-eyes redline vs Granola (Oct 3, installed build): grade C

Screens: ~/code/grandmaster-private/upshot-screens/ (private). Granola refs: ~/code/grandmaster-private/granola-screens/ (private). Never copy them into the repo.

## Home and Chat (helper H1)
- Calendar card with no events: remove "Start recording" (duplicates New note); add a secondary "Connect calendar" button on the right; keep "Coming up".
- Note rows: replace letter tiles with a 16px muted FileText icon (or attendee initials when attendees exist); add a text-xs muted second line (duration · attendees). Row times are too small: text-sm tabular-nums muted.
- Composer: remove the inner input border (border-0 bg-transparent) so there is one border.
- New note button: align its right edge with the content column (same max-w), not past it.
- Sidebar: remove the ⌘K and ⌘, chips (put shortcuts in tooltips).
- Page titles (Home "Coming up", Chat greeting): font-medium tracking-[-0.02em].
- Chat page: hide Recents until a chat exists; title font-medium; show 3 recipe chips plus a "See all" chip that expands the rest.
- Dark-mode orange buttons are now #FF6A1F with black text (token change done); check nothing hard-codes text-white on bg-primary in your files.

## Note page and transcript (helper H2)
- Remove "New note" from the note header (keep ⋯ and Share). Also remove the New note button from all Settings pages: find where the header renders it (shared/new-note-button.tsx usage in the main layout or tab header) and hide it for settings and note tabs; keep it on Home, Chat and Folders.
- Remove or label the unlabeled tray/printer icon left of ⋯ (tooltip and clear glyph if it is a real action).
- Bottom bar transcript toggle icon: AudioLines (or the closest waveform icon in @anlg/ui icons); add a visible Summary / Transcript toggle so there is a way back to the summary.
- Transcript display: segments are joined without a space ("messages.and make sure"). Fix the display join only (never change stored data or transcription). One bubble per segment (split long monologues by segment), a centered tabular-nums timestamp about every 30 s, speaker label for others.
- Transcript toolbar: search, edit and copy in one h-8 row under the audio player.
- Share vs ⋯: Share holds sharing (Copy notes, Send via email, Export…); remove duplicates from ⋯ so each action has one home. Lighter Share menu border; align to the button so it doesn't cover the player.
- Focus ring stuck on Share after closing: onCloseAutoFocus={(e) => e.preventDefault()} for pointer closes; rings only via focus-visible.
- Note title: font-medium tracking-[-0.02em].
- Summary headings come out in Title Case ("Next Steps"): make the enhance/summary prompt require sentence-case headings (find the prompt template; American English).

## Settings (helper H3)
- Sidebar header: name on its own line, email text-xs muted with a title tooltip; remove Folders and Templates (↗) from the settings nav; pb-3 at the bottom of the nav so Permissions doesn't touch the edge.
- Time zone select: w-64 or label "System (New York)" so it isn't cut off.
- Export helper text aligned under the title (pl-10), not under the icon.
- Plan: move Sign out to Profile; Free and Pro headers on one baseline; wrap the compare table in the same card style; show "None yet" instead of 0 for a new user.
- Calendar: distinct row icons (KeyRound / LayoutGrid / CalendarRange or nearest available) or none; "Allow access" as the one orange primary (h-8 px-3); hide the "Visible calendars" card until access is granted; subtitles on every settings page (one short line each) or on none — pick every page.
- Page titles: font-medium tracking-[-0.02em] (SettingsPageTitle).
