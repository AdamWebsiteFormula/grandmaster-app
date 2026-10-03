# Contrast audit (Oct 3)

WCAG 2.2 AA in both themes. Text: SC 1.4.3, 4.5:1 (3:1 for 24 px, or 18.66 px bold) — w3.org/WAI/WCAG22/Understanding/contrast-minimum. Non-text: SC 1.4.11, 3:1 for field boundaries, focus rings, checked/selected marks and icons that carry meaning — w3.org/WAI/WCAG22/Understanding/non-text-contrast. Exempt: disabled or inactive controls, pure decoration, and hover (the pointer shows it). SC 1.4.11 does not ask for contrast *between* states (Understanding 1.4.11, "Focus and state"), so a row whose selected fill is a subtle step passes when its text still meets 4.5:1 on that fill.

Method: `contrast.mjs` / `final.mjs` (scratchpad) parse `tokens.css`, convert HSL to sRGB to relative luminance, and blend alpha (`/NN`, `opacity-*`) over the real surface. Tailwind v4 palette colors were converted from OKLCH. Class scan: `apps/desktop/src` and `packages/ui/src` (tests and i18n excluded) for `text-*/NN`, `opacity-[1-8]0`, `text-neutral|gray|zinc|stone-*`, `placeholder:*`, `border-*/NN`, `bg-*/NN` selected states, fixed hues and `hover:text-black`; editor CSS in `packages/editor/src/styles`. Screens hidden in Upshot (Account, Billing, Team, Sync, Dictation, Automations, CRM, Contacts, Intelligence; `settings-nav-groups.ts`) and the dev-only devtools bar were scanned but not fixed.

Ratios are dark / light, after the fix unless marked "was".

## Totals

- Token matrix: 8 foreground roles × 8 surfaces (background, card, popover, muted, accent, sidebar-accent, floating panel, dialog 16%) + 3 fill pairs = 67 pairs, 134 ratios. Before: 10 dark and 44 light failures. After: 0 light; 2 dark, both N/A (see table).
- Class scan: 47 findings below (some group several files), each in both themes. 37 failed in at least one theme and are fixed; 10 pass or are exempt (disabled, decoration, hover, unreachable). What is left is under "Left as is".
- Pixel check on the dev build (dark and light): home, ⌘K, a note, Settings › General, Settings › Plan. Sampled gray ratios matched the computed ones within 0.1; the orange button read 5.44 against a computed 5.61 (screenshot color profile).

## Tokens (`packages/design-system/src/tokens.css`)

