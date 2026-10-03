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
| Borders | `#252525` | `0 0% 16%` (`#292929`) |
| Shadows | none | none on black; 1 px borders instead |
| Corners | 2 px, near square | 0.5rem squircle (kept: macOS controls) |
| Font | Aspekta (sans), 13 px body | Geist (OFL), 13.3 px `text-sm` body |
| Spacing | 8 px base unit | Tailwind 4 px steps, used in pairs of 8 |

What we take: the near-black base, one bright accent used sparingly, black text on the accent, hairline borders, a flat look. What we don't: lime (our icon is orange) and square corners (a desktop app reads better with macOS-style squircles).

## Color tokens

Bare HSL triples in `packages/design-system/src/tokens.css`, read as `hsl(var(--x))`. Never put hex or `oklch()` there.

| Token | Dark (default) | Use |
|---|---|---|
| `--background` | `0 0% 0%` | Window, sidebar, note body |
| `--foreground` | `0 0% 96%` | Body text |
| `--card` | `0 0% 6%` | Raised panels, cards |
| `--popover` | `0 0% 8%` | Menus and popovers (dialogs: see Dialogs below) |
| `--secondary`, `--muted` | `0 0% 10%` | Quiet fills, chips, inputs |
| `--muted-foreground` | `0 0% 60%` | Metadata, hints |
| `--accent` | `0 0% 13%` | Hover and selected row fill (shadcn name, not the brand accent) |
| `--sidebar-accent` | `0 0% 12%` | Active sidebar row |
| `--border` | `0 0% 16%` | Hairlines |
| `--input` | `0 0% 18%` | Field borders |
| `--primary` | `20 100% 56%` | The brand accent: primary buttons, links |
| `--primary-foreground` | `0 0% 0%` | Text on the accent |
| `--ring` | `20 100% 56%` | Focus ring |
| `--destructive` | `0 72% 51%` | Delete, errors |
| `--app-floating-panel` | `0 0% 5%` | Floating bar body, opaque |

### The one accent

Orange `#FF6A1F` = `hsl(20 100% 56%)`, sampled from `icons/stable/icon.png`. It is the only hue in the UI. Red is reserved for errors and recording-stop. Every other color is a neutral gray.

Toggles, checkboxes and selected rows stay neutral (white "on" track, gray fills). They never use the accent.

Data colors are the one exception: transcript speaker labels get distinct hues so people are easy to tell apart, at low chroma (OKLCH C 0.10) starting at a cool hue (220), so no speaker reads as the orange accent. The audio waveform and playhead stay neutral gray.

While recording, the red Stop in the bottom recording bar is the main action. It is the only Stop on screen, and the "New note" button turns gray until recording ends.

Adam picked orange on Oct 2 (the blueprint offered mint or violet). It matches the app icon. To change it later, edit `--primary` and `--ring` in both token blocks, `--selection-overlay` in `dark-theme.css`, and the splash in `apps/desktop/index.html`.

## Type

- Font: Geist, with Geist Mono for numbers and times. Variable `.woff2` files and the SIL OFL license live in `apps/desktop/public/fonts/`. `--font-sans` and `--font-mono` are set in `apps/desktop/src/styles/globals.css`.
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
- No eyebrow labels (the small caps line above a heading). Delete them; the heading carries the meaning. The Settings nav has no group labels; space separates the groups.

## Build notes

- Classes in `packages/ui` components only reach the app after `pnpm -F ui build` (it writes `packages/ui/dist/globals.css`). The release script runs it.
- Colors the app uses in `apps/desktop/src` (`destructive`, `alert`, `primary` and the others) must be in the `--color-*` list in the `@theme` block of `apps/desktop/src/styles/globals.css`. If one is missing, opacity variants like `bg-destructive/10` render as nothing.

## Spacing rhythm

- Equal spacing: the gap from a heading to its rule (divider) equals the gap from the rule to the next text. Use one value per pair (for example `pb-3` above the rule and `pt-3` below it).
- Steps come in pairs of 8 px (Tailwind 2, 4, 6, 8). Cards use `p-5`; card grids use `gap-4`.

## Glance test

Each screen must answer "what is this and what do I do" in 3 seconds. One accent element per screen at most.

Words: empty states should stay near 10 words above the fold (Jack). Home (Oct 3): Up next, Follow-ups and Recent notes in one left-aligned column; the stat cards moved out (Settings > Insights keeps stats), and the shortcut list shows only when there are no notes yet.
