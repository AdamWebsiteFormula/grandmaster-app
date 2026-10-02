# SOP: theme surfaces and restyle order

Scope: every place a later session must touch to restyle the desktop app with the smallest diff. Read-only survey, Oct 2, 2026. Paths are relative to the repo root.

Gaps in the inputs:
- `grandmaster/design-system.md` does not exist yet.
- `grandmaster/blueprint.md` does not name "Midnight Studio". It only fixes: one accent (electric mint or violet, Adam picks), Geist or Inter Display plus Geist Mono (OFL only), sentence case, no eyebrow labels, no Granola cream-and-olive or slab serif. Write design-system.md first, then run this SOP against it.

## 1. Theme entry points

| Path | What | Note |
|---|---|---|
| `packages/design-system/src/tokens.css` | The color source of truth. `:root` (light) and `.dark` blocks of shadcn-style tokens: `--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--alert*`, `--border`, `--input`, `--ring`, `--app-floating-*`, `--chart-1..5`, `--radius`, `--sidebar-accent`, `--kbd-shadow-*` | Values are bare HSL triples (`24 10% 11%`), consumed as `hsl(var(--x))`. Keep that format. Palette today is warm stone. |
| `packages/design-system/src/index.ts` | `DesignColors` hex mirror of the same tokens | Only `apps/mobile/src/constants/theme.ts` uses it. Skip for desktop. |
| `packages/ui/src/styles/globals.css` | Tailwind 4 `@theme`: maps `--color-*` to `hsl(var(--*))`, sidebar tokens, `--radius-xl/lg/md/sm` derived from `--radius` | Imports tokens.css. Built to `packages/ui/dist/globals.css` by `pnpm build` in packages/ui. Desktop does not import it. |
| `apps/desktop/src/styles/globals.css` | The desktop entry (`@import "tailwindcss"`). Its own `@theme`: `--font-sans`, `--font-hand`, `--radius-full` (remapped to 0.5rem), `--radius-pill`, the same `--color-*` map, `--selection-overlay`, `--kbd-press-*`, animations. Also: body reset, `html,body{height:100vh;overflow:hidden}`, `.rounded-full` override, ProseMirror search highlight colors | The single best edit point for fonts and radius. |
| `apps/desktop/src/styles/dark-theme.css` | `.dark` extras: `color-scheme`, `--provider-brand-filter`, `--kbd-press-*`, `--selection-overlay`, search-match colors, scrollbar thumb hex `#44403c` | Hardcoded stone hexes. |
| `apps/desktop/src/styles/scrollbar.css`, `scrollbar.utilities.css`, `cursor.css` | Scrollbar and cursor rules | `cursor.css` forces `cursor: default !important` everywhere. Leave. |
| `packages/ui/src/styles/corners.css` | `corner-shape: squircle` on every element, `.rounded-pill` opt-out | Radius changes here change the look of every corner. |
| `packages/ui/src/styles/scroll-fade.css` | Scroll-edge fade masks | Check it against the new background. |
| `packages/editor/src/styles/prosemirror/*.css` | Note body typography and editor chrome. `note-typography.css` (font size, heading scale, code, quote), `dark.css`, `mention.css`, `nodes/{task-list,table,search,ai-highlight,hashtag,comment-anchor}.css` | Token-driven with hex fallbacks. 19 literals in note-typography, 9 in mention, 6 in dark.css (stone hexes). |
| `apps/desktop/index.html` | Boot splash: hardcoded `hsl(60 9% 98%)`, `hsl(24 10% 11%)`, `hsl(25 5% 45%)`, a system font stack, `<title>Anarlog</title>` | Must match the new background or the first frame flashes the old color. |
| `apps/desktop/public/theme-boot.js` | Sets `.dark` on `<html>` before React mounts. Reads `localStorage` key `anarlog-theme` | Keep in sync with `src/shared/theme/apply.ts`. |

## 2. Token inventory

