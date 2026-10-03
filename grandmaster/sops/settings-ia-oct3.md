# Settings structure and theme control (Oct 3)

## Verdicts

**Q1. Theme control: compact. One "Theme" row with a text segmented control: Light | Dark | Match my Mac (default).**
- Granola: Preferences › Appearance › Theme is one row with a pop-up ("System") (private screenshot 13, not copied).
- Claude: the desktop app shows Appearance › Theme as one row with a 3-segment control. Claude's help center lists three choices, "Light, Match System, and Dark" (support.claude.com/en/articles/8887527-customizing-your-appearance-settings).
- NN/g, "Does your form really need a dropdown list?": with only a few options, a dropdown "adds unnecessary interaction cost". Show the choices instead. Carbon puts the cutoff at 3, M3 at 6 and USWDS at 7 (nngroup.com/articles/dropdown-list/). With 3 options, a segmented control beats Granola's pop-up.
- Apple HIG, Segmented controls: use one for "closely related choices" when it is important "to clearly show their selection state", with no more than about 5 to 7 segments. "Prefer using either text or images — not a mix of both." On macOS, icons need a label or tooltip (developer.apple.com/design/human-interface-guidelines/segmented-controls).
- NN/g, Icon usability: "a text label must be present alongside an icon"; don't rely on hover (nngroup.com/articles/icon-usability/). So the segments are text only. Claude's icon-only segments fail this test, and so would icons plus text (HIG says not to mix).
- Counter-evidence: macOS System Settings › Appearance uses large thumbnails. That is the OS-wide setting. HIG Settings says to respect systemwide settings and not repeat them in the app (developer.apple.com/design/human-interface-guidelines/settings). An app's copy of the setting is secondary, so it should be compact.
- Default "Match my Mac": HIG Settings says an app "can detect whether people are currently using Dark Mode". Granola defaults to System. Schema default `theme: "system"` is unchanged.

**Q2. Appearance is a section inside General, not its own page.** Granola keeps it in Preferences, between Features and Data & sharing (screenshots 12–13). Claude desktop keeps it in its general settings. HIG Settings says "Minimize the number of settings". A page with two rows (Theme, 24-hour time) is too thin to be its own sidebar item.

**Q3. Sidebar goes from 15 pages to 8, in two groups: General, Profile, Plan | Meetings, Transcription, Calendar, Notifications, Connectors.**
- Granola personal settings: Preferences, Profile, Calendar, Notifications, Connectors, Get help (screenshots 12–19).
- Apple HIG, Settings: "too many settings can make the experience feel less approachable, while also making it hard to find a particular setting". Put general, rarely changed settings in the settings area. The macOS settings window is a set of panes, "each [containing] a group of related settings".
- NN/g, Hick's law: more choices mean a longer decision (nngroup.com/videos/hicks-law-long-menus/). NN/g, Flat vs. deep hierarchies: "Categories that are specific and do not overlap are the easiest to understand", and users "can also become overwhelmed with long, cluttered menus" (nngroup.com/articles/flat-vs-deep-hierarchy/). NN/g menu-design checklist: clear, familiar labels, and front-load key terms (nngroup.com/articles/menu-design/).
- Where each page went (nothing deleted; every setting is still reachable):

| Old page | Now | Why |
|---|---|---|
| Appearance | General › Appearance section | Q2 |
| Privacy | General › Privacy section | Granola: "Data & sharing" is a section of Preferences |
| Permissions | General › Permissions section | Mac-wide status, rarely changed (HIG Settings) |
| Dictionary | Transcription › Dictionary section | Same object: words that help speech-to-text (NN/g: specific, non-overlapping categories) |
| Imports | Sub-page of Connectors (row "Import notes") | Granola Connectors is a list of rows, each opening a detail |
| Developers | Sub-page of Connectors (rows Glaido, MCP and CLI, Webhooks) | Same |
| Insights | Sub-page of Profile (row "Insights") | Stats are not settings (HIG: settings are options people adjust). Granola's Settings has no stats page |

- "General" kept, not renamed "Preferences". The evidence is split: Granola says Preferences; Apple's own Mac apps (Safari, Mail) and HIG ("General settings") say General, and Claude desktop also says General. Option 1: keep General (platform convention, no rename, no new tab id). Option 2: rename to Preferences (matches Granola). **Chose 1.** "preferences" is a search keyword, so a search for it finds General.
- "Plan" kept, not renamed "Billing". The page is a Free/Pro plan picker; billing is one action on it. NN/g says labels should be specific and familiar. "billing", "invoice" and "subscription" stay as search keywords. The evidence here is thin; Granola's word is Billing.
- No "Get help" page. Help is already in the Help menu (Keyboard shortcuts ⌘/, Report a bug), which is where HIG puts it (developer.apple.com/design/human-interface-guidelines/the-menu-bar, Help menu).

## How old links keep working

- `apps/desktop/src/settings/sections.ts`: `SETTINGS_SECTIONS` (appearance, privacy, permissions → app; dictionary → transcription) and `SETTINGS_SUBPAGES` (imports, developers → connectors; insights, stats → profile).
- Tab ids are unchanged. No id was removed, so restored tabs, `openNew({ type: "settings", state: { tab } })` calls, ⌘K and start-failure toasts ("Open permissions") all still work.
- A section id opens its parent page and scrolls to the group (`id="settings-section-<id>"`, `scroll-mt-6`). A sub-page id opens the sub-page with a "‹ Connectors" or "‹ Profile" back button (aria-label "Back to …"), like macOS System Settings detail panes. The sidebar marks the parent page.
- Moved pages are still nav entries with `parent`. They are hidden from the sidebar list, appear in sidebar search with their own keywords ("theme" finds Appearance; Return opens it and scrolls there), and appear in ⌘K "Go to".

## Theme control spec

- `SettingRow` (Palette icon, "Theme", "Light, dark, or the same as your Mac.") holding a `radiogroup` labeled by the row title. Three `radio` buttons; the checked one is the only tab stop, and the arrow keys move and select (WAI-ARIA APG radio group).
- The track is `bg-accent` on the `bg-muted` card. Selected: `bg-foreground text-background` (14.8:1 dark, 15.4:1 light). Unselected: `text-muted-foreground` (4.6:1 or more). These are the tokens Plan and Insights already use (design-system.md "Segmented controls").
- The preview cards (`ThemePreview`) are removed.
