# In-app test and publish tools

How the Oct 4 sessions tested every change in the real app before it went on the download page. Owner rule (Oct 4): test each change in the app first; during judging, do not publish without Adam's OK.

## Before any on-screen test

- Check that nobody is presenting: `pmset -g assertions | grep -c "Displaying Keynote slideshow"` must print 0 for a minute (Keynote refreshes the assertion every few seconds). On Oct 4 a test window opened over a live slideshow.
- Check that the screen is unlocked and awake: `swiftc -O -o /tmp/lockstate lockstate.swift && /tmp/lockstate`. Window captures fail while it is locked or asleep.
- If Adam is at the Mac (`ioreg -c IOHIDSystem | grep HIDIdleTime` near 0), ask before you open a test window.

## The test loop (Mac, Apple silicon)

1. Build: `bash grandmaster/scripts/release.sh aarch64` (about 4 minutes).
2. Install: `bash grandmaster/scripts/test-tools/install.sh ~/grandmaster-release/Upshot_1.0.0_aarch64.dmg`. It quits Upshot, verifies the signature and counts key-shaped strings (must be 0).
3. Open on a test profile: `bash grandmaster/scripts/test-tools/test-profile.sh`. It copies the real data into a throwaway HOME, so renames, deletes and chats never touch Adam's notes.
   A HOME override has no keychain: every saved secret fails ("A default keychain could not be found"), so Granola import, other connected imports and voiceprints cannot connect there. A keychain made inside the test HOME does not help (macOS shows "Keychain Not Found"). Test those in a second macOS user.
4. Drive the app with the computer-use app_* tools (bundle id `com.websiteformula.upshot`): app_list_windows, app_screenshot, app_click by element index, app_type, app_key, app_zoom. They work in the background.
5. Right-click menus are native menus the app_* tools refuse. Compile the helpers, check that Upshot is the top window at the point, then click with global events:
   - `swiftc -O -o /tmp/topwin topwin.swift && /tmp/topwin <x> <y>` must print Upshot.
   - `/tmp/rightclick <x> <y>`, then `screencapture -x -R <x>,<y>,360,260 /tmp/menu.png` to see the menu, then `/tmp/leftclick <x> <y>` on the item. Screen points = window origin + the element's window coordinates.
6. Test in light and dark (Settings › General › Theme on the test profile).
7. Intel smoke test under Rosetta: build `x86_64`, copy Upshot.app out of the DMG, `open -g -j -n --env HOME=<test home> <copy>/Upshot.app`, find the window with `winlist.swift <pid>`, capture it with `screencapture -x -o -l <window id>`.
8. Quit the test copy (`pkill -x upshot`). Adam's own Upshot stays closed until he opens it; each new ad-hoc build asks again for the microphone, system audio and keychain.

## Other helpers

- `MeetingTest.swift` opens the microphone for N seconds to trigger the meeting popup. The mic use is attributed to the app that launched it, so it may need that app's microphone permission.
- `axtool.swift` lists or presses accessibility elements by title (`axtool <pid> list <filter>`, `axtool <pid> press <title>`).

## Publishing (after judging, or with Adam's OK)

1. Mac: build both architectures (`release.sh aarch64` and `release.sh x86_64`), test, then `bash grandmaster/scripts/test-tools/publish-mac.sh --yes`. It scans both DMGs for keys and keeps the Windows and Linux lines of the live SHA256SUMS.txt.
2. Windows and Linux: dispatch `upshot-release.yaml` on GitHub Actions (about 70 minutes), then `bash grandmaster/scripts/test-tools/fetch-winlinux.sh <run id>`. Look at the run's screenshots in /Users/Shared/upshot-night-checks/, then `bash grandmaster/scripts/test-tools/publish-winlinux.sh --yes`.
3. Check the page: `gh release view v1.0.0 --repo AdamWebsiteFormula/grandmaster-app --json assets`. With `--clobber`, a file is missing for a minute or two while it uploads.