| Concern | Where | Today | Note |
|---|---|---|---|
| Dark mode | `@custom-variant dark (&:where(.dark, .dark *))` in both globals.css files. Class toggled by `apps/desktop/public/theme-boot.js`, `src/shared/theme/apply.ts`, `src/shared/theme/provider.tsx`, `resolve.ts` | `.dark` class on `<html>`. Preference light, dark or system, from the settings value `theme` | For a dark-first direction, change the default in `normalizeThemePreference` (`apply.ts`) and the same fallback in `theme-boot.js`. 102 `dark:` utilities live in the TSX. |
| Native theme | `src/shared/theme/provider.tsx` calls `appWindow.setTheme()` | Follows the preference after mount | See section 4. |
| Settings UI for theme | `apps/desktop/src/settings/appearance/theme.tsx`, `app-icon.tsx`, `index.tsx`; `src/devtools-bar/quick-settings.tsx` | Light, Dark, System with a preview canvas | `theme.tsx` has 16 palette-class hits. Hide the picker if the app is single-theme. |
| Fonts | Only `--font-sans` in desktop globals.css (`system-ui, -apple-system, ...`). Mono: `--font-mono` is read with a fallback in `note-typography.css` but never defined | No webfont loads. `apps/desktop/public/fonts/SF-Pro-Text-*.otf` exists and nothing references it (proprietary, do not ship). `font-sans` x27, `font-mono` x25, `font-hand` x2 | To add Geist: put OFL `.woff2` files in `apps/desktop/public/fonts/`, add `@font-face` in `apps/desktop/src/styles/globals.css`, set `--font-sans` and `--font-mono` in its `@theme`. Also update the `index.html` splash font and the `ctx.font` measuring code in `title-input.tsx` (line 264, 384), `packages/editor/src/note/index.tsx` (497), `keymap.ts` (954). They read computed style, so they follow automatically. Remove the SF Pro files or the license question stays open. |
| Font-size scale | No custom scale. Tailwind default | `text-xs` x383, `text-sm` x378, `text-base` x34, `text-lg` x26, `text-xl` x9, 2xl-4xl x6. Arbitrary: `text-[11px]` x58, `text-[13px]` x26, `text-[10px]` x22, plus 7 one-offs. Note body: `--note-editor-font-size` (1rem), headings 1.25em, 1.125em, 1em, title 1.5rem | "One type ratio": define `--text-*` in the desktop `@theme` so every `text-xs/sm/base/lg` follows one ratio (for example 1.2). Then retire the arbitrary 10, 11, 13 px sizes (about 106 hits) by mapping them to the nearest step. Heading `em` scale in `note-typography.css` must use the same ratio. |
| Radius | `--radius: 0.5rem` in tokens.css. `--radius-xl/lg/md/sm` in ui globals. Desktop: `--radius-full: 0.5rem`, `--radius-pill: infinity`. `.rounded-full` is forced to 0.5rem in globals.css | `rounded-full` x185, `rounded` x102, `-md` x68, `-lg` x68, `-xl` x39, `-2xl` x23, `-pill` x15 | `rounded-full` is a squircle control radius by design (not a circle). Avatars and dots that need a true circle use `.rounded-pill`. Changing `--radius` shifts everything in step. |
| Shadows | Tailwind defaults. `--kbd-*` tokens for key caps | `shadow-none` x56, `shadow` x45, `-xs` x28, `-sm` x22, `-md` x11, `-lg` x8 | Override `--shadow-*` in desktop `@theme` for a flat look. `[data-settings-content]` already forces `box-shadow: none !important` on buttons (globals.css). |
| Spacing | No custom spacing tokens | Tailwind 4 default `--spacing` | Chrome offsets are fixed px (see section 4). Do not change `--spacing`. |
| Brand/icon filter | `--provider-brand-filter` in dark-theme.css | none or invert | Used by `settings/ai/shared/index.tsx`. |
| Selection overlay | `--selection-overlay` in globals.css and dark-theme.css | Blue (`59,130,246` and `96,165,250`) | Used by `session/components/note-input/transcript/renderer/selection-menu.tsx:532`. Re-point to the accent. |

