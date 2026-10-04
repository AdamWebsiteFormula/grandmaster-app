# Handoff, Oct 4 morning (after the Skool post)

Rule from Adam (Oct 4, about 8:45 AM): no new features; UX and UI fixes only; test every change in the app before it goes on the download page. The Chat page redo must ship, even after 10:00 AM.

## On the download page (tested in the app first)

Mac, both DMGs, 9:34 AM, commit 5b3d36d (SHA-256 in the release's SHA256SUMS.txt):

- Chat page: an open chat stays in the page's own column; All chats goes back to Recents; leaving the page closes the chat (it stays in Recents). Tested on a copy of Adam's data, light and dark: send, open a recent, All chats, New chat, Home and back.
- Meeting popup: Upshot logo with the meeting app as a badge; a new call asks again once that app's mic has been off for a minute; corespeechd (macOS speech) never prompts.
- Back shows as a word on Settings and Templates (Mac, Windows, Linux).
- Search (Cmd+K): the selected row uses the sidebar's selected gray.
- Folders: right-click a sidebar folder for Rename… and Delete… (tested with a real right-click).
- Note header: the current view chip (My notes or the summary) is filled gray.
- Settings: section labels on the page title's edge; selects and fields 32 pt like buttons.
- Insights says meetings everywhere.
- Mac: recording asks for the microphone first and starts only after Allow (unit tests; the live prompt can't be clicked from here).
- Audio player checks every second after Stop.
- Intel DMG smoke-tested under Rosetta (Home renders).

Windows and Linux, 10:43 AM, cloud run 37205566680 (same code as the Mac DMGs, commit 5b3d36d). Reviewed first: key scan 0, and the run's own screenshots show the Windows and Linux first-run and Home screens. Published with the Mac lines of SHA256SUMS.txt kept, so the sums match every file.

## Committed, not yet on the download page (needs an in-app check)

- ce006b4: chat answers convert UTC to the Settings time zone (checked against Upshot AI: 10:01 UTC came back 6:01 AM EDT).
- e9b886f: template list group labels (Your templates, Built-in); Provider and Model labels on Settings › Transcription.

The screen locked at about 9:40 AM, so these wait for an unlocked screen. Then: build, test on a test profile (copy of the anarlog folder into a scratch HOME), publish Mac. Cloud run 37206908446 (commit bd387a7) already has these for Windows and Linux; download it with final-winlinux.sh after the Mac test passes, review, publish.

## Things Adam should know

- 8:53 AM: a test copy of Upshot opened on screen for about a minute while Keynote was showing a slideshow. Testing stopped at once and waited until the slideshow ended.
- Adam's own Upshot was quit for the install and left closed. /Applications/Upshot.app is the time-zone test build (the published 5b3d code plus ce006b4). macOS will ask again for the microphone, system audio and keychain after this update (ad-hoc signing, backlog item 12).
- Open decisions: turn on GitHub Issues (none on the repo now, so the guide has no bug link); email SQLite Cloud about the sqlite-sync production license (ELv2 README asks production users for a commercial license).

## Still on the UX backlog

Item 2 (Templates keeps the main sidebar), item 5 (top-right action insets), item 10 (dark menus lighter than the panel; touches 161 menus, needs a dark screenshot pass), items 15 to 17 (features, after the contest).
