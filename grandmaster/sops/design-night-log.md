# Design night log (Oct 2–3, 2026)

Design lane, overnight. Nothing here is committed. Adam commits in the morning.

## Morning summary (read this first)

**What changed tonight:** the app now follows the design system on every main screen. That covers home, notes and transcript, recording, Settings, Calendar, Templates, chat and onboarding (onboarding not seen on screen). Three fresh-eyes critic rounds drove the fixes. Glaido's real brand tokens are recorded as the source.

**State at stop:** full type check passes (tsc exit 0). Tests: 4,099 pass and 2 fail, the old billing tests with 2025 dates, not from design work. Rebrand check: 0 hits.

**Screenshots:** `grandmaster/sops/design-night-shots/` (home, note transcript, Settings, recording).

**Your 3 steps in the morning:**
1. Rebuild the DMG, because a few UI changes landed after the build session's DMG:
   `bash grandmaster/scripts/release.sh`
2. Commit with this summary: `Overnight design pass: critic fixes, Glaido source, onboarding value line, labeled chat pill, local-only calendar`
3. Open onboarding once (first launch in a second macOS user) and check the new line under "Welcome to Upshot". I could not see onboarding on screen tonight.

**Not done (needs you or the build session):**
- A note's Summary tab is blank when no AI model is set up, so it shows no prompt. That is logic, and I reported it to the build session.
- Recording-screen screenshot `4-recording.png` is from before the "New note" gray-while-recording fix (a test covers that fix).
- Delight detail (Jack gap 7) is an idea only.

## Plan

1. Glaido brand extraction (Jack gap 5): record the source tokens in design-system.md.
2. Spacing and word-count rules (Jack gaps 2 and 4): record and apply to home and empty states.
3. Remaining screens: transcript, chat, templates, calendar, floating meeting bar, toasts, dialogs, Settings subpages (not settings/ai).
4. Logo at 16 px and the DMG background (Jack gap 8).
5. One quiet delight detail (Jack gap 7, optional).
6. Value proposition on the first onboarding screen (Jack gap 6), if the build session is not editing onboarding.
7. Fresh-eyes critic on every main screen; fix until it passes.
8. Morning summary at the top of this file.

