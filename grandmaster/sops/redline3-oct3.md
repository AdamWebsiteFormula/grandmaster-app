# Fresh-eyes redline round 3 (Oct 3, light mode): grade B-

Screens: ~/code/grandmaster-private/upshot-screens-v3/ (private). Granola refs: ~/code/grandmaster-private/granola-screens/ (private; 12–19 settings, 01 home). Never copy into the repo.

## S1 Light surfaces + settings (owner: helper S1; tokens.css, settings/**, setting-row)
- Light mode: main panel a warm canvas (~`60 5% 96%`), cards white `bg-card` with `border-border`; keep `bg-muted` cards in dark only (`bg-card dark:bg-muted` or token-level). Applies to Settings cards, Plan, and any shared card component (Home calendar card is helper S2's file — coordinate by using the shared token/class only). Granola: white cards on off-white canvas (screens 12–19).
- Light `--input` softer: `24 5% 58%` (verify ≥3:1 against white and the canvas, WCAG 1.4.11; update contrast-audit.md + design-system.md token table).
- Sidebar vs panel separation in light mode (sidebar ~`60 5% 94%` or rely on the canvas).
- Plan: usage hours under 1 h shown as minutes ("4 min"); remove the Pro column outline (keep "Current plan" tag); Free cell for "Pick this week's models" says "Auto only" instead of "—"; `pb-6` so the Privacy policy link isn't clipped.
- General: "Additional spoken languages" uses a right-aligned outline small "Add language" button in the row (opening the existing picker), not a full-width input.
- Theme segmented control: selected segment in light mode `bg-card border` (lighter than the black pill) if it stays ≥3:1 for the selected state (WCAG 1.4.11); else keep.

## S2 Home + Chat page (owner: helper S2; home/**, chat/components/chat-page.tsx, chat/components/recipes.tsx, home composer)
- Home rows: no "No transcript" subtitle; show a second line only for real metadata (duration · attendees); keep row heights even (if some rows lack metadata, use a consistent single-line height for all rows in a group, or a neutral line like the date — pick the cleaner, evidence: Granola rows show attendees only when present).
- "Untitled note" in `text-foreground` (not muted).
- Home composer history icon: tooltip + aria-label "Recent chats", or remove if redundant.
- Chat page Recents: `MessageSquare` 14px icon instead of the empty circle; right-aligned "See all" (Granola).
- Chat composer border: use the new softer input/border token, no heavy gray.
- Calendar card on Home: white card on canvas in light (use the shared card token).

## S3 Note bottom bar (owner: helper S3; session/**)
- One centered bar: `mx-auto max-w-[480px] h-10 rounded-pill border bg-card` (adjust widths to fit ~920px windows) containing: waveform/transcript toggle (which also carries Resume recording when recording is stopped — e.g. a menu or a split control with a visible "Resume" state), the Ask field, and a labeled "Draft follow-up email" chip (label visible when width allows; icon-only only below a narrow breakpoint with tooltip).
- Remove the separate far-left "Resume recording" pill (Resume stays reachable from the bar and ⋯ › Recording).
- Recording state (bar shows Recording/timer/Stop) must still be visible and unobstructed.