## 3. Hardcoded colors (bypass the tokens)

Counts are from grep, excluding `*.test.*`. Palette class means a Tailwind color-NNN utility such as `text-red-600`.

| Area | Count | Representative paths | Note |
|---|---|---|---|
| `packages/ui` components, palette classes | 10 hits in 4 files | `components/ui/app-toast.tsx` (5), `tooltip.tsx` (2), `badge.tsx` (2), `card.tsx` (1) | Shared UI is almost fully tokenized. Fix these four first. |
| `packages/ui` hex or rgb literals | 23 lines in 7 files | `components/icons/outlook.tsx` (18, brand logo, leave), `dialog.tsx` (2, scrim), `avatar.tsx` + `lib/avatar.ts` (avatar palette), `dancing-sticks.tsx`, `tooltip.tsx`, `badge.tsx` | Dialog scrim and avatar palette are real theme surfaces. |
| `apps/desktop/src` palette classes | 300 hits in 73 files | `devtools-bar/index.tsx` (29, dev only), `settings/appearance/theme.tsx` (16), `settings/automations/index.tsx` (13), `settings/ai/stt/model-icon.tsx` (12), `session/components/outer-header/metadata/date.tsx` (9), `chat/components/message/shared.tsx` and `tool/shared.tsx` (9 each), `templates/template-form.tsx` (8) | By family: red 109, amber 48, neutral 42, blue 29, green 19, emerald 15, violet 13, sky 11. Red and amber are mostly status and error: map to `destructive` and `alert`. Add `--success` and `--warning` tokens only if several screens need them. Neutral (42) maps to `muted`/`border`. |
| `apps/desktop/src` `bg-white`/`bg-black`/`text-white` etc. | 58 | grep `\b(bg\|text\|border)-(white\|black)` | Check each in dark mode. |
| `apps/desktop/src` hex, rgb, hsl literals | 121 lines across 34 files | `editor-bridge/app-link-view.tsx` (33), `meeting-float/overlay/bar.tsx` (15, dark/light rgb pair), `templates/template-icon-picker.tsx` (9), `onboarding/calendar.tsx` (6), `settings/ai/shared/index.tsx` (5), `audio-player/provider.tsx` (5), `meeting-float/overlay/live-caption.tsx` (4), `billing/trial-dialog-icon.tsx` (4), `shared/ui/glass-dialog.tsx` (2), `shared/brand-loading-view.tsx` (2) | `app-link-view.tsx` is mostly third-party brand colors (leave). Edit `bar.tsx`, `live-caption.tsx` and `glass-dialog.tsx` by hand: they are the floating surfaces that sit over other apps. |
| `packages/editor` css literals | 59 lines across 10 files | `note-typography.css` (19), `mention.css` (9), `dark.css` (6), `task-list.css` (6), `comment-anchor.css` (6) | Mostly fallbacks of the form `var(--color-x, #hex)`. `dark.css` and search-match are real hardcodes. |
| Desktop CSS | 3 files | `styles/dark-theme.css` (scrollbar `#44403c`, `#57534e`, search match), `styles/globals.css` (search match `rgb(254 240 138 / .5)`, `--kbd-press-*`) | Tidy in the token pass. |

## 4. Window chrome (Rust and tauri config)