| Location | Pair | Dark | Light | Rule | Fix |
|---|---|---|---|---|---|
| All metadata, hints, placeholders | `--muted-foreground` on background / card / muted / accent / sidebar-accent | 7.37 / 6.71 / 6.14 / 5.64 / 4.60 | 5.50 / 5.73 / 5.27 / 5.04 / 4.61 (was 4.56 / 4.75 / 4.36 / 4.18 / 3.82) | 1.4.3 | Light `25 5% 45%` → `25 5% 40%` |
| Orange text (links, `text-primary` icons, Beta chip, note links, hashtags) | `text-primary` on background / sidebar-accent | 7.31 / 4.56 | 5.70 / 4.78 (was 2.76 / 2.31) | 1.4.3 | New `--primary-text` (light `20 100% 35%`, dark = brand orange); `--text-color-primary` in both `@theme` blocks, so every `text-primary` uses it and `bg-primary` keeps the fill |
| Orange fills as marks (checkbox, selected segment check, progress gauges, selected underline) | `--primary` on background / sidebar-accent | 7.31 / 4.56 | 3.59 / 3.01 (was 2.76 / 2.31) | 1.4.11 | Light `--primary` `20 100% 56%` → `20 100% 46%` (#EB4E00, same hue, deeper, as Apple's light/dark system colors differ) |
| Focus ring | `--ring` on every surface | ≥ 4.56 | ≥ 3.01 (was 2.31–2.87) | 1.4.11 | Light `--ring` → `20 100% 46%` |
| Black text on orange | `--primary-foreground` on `--primary` | 7.31 | 5.61 | 1.4.3 | Unchanged; still black on the accent |
| Error text (`text-destructive`, 108 uses) | destructive on background / card / dialog / sidebar-accent | 7.96 / 7.25 / 5.53 / 4.97 (was 4.38 / 3.99 / 3.04 / 2.73) | 5.58 / 5.81 / 5.81 / 4.68 (was 3.61 / 3.76 / 3.76 / 3.03) | 1.4.3 | New `--destructive-text` (dark `0 86% 72%`, light `0 72% 45%`) via `--text-color-destructive` |
| Delete buttons, live row | white on `--destructive` | 4.59 | 5.56 (was 3.60) | 1.4.3 | Light `--destructive` `0 84.2% 60.2%` → `0 72% 45%` |
| Field borders | `--input` on background / card / muted | 3.95 / 3.59 / 3.29 | 3.82 / 3.97 / 3.65 (was 1.20 / 1.25 / 1.15) | 1.4.11 | Light `--input` `24 6% 90%` → `24 5% 50%` (Material 3 "outline" role is a mid gray for the same reason) |
| Field borders on sidebar-accent / dialog | `--input` | 2.46 / 2.74 | 3.20 / 3.97 | 1.4.11 | N/A in dark: no field sits on the selected-row fill; dialogs override fields to `hsl(0 0% 46%)` = 3.18 |
| Hairlines | `--border` on background / card | 1.94 / 1.77 | 1.20 / 1.25 | — | Exempt: decoration, never the only cue (fields use `--input`) |
| Foreground, alert-foreground | on every surface | ≥ 12.0 / ≥ 4.97 | ≥ 14.1 / ≥ 5.21 | 1.4.3 | Pass |

## Components

| Location | Pair | Dark | Light | Rule | Fix |
|---|---|---|---|---|---|
| Note tabs, inactive icons (`header-shared.tsx`) | muted/70 on tab track | 6.17 (was ~4.0) | 4.70 (was ~3.0) | 1.4.11 | `text-muted-foreground` |
| Note editor placeholders (`note-typography.css`, `dark.css`, `prosemirror.css`) | muted at 60% / `hsl(0 0% 40%)` / `#e5e5e5` | 7.37 (was 1.9–3.65) | 5.50 (was 1.25–2.3) | 1.4.3 | `--muted-foreground`, no opacity |
| Note links (`note-typography.css`) | orange on note body | 7.31 | 5.70 (was 2.76) | 1.4.3 | `--primary-text` |
| Hashtags (`hashtag.css`) | violet-600 | 7.31 (was 3.57) | 5.70 | 1.4.3 | `--primary-text` (also the one-accent rule) |
| Checked tasks (`task-list.css`) | content at 50% | 7.37 | 5.50 (was 3.32) | 1.4.3 | `--muted-foreground` instead of opacity |
| Selected task outline (`task-list.css`) | foreground at 45% | 6.8 | 4.5 (was 2.87) | 1.4.11 | 60% foreground |
| Transcript scroll buttons (`renderer/index.tsx`) | muted/45 | 7.37 (was 2.19) | 5.50 (was 1.91) | 1.4.11 | `text-muted-foreground` |
| Transcript select-mode circle (`segment-header.tsx`) | border muted/40 | 7.37 (was ~1.9) | 5.50 (was ~1.6) | 1.4.11 | `border-muted-foreground` |
| Non-final transcript words (`word-span.tsx`) | foreground at 60% | 6.82 | 4.53 | 1.4.3 | Pass, unchanged |
| "Generating" heading (`enhanced/streaming.tsx`) | muted at 60%, 24 px bold | 7.37 (was 3.13) | 5.50 (was 2.47) | 1.4.3 large | Removed `opacity-60` |
| Sidebar future rows (`timeline/item.tsx`) | whole row at 65% | 7.37 (was 3.52) | 5.50 (was 2.70) | 1.4.3 | `text-muted-foreground` instead of `opacity-65` |
| Sidebar ignored rows | whole row at 40% | 7.37 (was 3.44) | 5.50 (was 2.50) | 1.4.3 | `text-muted-foreground` (strikethrough kept) |
| Live row folder, time, tag lines | destructive-foreground/65 on red | 4.59 (was 2.64) | 5.56 (was 2.27) | 1.4.3 | Full `text-destructive-foreground` |
| Live row stop icon | white/80 on red | 3.51 | 4.16 | 1.4.11 | Pass |
| Folder materials hint (`folder-materials.tsx`) | muted/80 | 6.71 (was 4.68) | 5.73 (was 3.24) | 1.4.3 | `text-muted-foreground` |
| ⌘K snippets (`open-note-dialog.tsx`) | muted/80 | 7.37 (was 4.92) | 5.51 (was 3.15) | 1.4.3 | `text-muted-foreground` |
| ⌘K highlighted row | `bg-accent/60` fill | text 7.37 | text 5.51 | 1.4.11 | Pass: SC 1.4.11 sets no contrast between states; text passes on the fill |
| Chat history counter (`input/index.tsx`) | muted/80 | 6.71 (was 4.68) | 5.73 (was 3.24) | 1.4.3 | `text-muted-foreground` |
| Chat suggestion text (`body/empty.tsx`) | muted/75 | 6.71 (was ~4.2) | 5.73 (was ~3.0) | 1.4.3 | `text-muted-foreground` |
| Chat composer and floating "Ask anything" borders (`input/index.tsx`, `surface.ts`, `chat-cta.tsx`) | `border-border/70` | 3.59 (was 1.6) | 3.99 (was 1.26) | 1.4.11 | `border-input` |
| Model menu locked rows and "Pro" tag (`model-menu.tsx`) | muted at 50% item opacity | 6.83 (was ~2.5) | 5.50 (was ~2.1) | 1.4.3 (owner asked these be readable) | `data-disabled:opacity-100 data-disabled:text-muted-foreground` |
| Queued message delete (`content.tsx`) | muted at 65% | 6.71 (was 3.5) | 5.73 (was 2.7) | 1.4.11 | Removed the fade |
| Copied check (`message/normal.tsx`) | green-500 | 19.2 | 16.8 (was 2.14) | 1.4.11 | `text-foreground` |
| Chat tool errors (`tool/generic.tsx`, `search-meetings.tsx`) | red-500 | 7.96 | 5.58 (was 3.67) | 1.4.3 | `text-destructive` |
| Quick composer window (`composer/index.tsx`) | popover-fg /38, /40, placeholder /28 | 6.44 (was 3.38 / 3.61 / 2.40) | 5.73 (was 2.38 / 2.52 / 1.84) | 1.4.3 | `text-muted-foreground`, `placeholder:text-muted-foreground` |
| Composer close / Open buttons | popover-fg /65, /76 | 7.56+ | 5.42+ | 1.4.11 | Pass |
| Settings search, spoken languages, Dictionary field, folder instructions | `border-border` | 3.54 (was 1.74) | 3.67 (was 1.20) | 1.4.11 | `border-input` |
| Transcription: model delete (`stt/select.tsx`) | red-500, hover red-600 | 7.96 | 5.58 (was 3.67) | 1.4.3 | `text-destructive`, hover fill instead of fade |
| Transcription: language warning icon | amber-500 on toast | 9.79 | 3.19 (was 2.15) | 1.4.11 | `text-amber-600 dark:text-amber-500` |
| Settings › AI shared remove links (`ai/shared/index.tsx`) | hover destructive/80 | 6.3 | 3.7 hover | hover | Hover now underlines instead of fading |
| Insights activity squares (`stats/index.tsx`) | level 1 = foreground/20 on card | 4.98 (was ~1.9) | 3.35 (was ~1.5) | 1.4.11 | Scale 10/50/65/80/100% |
| Insights day bars | foreground/20 | — | — | 1.4.11 | Exempt: `aria-hidden`, count printed beside each bar |
| Calendar other-month days (`day-cell.tsx`) | muted/70 | 7.37 (was 3.95) | 5.50 (was 2.97) | 1.4.3 | `text-muted-foreground` |
| Calendar Apple permission status (`apple/permission.tsx`) | red-500 | 7.96 | 5.58 (was 3.67) | 1.4.3 | `text-destructive` |
| Templates: remove icons (`details.tsx`, `template-form.tsx`, `auto-form.tsx`) | `hover:text-black` | 19.2 (was 1.0 black on black) | 16.8 | hover | `hover:text-foreground` |
| Templates: title placeholder (`sections-editor.tsx`) | muted/60 | 7.37 (was 3.13) | 5.50 (was 2.47) | 1.4.3 | `placeholder:text-muted-foreground` |
| Template icons (`#9ca3af`) | gray-400 | 7.7 | 2.5 | — | Exempt: decoration next to the template name |
| Search empty-state title (`shared/control.tsx`) | muted/70, 33 px bold | 7.37 (was 3.95) | 5.50 (was 2.97) | 1.4.3 large | `text-muted-foreground` |
| Onboarding completed step titles (`onboarding/shared.tsx`) | muted/70 | 7.37 (was 3.95) | 5.50 (was 2.97) | 1.4.3 | `text-muted-foreground` |
| Onboarding signed-in line (`account/after-login.tsx`) | emerald-600 | 19.2 | 16.8 (was 3.52) | 1.4.3 | `text-foreground` |
| Plan: segmented control, "save 21%", features, test-mode note | measured | 5.65–8.26 | 5.05–8.73 | 1.4.3 | Pass (light muted fix) |
| Upgrade dialog labels and hints | muted on dialog | 5.12 | 5.73 | 1.4.3 | Pass |
| Switch (off) thumb on track | muted-fg on muted | 6.14 | 5.27 | 1.4.11 | Pass |
| Recording bar meter | foreground fill on track | ~9 | ~12 | 1.4.11 | Pass |
| Floating bar, light: speaker label and bubbles (`overlay/bar.tsx`) | white on pale bar | 5.52 over a white desktop | 13.65 / 8.59 (was 1.24 / 1.97) | 1.4.3 | Dark ink `rgb(31,28,26)` when the bar is light |
| Dictation partial text and empty hint (`overlay/dictation.tsx`) | content at 60% | — | — | 1.4.3 | Full color; partial text is italic instead of faded |
| Live captions default (`meeting-float/settings.ts`, `settings/schema.ts`) | white on 30% black over a white desktop | 5.74 (was 2.11) | same | 1.4.3 | Default opacity 0.3 → 0.6 (users can still lower it) |
| Disabled rows and buttons (sidebar header, send button, search arrows, plan-gated settings, calendar providers) | 45–70% fades | — | — | — | Exempt: disabled or inactive |
| Brand loading mark, onboarding background art, empty-state icons beside text | 20–70% fades | — | — | — | Exempt: decoration |
| Chat "dark surface" branches (`toolbar-controls.tsx`, `empty.tsx` `isDark`) | primary-fg /50–/85 | — | — | — | Unreachable: `isChatDarkAppearance()` is always false |

## Left as is

- Floating bar and live captions sit over whatever is on the desktop. The fixes are measured over a plain white desktop and, for the light bar, over black (ink 3.37 on bubbles, labels 4.96); a busy wallpaper can still lower them. Apple's own Live Captions panel has the same limit.
- Hidden screens (Team, Sync, Automations, Contacts) still use red-500, emerald-500, amber-500 and blue-600 text. Fix when one ships.
- Selected rows keep a subtle fill (`bg-accent`, `--sidebar-accent`). SC 1.4.11 does not require contrast between states. Selected settings and home nav rows also switch to `font-medium text-foreground`.
