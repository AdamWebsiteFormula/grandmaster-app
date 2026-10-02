# Upshot design system

Dark-first. True black base. One accent. Written Oct 2, 2026. The SOP that applies it is `grandmaster/sops/design.md`.

## Direction

- Black app, like Glaido. The window, sidebar and note body sit on pure black.
- Surfaces rise in small neutral steps (no warm stone, no cream, no olive).
- The accent is the orange from the app icon. It marks one thing per screen: the main action, the live recording state, focus and selection.
- Light theme stays as an option in Settings. Dark is the default for new users.

## Colour tokens

Bare HSL triples in `packages/design-system/src/tokens.css`, read as `hsl(var(--x))`. Never put hex or `oklch()` there.

| Token | Dark (default) | Use |
|---|---|---|
| `--background` | `0 0% 0%` | Window, sidebar, note body |
| `--foreground` | `0 0% 96%` | Body text |
| `--card` | `0 0% 6%` | Raised panels, cards |
| `--popover` | `0 0% 8%` | Menus, popovers, dialogs |
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

Orange `#FF6A1F` = `hsl(20 100% 56%)`, sampled from `icons/stable/icon.png`. It is the only hue in the UI. Red is reserved for errors and recording-stop. Every other colour is a neutral grey.

The blueprint offered mint or violet. The icon already shipped in orange, so the UI matches the icon. To change it, edit `--primary` and `--ring` in both token blocks, `--selection-overlay` in `dark-theme.css`, and the splash in `apps/desktop/index.html`.

## Type

- Font: system UI (SF Pro on macOS) until Geist (OFL) is added under `apps/desktop/public/fonts/`. Mono: system mono until Geist Mono is added.
- One ratio: 1.2 (minor third) from a 16 px base. Set in the desktop `@theme` as `--text-*`, so every Tailwind `text-*` class follows it.

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
- Arbitrary sizes map down to a step: `text-[10px]` and `text-[11px]` to `text-xs`, `text-[13px]` to `text-sm`.

## Shape and space

- Radius: `--radius: 0.5rem`. Controls are squircles. True circles use `.rounded-pill`.
- Flat: no drop shadows on black. Separate layers with a 1 px `--border` and one surface step.
- Nothing touches the window edges. Every panel has inner padding. The 40 px chrome row and the traffic-light inset stay as they are.

## Words

- Sentence case everywhere. No all-caps, no letter-spaced labels.
- No eyebrow labels (the small caps line above a heading). Delete them; the heading carries the meaning.

## Glance test

Each screen must answer "what is this and what do I do" in 3 seconds. One accent element per screen at most.