| Path | What | Note |
|---|---|---|
| `plugins/windows/src/window/v1.rs` (about lines 175-220, `window_builder`) | macOS main, note and composer windows: `.decorations(true)`, `.hidden_title(true)`, `.title_bar_style(TitleBarStyle::Overlay)`, `.theme(Some(Theme::Light))`, `.traffic_light_position(12.0, y)`, y = 25.0 on macOS 26+, else 19.0 | No vibrancy, no `windowEffects` and no transparency on macOS. `macOSPrivateApi` is false in `tauri.conf.json`, so the window is opaque and `bg-background` fills it. The initial native theme is hard-set to Light. `shared/theme/provider.tsx` corrects it after mount via `setTheme`, so a dark window can flash a light title bar at startup. For a dark-first direction, change `Theme::Light` to `Theme::Dark` here (a Rust edit in a plugin, not capture or transcription code). |
| `plugins/windows/src/window/v1.rs` lines 3-8 | Sizes: main 910x600 (min 500x500), note 720x820 (min 420x500) | Layout values, not theme. |
| `plugins/windows/src/window/composer.rs`, `floating_bar.rs`, `live_caption.rs` | Composer, floating bar and live caption windows: `.decorations(false)`, `.transparent(true)` | Transparent webviews. `globals.css` forces `html[data-floating-bar]` and `[data-live-caption]` to a transparent background. |
| `plugins/dictation/src/handler.rs` | Dictation HUD window, 240x52, undecorated | Dictation is hidden per blueprint. Skip. |
| `apps/desktop/src-tauri/tauri.conf.json` | `macOSPrivateApi: false`; DMG background `assets/dmg-background-stable.png`, window 660x430, icon positions 177,200 and 483,200 | The DMG background art is a brand surface: redraw it at the same size and keep the icon coordinates. |
| `apps/desktop/src-tauri/tauri.macos.conf.json` | Build runner and external binary only | No window chrome. |
| `apps/desktop/src/shared/hooks/useWindowControlsGutter.ts` | Web side of the traffic-light inset: gutter `76px / --anlg-zoom`, sidebar min width `max(200px, 76px/zoom + 124px)`, row top padding `max(0, 23px/zoom - 14px)` | The 12px x-inset and the 19/25px y-inset in Rust are coupled to these constants. |
| `apps/desktop/src/main/body.tsx` (about line 475-495) | Drag-region chrome row `h-10` with `data-tauri-drag-region` | Fixed 40px strip. |
| `apps/desktop/src/main/windows-title-bar.tsx`, `windows-window-controls.tsx` | Windows and Linux custom title bar | Not shipped on macOS. Skip. |

## 5. Main screens (top-level components)

| Screen | Path | Note |
|---|---|---|
| App shell, chrome, resizable panels | `apps/desktop/src/main/shell-frame.tsx`, `body.tsx`, `layout.tsx`, `main-surface-chrome.ts`; `src/shared/main/body-frame.tsx`; `src/shared/main-app-layout.tsx`; `src/shared/window-shell.tsx` | `shell-frame.tsx` sets the root `bg-background`. `main-surface-chrome.ts` picks the surface treatment (`top-borderless`, `top`, `left`, `default`). |
| Routes | `apps/desktop/src/routes/app/route.tsx`, `main/_layout.tsx`, `main/_layout.index.tsx`, `onboarding.tsx`, `note.$sessionId.tsx`, `composer.tsx`, `floating-bar.tsx`, `live-caption.tsx` | `routeTree.gen.ts` is generated. Do not edit. |
| Sidebar | `apps/desktop/src/sidebar/index.tsx` (+ `timeline/`, `folders.tsx`, `settings.tsx`, `templates.tsx`, `calendar.tsx`, `toast/`); `src/main/shell-sidebar.tsx`, `sidebar-timeline-chrome.tsx` | Timeline rows live in `sidebar/timeline/item.tsx`, `buckets.tsx`, `chips.tsx`. Several are hidden per blueprint (contacts, shared notes, automations). |
| Note editor (session) | `apps/desktop/src/session/index.tsx`, `session/components/session-surface.tsx`, `title-input.tsx`, `note-input/index.tsx`, `note-input/raw.tsx` (Memos), `note-input/enhanced/`, `note-input/header*.tsx`, `note-input/template-picker.tsx`, `outer-header/` | Body typography is in `packages/editor/src/styles/prosemirror/note-typography.css` and the streaming view `session/components/streamdown.tsx`. Both use `.note-typography`, so one CSS change styles both. |
| Transcript | `apps/desktop/src/session/components/note-input/transcript/index.tsx`, `renderer/` (+ `selection-menu.tsx`), `screens/` | Speaker colors and highlights live in `renderer/`. Check `audio-player/provider.tsx` (5 literals). |
| Floating meeting bar | `apps/desktop/src/meeting-float/overlay/bar.tsx`, `live-caption.tsx`; `session/components/floating/` | Hardcoded `rgb(46,46,43)` and `rgb(242,242,237)` pair. Keyed on `colorScheme`, not on the tokens. |
| Settings | `apps/desktop/src/settings/index.tsx`, `setting-row.tsx`, `page-title.tsx`; `general/`, `appearance/`, `ai/` (`llm/`, `stt/`, `shared/`), `privacy/`; hidden per blueprint: `sync/`, `team/`, `automations/`, `crm/`, `dictation*.tsx` | `settings/ai/shared/index.tsx` is where the model picker will live. Restyle it with the tokens. |
| Onboarding | `apps/desktop/src/onboarding/index.tsx`, `config.tsx`, `permissions.tsx`, `calendar.tsx`, `imports.tsx`, `final.tsx`, `shared.tsx`, `welcome-note.ts` | Runs edge-to-edge (`MainShellScaffold edgeToEdge`). `calendar.tsx` has 6 color literals. |
| Chat | `apps/desktop/src/chat/` (`components/chat-panel.tsx`, `message/shared.tsx`, `message/tool/shared.tsx`, `toolbar-controls.tsx`) | `toolbar-controls.tsx` takes a `surface: "light" or "dark"` prop. 9 palette hits each in the two message files. |
| Brand marks | `apps/desktop/src/shared/anarlog-mark.tsx`, `brand-loading-view.tsx` | Rebrand territory, but the colors belong to the theme pass. |
| Shared primitives | `packages/ui/src/components/ui/*.tsx` (button, input, select, dialog, dropdown-menu, popover, tooltip, switch, badge, card, command, kbd, toast, app-toast, ...); desktop-local `apps/desktop/src/shared/ui/` (`glass-dialog.tsx`, ...) | Edit a primitive once and every screen follows. |

