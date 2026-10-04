# Handoff: final bug sweep (Oct 3 night → Oct 4 morning)

Read CLAUDE.md first. Submission: Sun Oct 4, 9:00 AM ET (Adam records the Loom early morning; church after ~8 AM). **Code freeze 6:00 AM ET**: after that, no code changes, only the final build.

## Owner rules (Adam)
- Research before implementing, every time. Post the research (named source + the practice) in chat BEFORE any change. Granola is the benchmark; NN/g, Apple HIG, WCAG 2.2 are the guidelines.
- When you find one problem, audit the whole app for that class of problem, in light and dark.
- Commit and push yourself (branch `grandmaster`, `bash grandmaster/scripts/push.sh`) only when these pass: in apps/desktop `PATH=/usr/local/bin:$PATH npx tsc --noEmit -p tsconfig.json` and `npx vitest run`; `bash grandmaster/scripts/rebrand-check.sh` (exit 0); worker `cd grandmaster/worker && node test.mjs` if touched. Run `npx lingui extract --clean && npx lingui compile` after string changes.
- Never commit secrets or anything from `~/code/grandmaster-private/`. No keys in repo/build/bundle. Keys are never pasted in chat.
- Must not touch: audio capture, transcription engine internals, crates/cloudsync, LICENSE files, @anlg/* and anlg-* names. No dependency upgrades.
- American English, sentence case. Short ELI5 replies in plain English; one step per message for Adam; exact paths.
- No sounds in the app except playback of the user's own recordings (owner decision).
- No new features. Finish and polish the basic app.

## State at handoff
- Head: see `git log -1` (last known e2c7d2f41b: mic permission text). All gates green at 07114f4170 (vitest 4,741 passed / 11 skipped, tsc 0, rebrand 0, worker 47/47).
- Platforms: Apple Silicon Mac DMG and Intel Mac DMG via `grandmaster/scripts/release.sh` and `release.sh x86_64` → `~/grandmaster-release/Upshot_1.0.0_{aarch64,x64}.dmg`. Windows (NSIS .exe) and Linux (AppImage, .deb) via GitHub Actions `.github/workflows/upshot-release.yaml` on AdamWebsiteFormula/grandmaster-app (workflow_dispatch; `GH_TOKEN=$(gh auth token --user AdamWebsiteFormula)`).
- Transcription: Apple Silicon = on-device (Soniqo / Apple Speech), audio never leaves the Mac. Windows, Linux, Intel Mac = "Upshot transcription": Worker `/stt/listen` proxies to Deepgram (secret DEEPGRAM_API_KEY set; $200 free credit, no card).
- Worker: https://upshot-ai.adam-694.workers.dev (deploy: `cd grandmaster/worker && PATH=/usr/local/bin:$PATH npx -y wrangler@4 deploy`). Hardened tonight (JSON-only chat, text-only parts, Pro list, period-end grace, plain errors, 60/min, cancel orphan subs; Stripe key has Subscriptions write).
- Install on this Mac: quit Upshot (`osascript -e 'tell application id "com.websiteformula.upshot" to quit'`; process name is lowercase `upshot`), hdiutil attach the DMG, `rm -rf /Applications/Upshot.app`, `ditto` it in (needs the sandbox disabled), `codesign --verify --deep`, copy DMGs to /Users/Shared. Each new build re-asks Keychain/mic/system-audio: Adam clicks those.
- Screen-control note: the computer-use tool swallows Escape, so Esc cannot be tested with it.

## Mac DMGs at handoff
- Built from b005053588's code (e2c7d2f41b app): aarch64 SHA-256 34bb180fa0d8760f51ec622cb19f599d63e3ce414737e9efe9ab0a87df2e1e42, x64 SHA-256 2e76e30f095172a17d12b4fc55701f836fc4246799424a0832d0c58960cbfef2. aarch64 installed in /Applications; both copied to /Users/Shared.

## Done tonight (don't redo)
Night sweep (4 audits + fixes), Worker hardening, dark-mode segment fix, Home rows, The upshot card removed, silent app, Transcript label on the note bar, Intel/Windows/Linux builds, cloud transcription, mic purpose string. See grandmaster/sops/night-log.md.

## Open / next
1. Confirm Windows + Linux Actions runs are green on the latest head (in progress at handoff: run 37165063236 on 07114f4170, run 37164134976 earlier; check with `gh run list --repo AdamWebsiteFormula/grandmaster-app --workflow upshot-release.yaml`; Windows/Linux code is unchanged since 07114f4170, later commits are Mac-only); download artifacts to ~/grandmaster-release/ with SHA-256; record smoke-test results honestly (no real Windows/Linux machine available).
2. Final bug sweep with fresh eyes (read-only audits first, then verified fixes with tests), especially: first-run on a fresh profile, Windows/Linux-specific UI (Mac-only features must be hidden there: Apple Calendar, Apple Speech, floating bar, Glaido), Intel transcription default.
3. Update `grandmaster/submission/skool-post.md` + `loom-script.md` + README for "runs on any computer": per-OS install steps (Mac: Open Anyway; Windows: SmartScreen "More info › Run anyway" since unsigned; Linux: AppImage chmod +x), per-OS transcription/privacy, attach all installers. Record final SHA-256s in night-log.
4. Known, not fixing before the deadline: a Pro user with an expired session silently gets Auto (needs app change); "Forgot password" is email support only.

## Update, second session (Oct 3, ~10:35 PM)
- Owner decisions tonight: (1) Upshot transcription (Deepgram through the Worker) is the default on EVERY computer, Apple Silicon included; on-device Apple Speech and Parakeet remain choices on Apple Silicon. (2) Calendar "safe night": Mac wording names Google, Outlook and iCloud (through System Settings › Internet Accounts) with an always-visible Add account; Windows and Linux hide calendar setup. Google and Outlook sign-in on every computer (Cronofy or Unipile) is researched and deferred. (3) Never assume a Mac (memory: not-everyone-uses-a-mac).
- Commits: 6308ed2791 (cloud default, Windows/Linux pass, calendar wording, docs), 5bcb8152c4 (review fixes, CLI says Upshot), cc10ca71a5 (workflow screenshots only). Gates green at 5bcb8152c4: vitest 4,813 passed / 11 skipped, tsc 0, rebrand 0, worker 47/47, cargo test anarlog-cli 35.
- Worker redeployed (privacy page for all platforms, version 164b2359); /stt live and batch verified with the app's exact query.
- Mac DMGs from 5bcb8152c4: aarch64 9aaef872789f299fcd4ea0f0427433e0f0211ec397b21866107445fa7368c1fd, x64 445a8e33a6ea2db2594d23a4fdebbcd9a204fa116dd513485c21a71428503d5b; aarch64 installed; both in /Users/Shared. Adam recorded on it and the transcript appeared. His own profile is on Upshot transcription (a backup of his app.db is in this session's scratchpad).
- Windows/Linux runs in progress: 37170630021 (cc10ca71a5, with first-run screenshots, the one to ship), 37170559204 (5bcb8152c4, backup), 37169430267 (6308ed2791, superseded). When green: download upshot-windows-x64 and upshot-linux-x64 to ~/grandmaster-release/, write SHA256SUMS-win-linux.txt, review the screenshot artifacts, record checksums in night-log.
- If app code changes again before 6:00 AM: rerun the workflow (about 75 min) and both release.sh builds.

## Update, third session (Oct 4, ~3:25 AM)
- Final app code: 15e8082acd (UX/UI round 7). Seven review rounds tonight: rounds 1-5 graded from code and captures, rounds 6-7 from real screenshots of all 16 main screens in light and dark. Every fix and every rejected finding is in grandmaster/sops/night-log.md with its source.
- Final Mac DMGs (15e8082acd): aarch64 c4f3e9382ae4a072a177546b6407182529b078d86218bda392ec7113e2625f66, x64 19399a4e3048d8916baf1728a8981b0786aa93cfd686be41dc06ef78aeaae217. aarch64 installed in /Applications (codesign ok, no key-shaped strings); both in /Users/Shared with matching .sha256 files. The x64 build was launched under Rosetta on a new profile: setup opens correctly.
- Windows/Linux: run 37185016324 on 15e8082acd is the one to ship. Backups: 37184086211 (f43d607b1e), 37181916640 (15ef8543ff), 37180157974 (bb72df5e4f, green). The final checksums go in the last night-log entry.
- Captures while the Mac is locked: keep the display awake with `caffeinate -d -u -t <seconds>`; the screen stays locked. Transitions pause while locked, so a half-drawn color means recapture after the page settles.
- Test profiles keep synced settings (theme) in synced_preferences, which overrides app_settings.
- Deferred to after submission (larger restyles): My notes/Summary as a segmented control, a persistent sidebar in Folders and Templates, Templates list group labels, page-action insets, one control height (32 pt), monochrome provider logos.
- Adam's Upshot is closed; no test copies are running.
