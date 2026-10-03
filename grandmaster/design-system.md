# Upshot design system

Dark-first. True black base. One accent. Written Oct 2, 2026. The SOP that applies it is `grandmaster/sops/design.md`.

## Direction

- Black app, like Glaido. The window, sidebar and note body sit on pure black.
- Surfaces rise in small neutral steps (no warm stone, no cream, no olive).
- The accent is the orange from the app icon. It marks one thing per screen: the main action, the live recording state, focus and selection.
- Light theme stays as an option in Settings. Dark is the default for new users.

## Source: Glaido extraction (Oct 2, glaido.com, Firecrawl branding)

| Glaido | Value | Upshot |
|---|---|---|
| Background | `#0D0D0D` | `0 0% 0%` true black (Adam's call), panels `0 0% 6%` |
| Text | `#FFFFFF`, secondary `#B6B6B6` | `0 0% 96%`, muted `0 0% 60%` |
| Accent | one, lime `#BFF549`, black text on it | one, orange `#FF6A1F` (app icon), black text on it |
| Borders | `#252525` | `0 0% 24%` (`#3D3D3D`), raised Oct 3 (see Contrast below) |
| Shadows | none | none on black; 1 px borders instead |
| Corners | 2 px, near square | 0.5rem squircle (kept: macOS controls) |
| Font | Aspekta (sans), 13 px body | Geist (OFL), 13.3 px `text-sm` body |
| Spacing | 8 px base unit | Tailwind 4 px steps, used in pairs of 8 |

What we take: the near-black base, one bright accent used sparingly, black text on the accent, hairline borders, a flat look. What we don't: lime (our icon is orange) and square corners (a desktop app reads better with macOS-style squircles).

## Color tokens

Bare HSL triples in `packages/design-system/src/tokens.css`, read as `hsl(var(--x))`. Never put hex or `oklch()` there.

| Token | Dark (default) | Light | Use |
|---|---|---|---|
| `--background` | `0 0% 0%` | `60 9% 98%` | Window, sidebar, note body |
| `--foreground` | `0 0% 96%` | `24 10% 10%` | Body text |
| `--card` | `0 0% 6%` | `0 0% 100%` | Raised panels, cards |
| `--popover` | `0 0% 8%` | `0 0% 100%` | Menus and popovers (dialogs: see Dialogs below) |
| `--secondary`, `--muted` | `0 0% 10%` | `60 5% 96%` | Quiet fills, chips, inputs |
| `--muted-foreground` | `0 0% 60%` | `25 5% 40%` | Metadata, hints, placeholders (4.6:1 or more on every surface, both themes) |
| `--accent` | `0 0% 13%` | `60 5% 94%` | Hover fill; track of a segmented control on a `bg-muted` card (shadcn name, not the brand accent) |
| `--sidebar-accent` | `0 0% 19%` | `60 5% 90%` | Active sidebar row (Home nav and Settings nav), above the 13% hover |
| `--border` | `0 0% 24%` | `24 6% 90%` | Hairlines |
| `--input` | `0 0% 42%` | `24 5% 50%` | Field borders (3:1 or more on every surface a field sits on, both themes) |
| `--primary` | `20 100% 56%` | `20 100% 39%` | Accent fill (primary buttons, checks, gauges). Dark: the logo orange #FF6A1F with black text (WCAG 2.2 7.3:1; Apple HIG: accents get brighter in dark mode). Light: #C74200 with white text. WCAG 2.2 4.99:1 and APCA Lc 79, which black-on-orange can't reach (Oct 3 button research; Radix orange step 9 also takes white text). The logo and icon stay #FF6A1F. Hover is `hover:brightness-90` |
| `--primary-text` | `20 100% 56%` | `20 100% 35%` | Orange text: `text-primary`, note links, hashtags (4.5:1 or more). Read through `--text-color-primary` |
| `--primary-foreground` | `0 0% 0%` | `0 0% 100%` | Text on the accent: black in dark mode, white in light |
| `--ring` | `20 100% 56%` | `20 100% 46%` | Focus ring (3:1 or more, both themes) |
| `--destructive` | `0 72% 51%` | `0 72% 45%` | Delete buttons (white text 4.6:1 dark, 5.6:1 light) |
| `--destructive-text` | `0 86% 72%` | `0 72% 45%` | Error text: `text-destructive` (4.5:1 or more). Read through `--text-color-destructive` |
| `--app-floating-panel` | `0 0% 5%` | `60 9% 98%` | Floating bar body, opaque |

### Contrast (Oct 3)

Dark keeps the pure-black base; only the steps above it moved. The full audit, with every pair in both themes, is `grandmaster/sops/contrast-audit.md`.

- Text never fades below 4.5:1 (WCAG 2.2 SC 1.4.3). Use `text-muted-foreground`, never `text-muted-foreground/70`, `opacity-60` on text, or a fixed Tailwind gray or hue. Fades are for disabled controls and decoration only.
- Orange and red have a text shade and a fill shade. Tailwind v4 reads `--text-color-*` before `--color-*` for `text-*`, so `text-primary` and `text-destructive` get `--primary-text` and `--destructive-text` while `bg-primary` and `bg-destructive` keep the fill (the Radix scale does the same: step 9 for fills, step 11 for text).
- Text fields use `border-input`, never `border-border`.

- State indicators need 3:1 against what is next to them (WCAG 2.2 SC 1.4.11 Non-text Contrast, w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). Field borders (`--input`, 42%) meet it. Hairlines (`--border`, 24%) are decoration, not state, so they only need to be seen: 1.8:1 on the 6% panel, up from 1.4:1 at 16%.
- Steps follow the Radix scale roles (radix-ui.com/colors/docs/palette-composition/understanding-the-scale): app background, then component fills (muted 10%, accent 13%, selected 19%), then borders (24%, field borders 42%).
- Raised is lighter (Apple HIG, Dark Mode, developer.apple.com/design/human-interface-guidelines/dark-mode). Settings › Plan cards are `bg-muted` (10%) on the 6% panel. A switch's off track is `bg-input` with a `bg-background` thumb in both states (3.0:1 or more on every surface, both themes; Apple HIG Toggles: the track fills when on).
- Segmented controls: the selected segment is `bg-foreground text-background` (a solid pill, 14.8:1 on its track in dark, 15.4:1 in light), never `bg-background` on `bg-muted`, which is black on near-black. A note inside the selected pill (for example "save 21%") is `text-background/70`. Used in Settings › Plan, Insights date range, Billing period and General › Appearance › Theme (text segments only, no icons: sops/settings-ia-oct3.md).
- The selected sidebar row has two cues: the `--sidebar-accent` fill and `font-medium text-foreground` (other rows are `text-muted-foreground`).

### The one accent

Orange `#FF6A1F` = `hsl(20 100% 56%)`, sampled from `icons/stable/icon.png`. It is the only hue in the UI. Red is reserved for errors and recording-stop. Every other color is a neutral gray.

Toggles, checkboxes and selected rows stay neutral (white "on" track, gray fills). They never use the accent.

Data colors are the one exception: transcript speaker labels get distinct hues so people are easy to tell apart, at low chroma (OKLCH C 0.10) starting at a cool hue (220), so no speaker reads as the orange accent. The audio waveform and playhead stay neutral gray.

While recording, the red Stop in the bottom recording bar is the main action. It is the only Stop on screen, and the "New note" button turns gray until recording ends.

Adam picked orange on Oct 2 (the blueprint offered mint or violet). It matches the app icon. To change it later, edit `--primary`, `--primary-text` and `--ring` in both token blocks (fills are 56% with black text in dark and 39% with white text in light; the light ring is 39%, the dark ring 56%; text is 35% light, 56% dark), `--selection-overlay` in `dark-theme.css`, and the splash in `apps/desktop/index.html`.

## Type

- Font: Geist. Variable `.woff2` files and the SIL OFL license live in `apps/desktop/public/fonts/`. `--font-sans` and `--font-mono` are set in `apps/desktop/src/styles/globals.css`.
- Times and dates (clock times, ranges, durations, ages like "23h", timers, transcript timestamps) use Geist sans with `tabular-nums`, so digits line up without a second typeface. Changed Oct 3: Granola sets every time in its sans (Home rows, Coming up, Chat page Recents "23h"/"1d", transcript; Adam's Oct 3 Granola screenshots), and the Oct 3 fresh-eyes design review flagged mono times as reading like code. AM and PM may sit in small caps (`[font-variant-caps:all-small-caps]`).
- Geist Mono is only for key chips (`Kbd`), code, logs and technical IDs.
- Display font: Bricolage Grotesque (SIL OFL 1.1, `apps/desktop/public/fonts/bricolage/`), class `font-display`, weight 600, tracking -0.01em. Big titles only: page titles, the note title, the chat greeting, folder titles, "Coming up". Everything else stays Geist. Adam's pick on Oct 3 after the fresh-eyes review found no typographic voice; chosen over serif options so Upshot doesn't echo Granola's slab serif (Quadrant).
- One ratio: 1.2 (minor third) from a 16 px base. Set in the desktop `@theme` as `--text-*`, so every Tailwind `text-*` class follows it.
- Fonts and `--text-*` are also set in an unlayered `:root` block in `apps/desktop/src/styles/globals.css`. Keep it: `@anlg/ui/globals.css` loads later and would reset them to Tailwind defaults.
- Note text never auto-hyphenates (`hyphens: manual` in `packages/editor/src/styles/prosemirror/base.css`).

| Class | Size | Line height |
|---|---|---|
| `text-xs` | 11.1 px (0.694rem) | 1rem |
| `text-sm` | 13.3 px (0.833rem) | 1.25rem |
| `text-base` | 16 px (1rem) | 1.5rem |
| `text-lg` | 19.2 px (1.2rem) | 1.75rem |
| `text-xl` | 23 px (1.44rem) | 2rem |
| `text-2xl` | 27.6 px (1.728rem) | 2.25rem |
| `text-3xl` | 33.2 px (2.074rem) | 2.5rem |

- Note headings use the same ratio in `em`: h1 1.44em, h2 1.2em, h3 1em.
- Headline and body pairs sit three steps apart (1.2³ = 1.73, close to the 1.6 "golden ratio"). Examples: a Settings page title `text-xl` over `text-sm` rows, a note title 1.728rem over 16 px body, an onboarding section title `text-xl` over `text-sm` text, a home stat number `text-xl` over a `text-sm` label. Sub-headings may sit one or two steps above their text.
- No widows: a heading never ends with one word alone on its last line. Every `h1`–`h6` gets `text-wrap: balance`, and `p`, `li` and `figcaption` get `text-wrap: pretty`, in the `@layer base` block of `apps/desktop/src/styles/globals.css`. For a heading built from a `div` or `span`, add Tailwind `text-balance`.
- Arbitrary sizes map down to a step: `text-[10px]` and `text-[11px]` to `text-xs`, `text-[13px]` to `text-sm`.

## Shape and space

- Radius: `--radius: 0.5rem`. Controls are squircles. True circles use `.rounded-pill`.
- Flat: no drop shadows on black. Separate layers with a 1 px `--border` and one surface step.
- Nothing touches the window edges. Every panel has inner padding. The 40 px chrome row and the traffic-light inset stay as they are.
- The sidebar sits 12 px from the window edge. With the sidebar collapsed, the main panel keeps a 6 px black frame on the sides and bottom.

## Dialogs

`GlassDialogContent` (`apps/desktop/src/shared/ui/glass-dialog.tsx`) is the one dialog surface. Changed Oct 3.

- Opaque, never translucent. Dark: `hsl(0 0% 16%)`, lighter than the black window, because raised surfaces get lighter in dark mode (Apple HIG, Dark Mode: developer.apple.com/design/human-interface-guidelines/dark-mode; Material dark theme gives a 24 dp dialog a 16% white overlay: m2.material.io/design/color/dark-theme.html). Light: `--popover` (white).
- Hairlines inside a dark dialog are white at 15% (`--color-border` is overridden there). No shadow in dark; a soft shadow in light.
- The overlay is `bg-black/60`: a sheet dims the window behind it (HIG, Sheets).
- Field borders inside a dialog are `hsl(0 0% 46%)` (`--color-input` override): 3.2:1 on the dark surface, 4.6:1 on white, above the 3:1 of WCAG 2.2 SC 1.4.11 Non-text Contrast.
- Every dialog has a visible dismiss button (Cancel or Done), as HIG sheets do.
- Forms: a visible label above each field, never a placeholder in its place (NN/g, "Placeholders in form fields are harmful"); password rules shown under the field before typing (NN/g, password creation); a "Show password" checkbox (NN/g, "Stop password masking").

## Words

- Sentence case everywhere. No all-caps, no letter-spaced labels.
- No eyebrow labels (the small caps line above a heading). Delete them; the heading carries the meaning. The Settings nav has no group labels; space separates the groups. It has eight pages (General, Profile, Plan | Meetings, Transcription, Calendar, Notifications, Connectors); moved pages show in search only (sops/settings-ia-oct3.md).

## Build notes

- Classes in `packages/ui` components only reach the app after `pnpm -F ui build` (it writes `packages/ui/dist/globals.css`). The release script runs it.
- Colors the app uses in `apps/desktop/src` (`destructive`, `alert`, `primary` and the others) must be in the `--color-*` list in the `@theme` block of `apps/desktop/src/styles/globals.css`. If one is missing, opacity variants like `bg-destructive/10` render as nothing.

## Spacing rhythm

- Equal spacing: the gap from a heading to its rule (divider) equals the gap from the rule to the next text. Use one value per pair (for example `pb-3` above the rule and `pt-3` below it).
- Steps come in pairs of 8 px (Tailwind 2, 4, 6, 8). Cards use `p-5`; card grids use `gap-4`.

## Glance test

Each screen must answer "what is this and what do I do" in 3 seconds. One accent element per screen at most.

Words: empty states should stay near 10 words above the fold (Jack). Home (Oct 3): Up next, Follow-ups and Recent notes in one left-aligned column; the stat cards moved out (Settings > Insights keeps stats), and the shortcut list shows only when there are no notes yet.