## 6. Risks: where a token change breaks layout

| Risk | Where | Mitigation |
|---|---|---|
| Traffic-light inset is a fixed contract between Rust (x 12, y 25 or 19) and web constants (76px gutter, 23px baseline, 40px chrome row, 200px sidebar min) | `v1.rs`, `useWindowControlsGutter.ts`, `main/body.tsx` | Do not change one side alone. Rule "nothing touches edges": add padding inside panels, never move the chrome row. |
| `--radius` and `--radius-full` feed every control. Raising `--radius` past 0.5rem makes the 28px `size-7` and 20px chips look like pills. `rounded-full` is also forced in unlayered CSS (`globals.css`), so a token change alone may not move it | `tokens.css`, desktop `globals.css` | Change radius in one place. Spot check buttons, chips, inputs, toasts. Genuine circles use `.rounded-pill`. |
| Font swap changes metrics. Many fixed heights (`h-7`, `h-9`, `h-10`) assume system-ui line height. Geist runs wider, so sidebar titles, chips and truncated rows may clip. `title-input.tsx` and editor `keymap.ts` measure text with `ctx.font` | session and sidebar components | Test long titles, sidebar rows at 200px and the model picker. Set `line-height` explicitly. |
| Changing the type ratio shifts 106 arbitrary-size spots (`text-[10/11/13px]`), mostly dense metadata and chips. They can overflow if rounded up | `sidebar/`, `session/`, `settings/ai/` | Map to the nearest step and only ever round down inside chips. |
| Token format. `hsl(var(--x))` needs a bare triple. A hex or `oklch()` value silently produces invalid CSS and a transparent or black surface. `/50` opacity utilities depend on this format too | `tokens.css` | Convert hex to HSL triples. Do not introduce hex there. |
| Boot splash and native window theme are separate from the tokens. Mismatch shows as a flash on launch | `apps/desktop/index.html`, `v1.rs` `Theme::Light` | Update both together with the dark background token. |
| Floating windows are transparent and sit over other apps. A token with alpha, or a low-contrast border, vanishes there | `meeting-float/overlay/*.tsx`, `--app-floating-*` tokens | Keep `--app-floating-panel` opaque. |
| `.dark` has its own full token block. Editing `:root` only leaves dark mode on the old palette (or the reverse) | `tokens.css` | Edit both blocks, or remove one if the app becomes single-theme (and force `dark` in `theme-boot.js`). |
| `@anlg/ui` has a `dist/globals.css` build output, but desktop does not import it | `packages/ui/package.json` | No rebuild needed for desktop. Do not edit `dist/`. |
| Shared tokens also feed mobile (`DesignColors`) and other apps (`apps/web`, `apps/mobile`) | `packages/design-system` | Not shipped. Accept drift, or fork tokens into the desktop `@theme` and leave the package untouched. Forking is the smaller blast radius, but then every `--color-*` mapping has to resolve in the desktop file. |

