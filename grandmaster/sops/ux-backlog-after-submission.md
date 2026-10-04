# UX backlog after submission (from the Oct 4 night reviews)

What still keeps the strictest reviewer at B+ instead of A+. Each item was found in the round 6-7 picture reviews of all 16 main screens (light and dark) or the round 5 code review. None is a broken flow. Do them one at a time, each with screenshots in both themes.

| # | What | Where | Source | Fix | Risk |
|---|---|---|---|---|---|
| 1 | My notes and Summary look like the date and folder chips; the selected one differs only by its border | Note page, chip row under the title (`session/components/note-input/header-shared.tsx`, `header-enhanced.tsx`) | NN/g, "Tabs, Used Right"; Apple HIG, Segmented controls | Make My notes / Summary one segmented control in the Plan Monthly/Yearly style; show date, people and folder as borderless gray metadata after a 16 pt gap | Medium: central screen; Summary also opens a menu |
| 2 | Folders and Templates swap the main sidebar for a back arrow, and the panel edge moves 4 pt | `folders/sidebar.tsx`, `templates/template-sidebar.tsx`, the sidebar shell | NN/g heuristics 3 and 4; Apple HIG, Sidebars | Keep Home, Search, Chat, Folders and Settings above the folder or template list; one sidebar width everywhere | High: layout change |
| 3 | The template list is two unlabeled A-Z groups (saved, then built-in), with near-duplicate names (1:1 meeting and 1:1) | `templates/template-sidebar.tsx` (`combinedTemplates`) | NN/g heuristics 4 and 6; Apple HIG, Lists and tables (section headers) | Add sentence-case group labels "Your templates" and "Built-in"; scroll the selected row to the middle | Low to medium |
| 4 | Single-line controls come in two heights (selects and the Dictionary field 36 pt, buttons and Profile fields 32 pt); Calendar stacks them | `settings/setting-row.tsx` (`SETTING_CONTROL_CLASS` h-9), Dictionary field | Apple HIG, Layout; NN/g heuristic 4 | One height, 32 pt (h-8); check the Dictionary field's inline Add button still fits | Low to medium: 17 controls |
| 5 | Top-right page actions sit at four insets (Home about 52 pt, note 8 pt, Templates 13 pt, Developers 32 pt) | Page headers | Apple HIG, Layout (alignment) | Align each page action's right edge to the content column | Medium: several pages |
| 6 | Settings section labels start 4 pt right of the page title and card edge | `settings/setting-row.tsx` (`SettingsGroup` title row `px-1`) and 5 `px-1` wrappers | Apple HIG, Layout | Set the offset to 0, or align with the row text; evidence is thin, pick one and apply it everywhere | Low |
| 7 | Two orange logos and an unlabeled "/" between the transcription pickers | `settings/ai/stt/select.tsx` | House rule (one accent); NN/g heuristic 6 | Monochrome logos; small "Provider" and "Model" labels instead of "/" | Low |
| 8 | The "Move Upshot to Applications" alert has two equal buttons | Mac first launch from the disk image | Apple HIG, Alerts (the default button is distinct) | Make Move the default (accent) button | Low |
| 9 | Insights says "conversations" and "meetings" for the same count | Insights page | NN/g heuristic 4 | One word, about a dozen strings | Low |
| 11 | ⌘N starts the timer while macOS still asks for the microphone, and the red "Can't hear the other side" alert shows under the prompt; after Allow, that recording stays silent (flat You meter) until it is stopped and started again (seen by Adam, Oct 4) | Recording start (listener start path) and the capture notice | Apple HIG, Privacy (ask in context, then act); NN/g #1 | If either permission is not yet granted, ask first and start recording only after Allow; if denied, show the Open System Settings message instead of a silent recording | Medium: touches the recording start path |
| 12 | Every update makes macOS ask for the microphone and system audio again | Release signing (`grandmaster/scripts/release.sh` signs ad hoc) | Apple, "Notarizing macOS software before distribution" | Sign with an Apple Developer ID and notarize, so permissions survive updates | Low code risk; needs a paid Apple Developer account |
| 10 | Dark menus (5%) are darker than the panel (6%) and chat (8%) they open over | `packages/design-system/src/tokens.css` `--app-floating-panel` | Apple HIG, Dark Mode (raised is lighter) | Raise the dark menu surface; check every menu and separator with screenshots | Medium: every menu |

Checked and rejected (with measurements), so don't redo:
- Dark Off switches: #6B6B6B on #191919 measures 3.30:1, which passes WCAG 2.2 SC 1.4.11.
- "Reinsta" on Developers: a locked-screen capture artifact; it settles to an outline "Reinstall".
- Welcome note blank lines: note paragraphs have no margin, so the blank line is the spacing.
- The first Notifications group has no title, as in Apple's own Notifications settings.
