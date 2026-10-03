# Fresh-eyes redline round 2 (Oct 3): grade C+

Screens: ~/code/grandmaster-private/upshot-screens-v2/ (private). Granola refs: ~/code/grandmaster-private/granola-screens/ (private).

## Home (helper R1; owns home/**)
- Remove the identical gray document icon on rows without attendees; show attendee avatar initials only when attendees exist (Granola uses avatars), otherwise no leading icon, and keep text aligned.
- Every row the same height: always render a second text-xs muted line (duration · attendees, or "No transcript" / "Note" when nothing is known).
- Empty notes (no title, no content, no transcript, no audio): hide them from the Home list (display filter only; do not delete data), and show "Untitled note" in muted text for untitled notes that do have content.
- Center the column: max-w-[640px] mx-auto (keep the New note alignment rule in main/body.tsx consistent if the column width changes — coordinate by editing only home/** and noting the needed offset in your report).

## Note and transcript (helper R2; owns session/**, title-generation prompt)
- Tooltips: the "≡" chip ("Show my notes") and the waveform bottom-bar button (its real action, e.g. "Resume recording" / "Show transcript").
- The bottom bar must stay the same across Summary and Transcript: keep "Draft follow-up email"; move the language picker into the transcript toolbar next to search, edit and copy.
- Each transcript bubble gets a small label above it: "You · 00:14" for the user (right aligned with the bubble) and "{Speaker} · 00:14" for others; remove the single floating "00:00".
- Summary/Transcript switch smaller: h-6 px-2 text-xs, quieter selected state.
- Generated note titles must be sentence case too (find the title-generation prompt; the summary heading rule is already in crates/template-app enhance prompts).

## Settings (helper R3; owns settings/**, sidebar/settings.tsx, packages/ui switch component)
- Sidebar header: name (font-medium) on line 1; email (muted, text-xs, title tooltip) on line 2; a small "Pro" or "Free" badge; if no name is saved, line 1 is the email local part, not the plan.
- "Additional spoken languages": use a languages/translate icon, not the empty circle.
- Export location: description in the description slot under the title like every other row; show ~/Downloads next to "Choose folder".
- Switch off state: track bg-input (or a token that meets 3:1 against the card) in dark and light; check the shared Switch in packages/ui and rebuild ui CSS if needed.