## 7. Recommended edit order

1. Write `grandmaster/design-system.md` (palette in HSL triples, one accent, font pair, one type ratio, radius, shadow, dark-first or two-theme). Everything below follows it.
2. Tokens: `packages/design-system/src/tokens.css` (`:root` and `.dark`, plus `--radius`, `--chart-*`, `--sidebar-accent`, `--kbd-*`). Run the app and look before going further.
3. Desktop theme file: `apps/desktop/src/styles/globals.css` (`--font-*`, `@font-face`, `--text-*` scale, `--shadow-*`, `--selection-overlay`, `--radius-full`, search-match colors), then `dark-theme.css` hexes.
4. Boot path: `apps/desktop/index.html` splash colors and title, `public/theme-boot.js` default theme, `src/shared/theme/apply.ts` default, `v1.rs` `Theme::Light` if dark-first. Add the font files under `public/fonts/` and delete the unreferenced SF Pro files.
5. Editor typography: `packages/editor/src/styles/prosemirror/note-typography.css` (heading scale to the ratio, code font), `dark.css`, `mention.css`, `nodes/*.css`. This is the note body, the core screen.
6. Shared primitives: `packages/ui/src/components/ui/` (`app-toast`, `tooltip`, `badge`, `card`, `dialog` scrim, `button`, `input`, `select`), then `avatar.tsx` and `lib/avatar.ts`.
7. Desktop components by screen, highest value first: session and note editor, transcript, sidebar and timeline, floating bar (`meeting-float/overlay/bar.tsx`), settings (`ai/shared` model picker first), onboarding, chat. Replace palette classes with tokens: red to `destructive`/`alert`, neutral to `muted`/`border`, amber to a new `warning`. Retire `text-[10/11/13px]` last.
8. Skip: `outlook.tsx`, brand logos in `app-link-view.tsx`, `devtools-bar/` (29 hits, dev only), Windows/Linux title bar, `routeTree.gen.ts`, `packages/ui/dist/`, LICENSE and `@anlg/*` names, audio, transcription and cloudsync code.
9. Verify: run the app in the dark and light themes (or the single theme), open the note editor, the transcript, the sidebar, settings, onboarding and the floating bar. Run `scripts/verify` and the critic before merge, per `CLAUDE.md`. Re-run the grep counts in section 3 and expect the palette-class totals to drop sharply.

Rules to carry into every edit: nothing touches the window edges (padding inside every panel, chrome row untouched), one type ratio, sentence case with no eyebrow labels (also strip any uppercase or tracking-wide label classes: `grep -rEn "uppercase|tracking-(wide|wider|widest)" apps/desktop/src` (24 hits today) before the component pass), and each screen readable in 3 seconds.

## Direction from Adam (Oct 2)
- Jack Roberts likes black apps, like Glaido (he co-owns it). Design dark-first, with a true black base.
- So: make `.dark` in `packages/design-system/src/tokens.css` the default, and push the background to black.
- Change the hardcoded Light native theme in `plugins/windows/src/window/v1.rs` to Dark.
- Change the boot splash colors in `apps/desktop/index.html`.
- Keep one accent colour.
