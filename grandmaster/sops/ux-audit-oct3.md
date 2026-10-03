# UX/UI audit, Oct 3, 2026

Five read-only audits (whole app, both themes), against NN/g 10 heuristics (https://www.nngroup.com/articles/ten-usability-heuristics/), Apple HIG macOS (https://developer.apple.com/design/human-interface-guidelines), WCAG 2.2 AA beyond contrast, Granola docs, and grandmaster/design-system.md. Contrast is covered separately in contrast-audit.md.

Priority: P1 judge-visible blocker, P2 noticeable, P3 polish. Paths are under apps/desktop/src unless they start with plugins/, packages/ or grandmaster/.

**Shared vocabulary (all areas):** "New note" = create a note and start recording (Granola: New note starts transcribing, docs.granola.ai/help-center/getting-started/granola-101). "Blank note" = create a note without recording. Recording actions are always "Start recording", "Stop recording", "Resume recording". Ellipsis character "…", never "...". Sentence case everywhere. "Settings › X" with the › character.

## A. Onboarding, native menus, tray, Dock (owner: helper A)

| P | File | Problem | Fix | Rule |
|---|---|---|---|---|
| P1 | onboarding/index.tsx:250, onboarding/permissions.tsx:213-216, onboarding/shared.tsx:108 | Permissions step can't finish unless Accessibility is on; Next only in DEV. | isComplete = mic + systemAudio. When Accessibility not authorized show secondary button "Continue without meeting details" + line "You can turn this on later in Settings." | NN/g #3; Granola needs only mic + system audio (docs.granola.ai/help-center/taking-notes/speaker-attribution) |
| P1 | shared/main-app-layout.tsx:144-145 (plugins/tray/src/menu_items/tray_start.rs:24-30) | Tray "Start a new meeting" opens a blank note, never records (state.autoStart ignored). | if payload.tab.state?.autoStart → openNewNoteAndListen({behavior:"new"}) else openNewNote(). | NN/g #1, #4 |
| P1 | onboarding/final.tsx:27-33, 41, 51 | "Join our community" (none exists); GitHub icon 20px to a repo with Issues off; never says how to record. | Delete SOCIALS. Description: "Click New note at the top right, or press ⌘N, to record your first meeting." (match the final ⌘N mapping below). | NN/g #2; WCAG 2.5.8 |
| P2 | onboarding/welcome-note.ts:30, onboarding/example-note.ts:22 | Both point to "the sidebar"; notes now live on Home. | "…open Example: Product sync on Home…"; "To delete it, right-click it on Home and choose Delete note." | NN/g #2 |
| P2 | shared/useMainShortcuts.tsx:53-66, plugins/tray/src/menu_items/app_new.rs:14 (route shared/main-app-layout.tsx:121), shared/new-note-button.tsx:16 | Orange New note records; ⌘N, File › New Note, Dock › New Note make a blank note. | ⌘N and /app/new (no search) → openNewNoteAndListen. Blank note → ⇧⌘N, labeled "Blank note". New note button title "New note and start recording (⌘N)". Coordinate: home/home-view.tsx empty-state row label is helper B's (use "Blank note ⇧⌘N"). | NN/g #4; Granola 101 |
| P2 | plugins/tray/src/menu_items/help_report_bug.rs:14,19; help_suggest_feature.rs:14,19 | Open repo root; Issues disabled → dead end; title case. | Point both to https://github.com/AdamWebsiteFormula/grandmaster-app#support (add a short "Support" section to README with an email-free path: "Open an issue" once enabled, otherwise the repo Discussions/README). Rename "Report a bug…", "Suggest a feature…". Flag to owner: enable Issues. | NN/g #10 |
| P2 | src-tauri/src/lib.rs:348; plugins/tray/src/menu_items/tray_check_update.rs:158-162 | Check for Updates always errors (updater inactive). | tauri_plugin_tray::init(false) or hide the item in app/tray/Dock. | NN/g #9 |
| P2 | plugins/tray/src/menu_items/tray_settings.rs:16 | "Settings" without "…" and ⌘,. | MenuItem "Settings…" with Some("CmdOrCtrl+,"); remove the web "mod+," hotkey to avoid double fire (contexts/shell/settings.ts:14). | HIG menu bar |
| P2 | plugins/tray/src/menu_items/app_info.rs:27-40, ext.rs:59/78 | About box is a debug dialog with SHA. | PredefinedMenuItem::about with AboutMetadata { version, copyright: "Built on Anarlog (MIT)" }. | HIG App menu |
| P2 | plugins/tray ext.rs:134-142; shared/useMainShortcuts.tsx | ~12 shortcuts, no list; no Help items. | ⌘/ opens a GlassDialog listing shortcuts; Help menu "Keyboard shortcuts ⌘/" and "Upshot Help" (README). | NN/g #6, #10; HIG keyboards |
| P2 | onboarding/shared.tsx:84, 108; onboarding/config.tsx | Back/Next only in DEV; no step count. | Show Back always; "Step n of total" text-xs muted after the h2. | NN/g #1, #3 |
| P2 | onboarding/permissions.tsx:65-73 | Denied looks like new; errors only in title tooltip. | Denied title "Turn on {name} in System Settings"; error as text-destructive text-xs line. | NN/g #9; WCAG 3.3.1 |
| P2 | calendar/components/apple/permission.tsx:201-212 | "You can Request, Reset or Open permission panel." | "Calendar access is off. [Open System Settings] to turn it on, or [Reset calendar access] and try again." | NN/g #2, #9 |
| P2 | plugins/dock/src/menu_items/quit.rs:7-10, restart.rs:7-11 | Force-quit/restart with no confirm, even mid-recording. | Reuse TrayQuitCompletely confirm; "Quit Upshot completely…"; same confirm for Restart. | NN/g #5; HIG alerts |
| P3 | app_new.rs:14, dock new_note.rs:7, tray_check_update.rs:29-32/87-89, tray_quit_completely.rs:15, dock check_update.rs:13, tray_quit.rs:14, tray_hide.rs:15, tray_start.rs:14 | Mixed casing, "...", vague Quit/Hide, two names for one action. | "New note", "Check for updates…", "Restart to apply update", "Quit completely…", "Quit Upshot", "Hide window", tray "Start a new meeting" → "New note". | sentence case; HIG |
| P3 | plugins/tray ext.rs:99, 116-133 | Close Window twice; no Bring All to Front; no View › sidebar; no Edit › Find. | Remove Window close; add bring_all_to_front; View "Show sidebar ⌘\\"; Edit "Find ⌘F". | HIG menu bar |
| P3 | session/components/note-input/search/context.tsx:150 | ⌘H replace collides with Hide. | "mod+alt+f". | HIG keyboards |
| P3 | lock/gate.tsx:134, lock/screen.tsx:84 | Title case. | "Upshot is locked", "Note is locked". | sentence case |
| P3 | shared/long-load-gate.tsx:135-141 | "Restart App", "contact support", "Upshot Nightly". | "Restart Upshot"; "use Help › Report a bug."; drop Nightly. | NN/g #9 |
| P3 | onboarding/index.tsx:201 | Music toggle aria "Unmute/Mute". | aria-label and title "Play music"/"Mute music" (t). | WCAG 4.1.2 |
| P3 | onboarding/permissions.tsx:82-86 | aria-label differs from visible text. | Remove aria-label. | WCAG 2.5.3 |
| P3 | onboarding/index.tsx:264 | "Transcription ready" even if failed/downloading. | "Transcription set up" / "Transcription skipped" on failure. | NN/g #1 |
| P3 | onboarding/calendar.tsx:93 | After grant, "Connect calendar" opens Settings. | "Open Calendar settings" when authorized. | NN/g #2 |
| P3 | onboarding/shared.tsx:88,103,157,161; final.tsx:51; calendar.tsx:47,85; shared/brand-loading-view.tsx:19-20 | Shadows; hover on muted text does nothing. | Remove shadow/drop-shadow; hover:text-foreground. | design-system flat |
| P3 | apps/desktop/index.html:95 | 12px off-scale. | 0.694rem. | design-system |

## B. Home, sidebar, folders, templates, calendar, toasts, ⌘K (owner: helper B)

| P | File | Problem | Fix | Rule |
|---|---|---|---|---|
| P1 | folders/folder-editor.tsx:268-326 (sidebar/home-nav.tsx:93) | Folder page doesn't list its notes. | "Notes" section above Context using RecentNotes (home-view.tsx:329) with a folder-scoped query; empty "No notes in this folder yet". | Granola folders (docs.granola.ai/help-center/sharing/folders/spaces-and-folders); NN/g #6 |
| P2 | home/home-view.tsx:442 | Empty-state "New note ⌘N" makes a blank note. | Label "Blank note ⇧⌘N" (helper A remaps shortcuts). | NN/g #4 |
| P2 | folders/index.tsx:25-27; folders/sidebar.tsx:119-125 | Empty folders state has no button. | Outline "New folder" button opening FolderNameDialog. | NN/g empty states |
| P2 | templates/template-form.tsx:305-306; template-sidebar.tsx:573-576 | Template delete is instant hard delete. | DestructiveConfirmationDialog: "Delete “{title}”?", "This can't be undone.", "Delete template". | NN/g #5; HIG alerts |
| P2 | templates/template-sidebar.tsx:351, 376 | Icon buttons unnamed. | aria-label "Sort templates", "New template" (+title). | WCAG 4.1.2 |
| P2 | calendar/components/calendar-view.tsx:261, 284, 457 | Icon buttons unnamed. | "Previous month", "Next month", "Refresh calendar". | WCAG 4.1.2 |
| P2 | calendar/components/event-chip.tsx:68, 76 | "Delete Event…" only hides in Upshot; no undo; title case. | "Hide event", "Hide this event", "Hide all events in this series"; toast "Event hidden" with Undo (unignoreEvent). | NN/g #2, #3 |
| P2 | templates/sections-editor.tsx:298 | Jinja2 placeholder. | "What this section should cover, e.g. decisions made and who owns each". | NN/g #2 |
| P3 | sidebar/timeline/item.tsx:852 | "Open in New Window". | "Open in new window". | sentence case |
| P3 | calendar/components/session-chip.tsx:70 | "Delete Note". | t"Delete note". | sentence case |
| P3 | sidebar/toast/undo-delete-toast.tsx:177 | ⌘Z doesn't restore a deleted note. | While a pending deletion exists, mod+z (outside editors) → restoreGroup(latest). | HIG keyboards |
| P3 | folders/folder-editor.tsx:255-261, 131-134, 168-169, 382-404, 462-464 | No Rename item; silent rename failures; material × instant; delete alert wording. | Add Rename; toast errors (reuse sidebar/folder-name-dialog.tsx strings); Undo toast or confirm for materials; "Delete “{name}”?" + "Notes stay on Home. This folder, its nested folders and their materials will be deleted." | NN/g #5, #6, #9 |
| P3 | templates/sections-editor.tsx:185, 221-232 | Hover-only controls, unnamed drag handle, "Add Section". | group-focus-within/focus-visible opacity; aria-label "Drag to reorder"; "Add section". | WCAG 2.4.7, 4.1.2 |
| P3 | templates/template-form.tsx:82-94, 219-224, 246; templates/details.tsx:154 | Tag × 12px unnamed; title input unlabeled; hover:text-black. | aria-label "Remove {tag}", size-6; aria-label "Template name"; hover:text-foreground. | WCAG 4.1.2, 2.5.8 |
| P3 | shared/open-note-dialog.tsx:491, 507, 529-532 | "..."; "No results" flashes during debounce. | "…"; "Searching notes…" while pending; empty "No notes match “{q}”. Try fewer words." | NN/g #1, #9 |
| P3 | home/home-view.tsx:170, 418 | Truncation without title; locked notes not marked. | title attrs; lock icon with aria-label "Locked". | WCAG 1.3.1 |
| P3 | sidebar/home-nav.tsx:95; folders/sidebar.tsx:154 | Folder names truncate without title. | title={folder}. | WCAG 1.3.1 |
| P3 | sidebar/custom-sidebar-header.tsx:80-81 | Name "Go home" but it goes back. | label "Back". | WCAG 4.1.2 |
| P3 | sidebar/settings.tsx:125-141 | No aria-current on active settings item. | aria-current="page". | WCAG 1.4.1 |
| P3 | main/sidebar-timeline-chrome.tsx:70, 142 | Red dot only badge. | aria-label includes "meeting coming up"; bg-primary. | WCAG 1.4.1 |
| P3 | sidebar/toast/registry.tsx:116-118, 157-160 | Vague toasts. | "Transcription stopped. Pick another engine to keep going." + "Choose engine"; "Choose how Upshot transcribes" + "Choose". | NN/g #9 |

## C. Note screen, recording, transcript, editor, audio (owner: helper C; also meeting-float/**, stt/*.ts toasts, packages/editor widgets, packages/utils summary-eligibility)

| P | File | Problem | Fix | Rule |
|---|---|---|---|---|
| P1 | session/components/outer-header/overflow/export-modal.tsx:91 | Export from Memos/Transcript tab drops the summary silently. | Fall back to the first summary record when the current view isn't a summary. | NN/g #5 |
| P1 | session/components/floating/recording-bar.tsx:64-66 | No elapsed time while recording. | font-mono text-xs tabular-nums mm:ss after the label, 1 s interval from live start. | NN/g #1 |
| P2 | floating/recording-bar.tsx:44 | Bar disappears while finalizing. | Render during finalizing/running_batch: spinner + "Finishing transcript…", role="status", no Stop. | NN/g #1 |
| P2 | floating/recording-bar.tsx:65 | "Muted" reads like Upshot stopped. | "Your mic is muted", title "Unmute in your call to be recorded". | NN/g #2, #3 |
| P2 | note-input/header-transcript.tsx:257-296; overflow/index.tsx:~199 | Copy transcript / Delete recording only in right-click. | Copy transcript icon button by the active Transcript tab; add both to the … menu. | HIG context menus; Granola transcript copy |
| P2 | audio-player/provider.tsx:402; header-transcript.tsx:288-293; audio-player/timeline.tsx:71-76 | Delete recording: one click, no confirm, errors swallowed. | Confirm "Delete this recording?" (body "The transcript and notes stay. You can't undo this.", buttons Cancel/Delete recording); error toast "Couldn't delete the recording. Stop playback and try again." | HIG alerts; NN/g #5 |
| P2 | note-input/header-shared.tsx:157-166 | Copy notes pastes raw markdown in Gmail/Docs. | Also write text/html (serialize the doc), keep text/plain. | NN/g #2 |
| P2 | note-input/enhanced/enhance-error.tsx:65 (tasks.ts:596) | Raw errors (offline, 401/403, uuid). | Network → "Upshot can't reach the internet. Check your connection, then click Retry."; other → "Upshot couldn't write this summary. Click Retry." with raw text-xs muted below. | NN/g #9 |
| P2 | stt/detect-events.ts:399, 425 | "Yes" means two opposite things. | Meeting prompt action "Take notes"; ignore footer action "Ignore". | HIG alerts |
| P2 | overflow/listening.tsx:43-53; outer-header/index.tsx:320; header-transcript.tsx:272; meeting-float/overlay/bar.tsx:200 | Listening/Record/Recording names. | Shared vocabulary (top of file), wrapped in t. | NN/g #4 |
| P2 | packages/editor/src/widgets/format-toolbar.tsx:237-250 | Format buttons unnamed. | label "Bold ⌘B", "Italic ⌘I", "Underline ⌘U", "Strikethrough", "Code", "Highlight" as aria-label+title. | WCAG 4.1.2 |
| P2 | overflow/index.tsx:150-165 (metadata/index.tsx:7) | Meeting info in a submenu; Tab trapped. | Header icon button "Meeting info" opening MetadataPopoverContent; remove submenu. | WCAG 2.1.1 |
| P2 | note-input/header-raw.tsx:73, 107-108; export-modal.tsx:181, 229, 286, 471 | "Memos" upstream word. | "My notes" (tab, export), toast "Notes copied to clipboard". | NN/g #2; Granola "My notes" |
| P2 | note-input/enhanced/streaming.tsx:71, 73, 92 | "Model is thinking...", filler tip. | "Thinking it through…", "Writing your summary…", "Your summary appears here as it's written." | NN/g #2, #8 |
| P2 | transcript/screens/listening.tsx:28-33; screens/empty.tsx:44-54 | "first segment" jargon; no settings link on error. | "Listening…"/"Words appear here as people talk."; error adds outline "Transcription settings". | NN/g #2, #9 |
| P2 | transcript/screens/batch.tsx:38-40; stt/useRunBatch.ts:422 | "Batch transcription" jargon, untranslated. | "Transcript comes after you stop" / "Recording continues. Your transcript appears here after you click Stop."; toast "Switching to {label} for this transcript". | NN/g #2 |
| P2 | outer-header/metadata/participants/chip.tsx:42-49, 72, 93-103, 127-145 | Chip opens hidden Contacts; × 12px unnamed; "Enhance contact". | Remove onClick; aria-label "Remove {name}", size-6; "Fill in details from the invite". | WCAG 4.1.2, 2.5.8 |
| P2 | audio-player/timeline.tsx:95, 126 | Play/Pause and speed unnamed. | aria-label Play/Pause, "Playback speed". | WCAG 4.1.2 |
| P3 | floating/recording-bar.tsx:53; floating/index.tsx:23 | Recording bar and Ask bar overlap under ~760px. | One flex row while recording, or hide ChatCTA below 760px. | WCAG 1.4.10 |
| P3 | enhanced/config-error.tsx:9, 17-19 | role="alert" on empty state; no Try again button. | role="status"; secondary "Try again" (handleGenerate). | NN/g #9 |
| P3 | enhanced/streaming.tsx:21, 27, 62-97 | text-[1.5rem]; no Stop for a running summary. | text-2xl; ghost "Stop" → onCancel. | design-system; NN/g #3 |
| P3 | enhanced/generate-summary.tsx:39; enhance-error.tsx:85-91 | Second orange accent. | variant="secondary". | design-system one accent |
| P3 | header-transcript.tsx:318-327 | Edit mode toggle has no tooltip. | title "Edit transcript"/"Done editing". | NN/g #6 |
| P3 | export-modal.tsx:413-524; version-history-dialog.tsx:64 | No Cancel/Done; shadows; raw error; spans not legends. | GlassDialogContent + Cancel/Done; fieldset/legend; "Couldn't restore this version. Try again." | design-system dialogs; WCAG 1.3.1 |
| P3 | transcript/renderer/selection-menu.tsx:162, 228; speaker-assign.tsx:564-598 | Delete lines no undo; vague error; dead "Create new speaker"; "Confirm". | Undo toast; "Couldn't delete these lines. Try again."; hint text "Type a name to add a speaker"; "Assign". | NN/g #5, #9; HIG buttons |
| P3 | note-input/template-picker.tsx:119, 414-419, 561; raw.tsx:445 | Clear × unnamed 16px; font-mono on words; "New Template". | aria-label "Clear search", size-6; drop font-mono; "New template". | WCAG; design-system |
| P3 | packages/editor/src/widgets/slash-command.tsx:124-183 | Title case. | "Bulleted list", "Numbered list", "Checklist", "Code block". | sentence case |
| P3 | overflow/index.tsx:173, 242; overflow/delete.tsx:35; overflow/misc.tsx:35; overflow/index.tsx:198 | Case, ellipsis, Delete naming, separator. | "Open in new window", "Export…", "Delete note" + separator before it, "Opening…", "Transcribe again". | HIG menus |
| P3 | outer-header/metadata/index.tsx:143 | "Untitled Event". | "Untitled event". | sentence case |
| P3 | packages/utils/src/summary-eligibility.ts:41, 51 | Developer-worded too-short toast. | "Too little was said for a summary. Record a bit longer, then click Generate summary." | NN/g #9 |
| P3 | stt/start-failure.ts:62-64 | "vault folder". | "Check that your notes folder is available and your disk has free space, then try again." | NN/g #2 |
| P3 | note-input/header.tsx:53; title-input.tsx:417 | "Session" in names. | "Note views", "Note title". | NN/g #2 |
| P3 | streaming.tsx:29; title-input.tsx:92; screens/empty.tsx:73-74; raw.tsx:278; template-picker.tsx:410 | "...". | "…". | HIG writing |
| P3 | meeting-float/overlay/bar.tsx:212-221, 296 | Stop unlabeled until hover; text-[12px]; no way back to note. | title "Stop recording"; text-xs; click body shows the main window for the session. | NN/g #1, #3 |

## D. Chat, Plan, upgrade, worker messages (owner: helper D; chat/**, shared/chat-cta.tsx, upshot-plan/**, settings/plan.tsx, grandmaster/worker/src/auth.js and billing.js page text)

| P | File | Problem | Fix | Rule |
|---|---|---|---|---|
| P1 | chat/components/body/empty.tsx:90 | No starter prompts on home chat (no note open). | When !hasContext show chips: "What did I commit to this week?", "Summarize this week's meetings", "Prep me for my next meeting". | Granola recipes (docs.granola.ai/help-center/getting-more-from-your-notes/recipes); NN/g #6 |
| P2 | chat/transport/index.ts:313 | Error shown as "AI_APICallError: …". | return error.message (console.error the name). | NN/g #9 |
| P2 | chat/components/message/shared.tsx:93 (error.tsx:65) | Retry hover-only, 20px. | Visible for errors, focus-visible:opacity-100, p-1.5 or a text "Retry" button. | WCAG 2.4.7, 2.5.8 |
| P2 | chat/components/toolbar-controls.tsx:105-114 | Floating chat has no close button. | ChatActionButton X "Close chat" wired to onClose (chat-panel.tsx:132). | NN/g #3, #4 |
| P2 | shared/chat-cta.tsx:18, 32, 44 | ⌘J never shown; aria-label mismatch; 52px shadow. | Trailing kbd ⌘J; aria-label "Ask anything", aria-keyshortcuts="Meta+J"; drop the shadow. | NN/g #6; WCAG 2.5.3; design-system flat |
| P2 | chat/components/input/model-menu.tsx:86, 92, 104 (upshot-plan/index.ts:216, 227-228) | Disabled Pro items do nothing; "Upgrade" defaults monthly with no price. | Selecting a Pro model when free (and the Upgrade item) opens Settings › Plan (openNew settings tab plan) where price, toggle and status live; text-xs badge. | NN/g #4, #9; FTC clear terms |
| P2 | upshot-plan/upgrade-dialog.tsx:54; upshot-plan/index.ts:182-189 | "Sign in" opens the sign-up form. | mode in UpgradeDialogState; openUpshotSignIn → "signin"; openUpgrade → "signup"; sync on open. | NN/g #2, #4 |
| P2 | grandmaster/worker/src/auth.js:31, 102-105, 125-128 | Raw Supabase errors. | Login 400 → "Wrong email or password."; signup "already registered" → "An account with this email already exists. Sign in instead." (dialog switches to sign-in on that). | NN/g #9 |
| P2 | chat/components/message/error.tsx:13, 44-63 | "Learn how to fix this" opens upstream docs/localhost. | Remove link; context-length → "This chat is too long. Start a new chat and try again." | NN/g #10 |
| P3 | chat/components/message/normal.tsx:124-131 | Copy/Regenerate 22px; copy not announced. | p-1.5; aria-label Copied/Copy message; aria-live polite. | WCAG 2.5.8, 4.1.3 |
| P3 | chat/components/body/empty.tsx:30-40 | Chip labels end with periods. | Remove periods. | HIG buttons |
| P3 | chat/components/toolbar-controls.tsx:212-214, 289 | "Recent chats" eyebrow, untranslated; titles truncate. | Remove/translate heading text-sm; title attr. | design-system; WCAG 1.4.10 |
| P3 | chat/components/message/loading.tsx:14; tool/search-meetings.tsx:92-151 | "..."; developer search details. | "Thinking…", "Preparing search…"; "From {date}"/"To {date}"/"Last {n} days", drop Limit/Query none. | NN/g #2 |
| P3 | chat/components/message/tool/generic.tsx:9-10 | Raw tool names. | Friendly map (grep_notes → "Searched notes", read_folder_material → "Read folder files", get_meeting_transcript → "Read the transcript", …). | NN/g #2 |
| P3 | tool/approval-tools.tsx:55,58; tool/edit-summary.tsx:58 | Inconsistent approval labels, untranslated. | "Discard" + specific verb ("Apply correction", "Move contents", "Move meetings", "Apply to summary"), Trans. | NN/g #4; HIG alerts |
| P3 | chat/components/session-provider.tsx:488 | "batch transcription", "Settings > Transcription". | "The transcript is still being processed, so chat can't read it yet. Ask again when it's done, or pick a Live model in Settings › Transcription." | NN/g #2, #4 |
| P3 | chat/components/persistent-chat.tsx:61-71 | Esc doesn't close the right-panel chat. | Enable for RightPanelOpen too. | NN/g #4 |
| P3 | settings/plan.tsx:264-270, 321-322 | Canceled reads as active; Upgrade clickable while pending. | "Canceled. Pro stays on until {date}."; disable while pending, label "Reopen checkout". | NN/g #1, #5 |
| P3 | upshot-plan/upgrade-dialog.tsx:177-180 | "Sign in" link ~16px tall. | py-1/min-h-6. | WCAG 2.5.8 |
| P3 | grandmaster/worker/src/billing.js:410-415 | "Pro is ready" before webhook lands. | "Pro turns on in Upshot within a minute. You can close this tab." | NN/g #1 |

## E. Settings tabs (owner: helper E; settings/** except plan.tsx, sidebar/settings.tsx, sidebar/settings-nav-groups.ts, imports/**, src-tauri embedded_cli.rs)

| P | File | Problem | Fix | Rule |
|---|---|---|---|---|
| P1 | settings/privacy/index.tsx:77-94 | "Share usage data" and "Error" switches do nothing (no keys in release); contradict "no telemetry". | Delete both rows; add text-xs muted "Upshot sends no usage data or crash reports." | NN/g #1, #2 |
| P2 | settings/appearance/sidebar-item-fields.tsx:7-39 (appearance/index.tsx:16) | Folder/Tags switches do nothing (timeline hidden). | Remove from Appearance. | NN/g #4, #8 |
| P2 | sidebar/settings.tsx:76-80; settings/ai/shared/provider-search.tsx:41-43 | Esc to clear search closes Settings. | preventDefault when clearing. | NN/g #3 |
| P2 | sidebar/settings.tsx:44-58; sidebar/settings-nav-groups.ts | Search matches page names only. | keywords per item (language, microphone, dark, 24-hour, timezone, Touch ID, model, download, …). | HIG search fields |
| P2 | sidebar/settings.tsx:72-96 | Search input unnamed; "..."; clear × 16px. | aria-label "Search settings"; placeholder "Search"; × size-6. | WCAG 3.3.2, 2.5.8 |
| P2 | (seen by contrast audit) | Opening Settings › Plan from ⌘K left General highlighted. | Reproduce via code path (shared/open-note-dialog.tsx "Go to" → settings tab state) and fix if real. | NN/g #1 |
| P2 | settings/ai/stt/select.tsx:260-348, 928-960, 1105-1118 | Download hover-only & not keyboard reachable; no Cancel download; model delete without confirm; pickers unnamed. | Always-visible Download as a SelectItem; Cancel download (localSttCommands.cancelDownload); confirm "Delete {label}?" "You'll need to download it again ({size}) to use it."; aria-labels "Transcription provider", "Transcription model", "Model ID". | WCAG 2.1.1, 4.1.2; NN/g #3, #5 |
| P2 | settings/ai/shared/index.tsx:505-518, 875-883 | "Reset" deletes key without confirm; labels not linked. | "Remove key" + confirm; useId htmlFor/id. | HIG alerts; WCAG 3.3.2 |
| P2 | settings/developers/cli.tsx:41, 56, 222; src-tauri/src/embedded_cli.rs:252 | MCP key "anarlog", toast "anarlog is ready to use". | Key "upshot"; "Upshot CLI is ready to use"; embedded_cli command name "upshot" if safe (check the CLI binary name and Glaido config; do not rename anlg-* crates). | rebrand; NN/g #4 |
| P2 | settings/developers/webhooks.tsx:98-104, 189-240 | Delete unnamed, no confirm; URL placeholder leaks anarlog; no label. | aria-label + confirm; label "Webhook URL"; placeholder https://example.com/webhooks/upshot; title on truncated URL; status "Paused". | WCAG 4.1.2; NN/g #5 |
| P2 | settings/general/timezone.tsx:13-49 | 22 zones only; stale offsets. | Intl.supportedValuesOf("timeZone") + "System ({tz})"; live shortOffset. | NN/g #1, #2 |
| P2 | imports/screen.tsx:366-369 | "No apps found." dead end. | "No meeting apps found on this Mac." + list file-import providers. | NN/g #9, #10 |
| P2 | settings/dictionary/index.tsx:38-40, 109-115 | Free user sees a dimmed form, no explanation; input unlabeled. | Decide consistently: if Dictionary is gated, show "Dictionary is part of Upshot Pro." + secondary Upgrade (opens Settings › Plan); else ungate. aria-label "Add a term", hint as visible text-xs. | NN/g #1, #6 |
| P2 | settings/general/notification.tsx:416-433, 520-535 | Delay select unnamed, untranslated; chip × 12px unnamed. | SettingRow + labelProps, Trans; aria-label "Remove {app}", size-6. | WCAG 4.1.2, 2.5.8 |
| P2 | settings/general/spoken-languages.tsx:138-149 | Chip × 12px unnamed. | aria-label "Remove {language}", size-6. | WCAG |
| P2 | settings/general/permissions.tsx:84-123, 221 | Arrow icon action; eyebrow group labels. | Text buttons "Allow"/"Open System Settings"/quiet "Allowed"; drop groups; order Microphone, System audio, Accessibility, Calendar. | HIG buttons; design-system |
| P3 | settings/general/notification.tsx:284-285, 607-626 | Copy and eyebrow caption. | "Play a sound when a transcript or summary is ready."; "Respect Do Not Disturb"; delete the caption divider. | NN/g #2 |
| P3 | settings/general/app-settings.tsx:44, 61-66 | Wording; can hide both Dock and tray. | "Have Upshot ready when you log in to your Mac."; "Show in menu bar"; disable the last one on with "Keep Upshot in the Dock or the menu bar." | HIG; NN/g #5 |
| P3 | settings/general/meeting-settings.tsx:41-49, 72 | Disabled row without reason; "Memos". | "Turn on Start when meeting begins first."; "Save meeting chat to your notes". | NN/g #1, #2 |
| P3 | settings/ai/stt/configure.tsx:29-30; ai/shared/index.tsx:541, 610, 717; ai/stt/shared.tsx:427; select.tsx:610, 630; ai/stt/health.tsx:80-123 | Title case, text-md, jargon, untranslated, errors without fixes. | "Configure providers" text-base; "API key"; "Repair Keychain access"; "Your own model file"; t() wraps; add fixes to health messages. | sentence case; NN/g #9 |
| P3 | settings/developers/index.tsx:35-36; developers/glaido.tsx:133; imports/index.tsx:18-28 | Glaido below CLI; two primaries; Documentation vs Guide. | Glaido first; "Create Glaido folder" outline; one name "Help" ghost. | NN/g #4; design-system |
| P3 | settings/stats/index.tsx:69, 148; stats/badge-collection.tsx:151-263 | text-[9px]; title mismatch; Title Case badges; aria-label hides text; dialog without Done. | text-xs w-10; "Insights"; sentence case; drop aria-label; GlassDialogContent + Done. | HIG typography; WCAG 2.5.3 |
| P3 | general/index.tsx:242, 330; appearance/theme.tsx:37; developers/glaido.tsx:107; ai/stt/select.tsx:254 | Section heading sizes vary. | One SettingsSectionTitle (h3 text-base font-semibold). | NN/g #4 |
| P3 | sidebar/settings-nav-groups.ts:118-141 | Folders/Calendar/Templates leave Settings. | Remove from settings nav (they're in the main sidebar), or mark with ArrowUpRight + aria-label. | NN/g #4 |

## Confirmed fixed since Oct 2
Share buttons hidden; Language-model toast gone; bundled templates; ⌘K content search; stat cards removed; account dialog labels/Show password/Cancel; Plan pending status; boot splash mark; Calendar step; recording notice; example meeting; Default sharing row removed; updates toggle removed; Insights hello badge filtered; Glaido ⌘⇧G help; blank Summary shows Generate summary; note tab names; Copy notes button.
