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

## Afternoon update (2:38 PM): three more fixes, tested in the app, on the page

- ce006b4: chat answers give times in the Settings time zone (in-app: "times in Eastern Time", 6:01 AM, not 10:01 UTC).
- e9b886f: template list group labels (Your templates, Built-in); Provider and Model labels on Settings › Transcription (no "/").

Mac DMGs 2:27 PM (commit fda4746; Intel smoke-tested under Rosetta). Windows and Linux 2:38 PM from cloud run 37206908446 (commit bd387a7, same code), after the key scan and the run's screenshots. Every installer on the page is now the same code.

## How to test and publish

The scripts and steps are in `grandmaster/scripts/test-tools/README.md`: build, install, open on a test profile (a throwaway copy of the data), drive with the computer-use app_* tools, right-click helpers, the Rosetta smoke test, and the publish scripts (they refuse to run without `--yes`; do not publish during judging without Adam's OK).

## Things Adam should know

- 8:53 AM: a test copy of Upshot opened on screen for about a minute while Keynote was showing a slideshow. Testing stopped at once and waited until the slideshow ended.
- Adam's own Upshot was quit for the install and left closed. /Applications/Upshot.app is the published fda4746 build. macOS will ask again for the microphone, system audio and keychain after this update (ad-hoc signing, backlog item 12).
- Done at 3 PM: the GitHub About box now links to the download page and describes Upshot (it pointed to anarlog.so); the test count wording says most tests came with Anarlog.
- Open decisions: turn on GitHub Issues (none on the repo now, so the guide has no bug link); email SQLite Cloud about the sqlite-sync production license (ELv2 README asks production users for a commercial license); spend caps on OpenRouter and Deepgram (Adam skipped them for now).

## Still on the UX backlog

Item 2 (Templates keeps the main sidebar), item 5 (top-right action insets), item 10 (dark menus lighter than the panel; touches 161 menus, needs a dark screenshot pass), items 15 to 17 (features, after the contest).
