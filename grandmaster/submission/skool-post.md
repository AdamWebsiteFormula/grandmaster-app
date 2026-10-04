# Skool post draft

Post in the category Jack names for submissions (check the pinned post first). Attach all five installers and the Loom.

**Check before you post (Adam only; delete a line from the post if its check fails):**
- [ ] Category: confirm the name in Jack's pinned comment ("Dubai Grandmaster" or "AI Grandmaster Competition").
- [ ] The attached installers are the latest build: each SHA-256 matches the last entry in grandmaster/sops/night-log.md (2 Mac DMGs, the Windows .exe, the Linux .AppImage and .deb).
- [ ] Install in a second macOS user: Open Anyway works, ⌘N records, and the summary appears with no key.
- [ ] Windows and Linux: only automated tests ran (GitHub machines: install, launch for 20 s, a first-run screenshot). Nobody has recorded a meeting on them yet. Keep the Windows and Linux lines knowing that.
- [ ] Clicking a transcript word plays the audio.
- [ ] Calendar: Coming up on Home shows your next meetings after you allow access.
- [ ] Granola import: Settings › Connectors › Import notes › Granola › Connect, then Sync now, and your meetings appear.
- [ ] Glaido: Settings › Connectors › Glaido › Create Glaido folder, import it in Glaido (Tools › Import), ask one question, get an answer.
- [ ] Pro: sign up with a new email, Upgrade to Pro, card 4242 4242 4242 4242, then Auto ⌄ in the chat box lets you pick a model.
- [ ] Stripe Dashboard: the sandbox customer portal cancels "at end of billing period", and the restricted key has Customers write (needed by Delete account).
- [ ] Settings › Profile › Delete account… works on that throwaway account (this also confirms the Worker is deployed with the latest code).

---

**Upshot: a Granola-style meeting notepad for Mac, Windows and Linux, free out of the box**

Upshot records any call without a bot and turns it into clear notes. Your notes, transcripts and recordings stay on your computer.

**What's better than Granola**
- Keeps your audio. Click any word in the transcript to hear that moment. Granola keeps no audio.
- Warns you live when it can't hear the other side, with You and Them meters.
- Free with no key and no account: Upshot transcription (Deepgram Nova 3) and Upshot AI (Claude Sonnet 5.5) work from the first meeting.
- Pro picks this week's models from Anthropic, OpenAI and Google, right in the chat box.
- On a Mac, reads every calendar account at once: Google, Outlook and iCloud. Granola reads only the account you sign in with.
- Plugs into Glaido on a Mac: ask about your meetings from any app.
- Imports your Granola meetings.

**Also in the box**
⌘N (Ctrl+N on Windows and Linux) to record, ⇧⌘N (Ctrl+Shift+N) for a blank note, Resume after Stop, Generate summary from typed notes. Full transcript with speakers and times; copy it or export PDF, text or Markdown. Chat on Home, a Chat page with recipes, and Draft follow-up email in every note. On a Mac: Google, Outlook and iCloud calendars with Coming up, reminders and a "Take notes" prompt when a call starts (Settings › Calendar › Add account). Folders, 9 templates, ⌘K (Ctrl+K) search inside your notes, and locked notes that never reach chat. Light, dark or match your system.

**Install (2 minutes)**
- **Mac** (Apple Silicon: `Upshot_1.0.0_aarch64.dmg`; Intel: `Upshot_1.0.0_x64.dmg`; macOS 15 or later): open the DMG and drag Upshot to Applications. Open Upshot. macOS blocks it the first time because it isn't notarized yet: go to System Settings › Privacy & Security, scroll down, click **Open Anyway**. Allow the microphone and system audio, then press ⌘N.
- **Windows 10 or 11** (`Upshot_1.0.0_x64-setup.exe`): Windows says "Windows protected your PC" because the installer isn't signed yet. Click **More info**, then **Run anyway**. Open Upshot from the Start menu and press Ctrl+N.
- **Linux** (`Upshot_1.0.0_amd64.AppImage` or `.deb`, tested on Ubuntu 24.04): `chmod +x Upshot_1.0.0_amd64.AppImage` and run it, or `sudo apt install ./Upshot_1.0.0_amd64.deb`. Press Ctrl+N.

No key needed on any computer.

**Try Pro (no real money)**
Settings › Plan › Upgrade to Pro. Create an account, then pay with the Stripe test card 4242 4242 4242 4242, any future date, any CVC. Then click **Auto ⌄** in the chat box and pick a model. Pro is $11 a month billed yearly, or $14 monthly. Delete the account any time in Settings › Profile.

**Where your data lives**
On your computer, in the `anarlog` folder (`~/Library/Application Support/anarlog/` on a Mac, `%APPDATA%\anarlog\` on Windows, `~/.local/share/anarlog/` on Linux). While you record, audio streams through the Upshot proxy (stores nothing) to Deepgram for the transcript, like Granola; on an Apple Silicon Mac you can switch to on-device transcription instead. When you make a summary or use chat, the note text goes through the Upshot AI proxy to OpenRouter. Pro stores only your email and Stripe customer ID. Full table in the README.

**How I built it**
Claude Code with B.L.A.S.T.: a blueprint first, a gate test before any change, one SOP per workstream, a codified design system, parallel Claude Code sessions and subagents, Granola as the benchmark for every flow, about 4,850 automated tests, and a red-team security pass. Details: `grandmaster/HOW-I-BUILT-THIS.md` in the repo.

**Credits**
Upshot is a fork of Anarlog by Fastrepl (MIT). It ships sqlite-sync unmodified (Elastic License 2.0). Fonts: Geist and Bricolage Grotesque (SIL Open Font License).

Repo: https://github.com/AdamWebsiteFormula/grandmaster-app