## Done
- **Glaido extraction (Jack gap 5).** Pulled glaido.com's branding with Firecrawl and recorded it as the source table in design-system.md. Match: near-black base, one accent with black text, #252525-style borders, flat. Kept on purpose: orange (icon) and squircle corners.
- **Value proposition (Jack gap 6).** First onboarding screen: "Welcome to Upshot" (text-2xl) plus one sentence, "Record any call without a bot, and get clear notes from the newest AI models." (text-base, muted). Matches the README hero. Transcription setup and music logic untouched. Onboarding tests 26/26.
- **Transcript speakers.** Speaker colors now start at the accent hue (42°), so speaker 1 is orange instead of pink. Later speakers still spread by the golden angle, so people stay easy to tell apart (existing deltaE tests pass). File: session/components/note-input/transcript/renderer/utils.ts. Transcript tests 130/130.
- **Chat.** Floating chat panel uses the popover token instead of a hard-coded #202020. "Open AI Settings" became "Open AI settings". Warm stone shadows (rgba 87,83,78) replaced with neutral black in chat, templates, export modal and account.
- **Floating "New note" overlap.** On the Templates tab it covered the template's own "Set as…" button. It now floats only on home and Settings, where the top-right corner is free. Notes keep it in their header. (main/body.tsx)
- **Settings › Appearance.** Hid the "App icon" picker: the alternate icons still show the upstream "a." brand. The default icon is unchanged.
- **Settings › Notifications.** Hid the "Cloud sync complete" row (cloud sync is hidden in this app). The setting itself is untouched.
- Checked and fine: Settings › General, Meetings, Dictionary, Notifications, Insights (one label overlap, below), the transcript view, the note search dialog.
- **Insights year chart.** The first partial month label collided with the next ("Sept" over "Oct"); a first-column label now shows only when that month runs at least 3 columns. Empty-day squares were nearly invisible on the panel (bg-muted); now bg-foreground/10. Stats tests 29/29.
- **"Ask anything" pill.** The bottom chat handle was an unlabeled gray bar (critic: "no visible purpose"). It is now a small dark pill that always reads "Ask anything" (Granola-style) and still grows into the full bar on hover. Narrowed from 180 to 150 px so it clears the recording bar. (shared/chat-cta.tsx, session/components/floating/index.tsx)
- **Calendar.** Hid Google and Outlook (cloud, need upstream services); only Apple Calendar shows, per the blueprint. (calendar/components/sidebar.tsx) Calendar tests 27/27.
- Checked and fine: Folders, Templates (no overlap now), Calendar. Contacts is hidden per the blueprint: the build session moved it into HIDDEN_SETTINGS at my request.
- **Critic round 2 fixes.**
  - Note view accent creep: the waveform and playhead are neutral now (played part #a3a3a3, playhead #e5e5e5), and speaker colors dropped to low chroma (0.10). Speakers stay distinct (tests pass) but no longer compete with the orange "New note".
  - Home cards: an empty card now leads with its title as the heading (text-base) and a short gray hint (text-sm), so no small label sits over a big sentence.
  - Calendar: weekend columns are a touch darker instead of lighter. The month title steps up to text-base.
  - Fixed a type error from my calendar change that the build session caught. Full `tsc -p tsconfig.json` exits 0.
  - Kept on purpose: "New note" in Settings (Adam asked for it on every screen). The "Audio saved on this Mac" label is the build session's feature.
  - Tests for calendar, home, audio player and transcript: 193/193.
- **Jack gaps 2, 4, 8.** Recorded the equal-spacing rule and the about-10-words rule in design-system.md. Home keeps its cards and shortcut list on purpose (how a first-time user finds Settings). The app icon reads clearly at 16, 32 and 64 px on dark and light, so no change.
- **Skipped on purpose.** DMG background art: the release script builds the DMG with plain hdiutil, so the art is not used (build session confirmed). Delight detail (Jack gap 7): idea only, an accent pulse on the Summary tab when Enhance finishes; it needs Enhance state, which is the build session's logic.
- **Full check.** Full tsc exits 0. Full vitest: 4091 pass, 7 fail, none in design files: open-note-dialog (2) still expects the "Contacts" option the build session hid; billing (3) old Enterprise URL and 2025 dates; provider-routing (1); session-correction (1, the build session's in-progress security fix).
- **Critic round 3 fixes.** Speaker labels start at a cool hue (220), so they never read as the orange accent. The off-toggle knob is gray instead of black (it vanished into the track). Home cards lost their borders (fill only); empty-card hints wrap evenly (text-balance). "New note" measured at the same spot on home and in a note (31 px from the right, 32 px from the top), so it needs no move.
- **Paused app-code edits** while the build session runs its final tests, i18n extract and DMG build.
- **After the DMG build (rerun `bash grandmaster/scripts/release.sh` in the morning to include these).** Home card titles one step down (text-lg) so "Wrap-up streak" fits on one line.
- **Empty summary prompt** (also after the DMG). session/components/note-input/enhanced/config-error.tsx said "Start a Pro trial…" with a "Get Pro" button that pointed at the hidden Billing page. Now: "Choose an AI model" / "Pick a model in Settings to turn this transcript into a summary." with one button, "Choose a model". Test updated; enhanced tests 34/34.
- **Sentence case** (after the DMG): "Clean Up" became "Clean up" (Settings › Storage) and "Restart App" became "Restart app" (slow-load screen). Tests updated, 17/17. Kept as names: badge names, app-icon names, template names.
- **Open issue for the build session (logic).** On this Mac, an ended note with a transcript shows a blank Summary tab: no prompt, no Enhance button. Reported to the build session.
