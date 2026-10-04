# Skool post draft

Post in the category Jack names for submissions (check the pinned post first). Paste the copy below, add the Loom, and use the download link (no attachments needed).

**Check before you post (Adam only; delete a line from the post if its check fails):**
- [ ] Category: confirm the name in Jack's pinned comment ("Dubai Grandmaster" or "AI Grandmaster Competition").
- [ ] The download link works: https://github.com/AdamWebsiteFormula/grandmaster-app/releases/latest lists all five installers.
- [ ] The roadmap page is shared (its Share menu), or delete the Roadmap line.
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

**Upshot: a Granola-style meeting notepad for Mac, Windows, and Linux. Free out of the box.**

Upshot records any call without a bot and turns it into clear notes. Your notes, transcripts and recordings stay on your computer.

**Download:** https://github.com/AdamWebsiteFormula/grandmaster-app/releases/latest (always the newest build)

**What's better than Granola**
- Keeps your audio. Click any word in the transcript to hear that moment. Granola keeps no audio.
- Warns you live when it can't hear the other side, with You and Them meters.
- Free with no key and no account. Upshot transcription (Deepgram Nova 3) and Upshot AI (Claude Sonnet 5.5) work from the first meeting.
- Pro picks this week's models from Anthropic, OpenAI and Google, right in the chat box.
- Runs on Linux as well as Mac and Windows. Granola's desktop app is Mac and Windows only.
- You can edit the transcript. Granola's help center says you can't.
- On a Mac, it reads every calendar account at once: Google, Outlook and iCloud. Granola reads only the account you sign in with.
- Plugs into Glaido on a Mac, so you can ask about your meetings from any app.
- Imports your Granola meetings.

**Also in the box**
⌘N (Ctrl+N on Windows and Linux) records. ⇧⌘N (Ctrl+Shift+N) opens a blank note. Resume after Stop, and Generate summary from typed notes. It asks to take notes about a second after a call starts. You get the full transcript with speakers and times, and you can copy it or export PDF, text, or Markdown. Chat sits on Home, there's a Chat page with recipes, and every note has Draft follow-up email. On a Mac you also get Google, Outlook and iCloud calendars with Coming up, reminders, and a "Take notes" prompt when a call starts (Settings › Calendar › Add account). Folders in the sidebar, templates, ⌘K (Ctrl+K) search inside your notes, and locked notes that never reach chat. Light, dark, or match your system.

**Install (2 minutes).** Get the file for your computer from the download link above.
- **Mac** (`Upshot_1.0.0_aarch64.dmg` for Apple Silicon, `Upshot_1.0.0_x64.dmg` for Intel, macOS 15 or later): open the DMG and drag Upshot to Applications. Open Upshot. macOS blocks it the first time because it isn't notarized yet. Go to System Settings › Privacy & Security, scroll down, and click **Open Anyway**. Allow the microphone and system audio, then press ⌘N.
- **Windows 10 or 11** (`Upshot_1.0.0_x64-setup.exe`): Windows says "Windows protected your PC" because the installer isn't signed yet. Click **More info**, then **Run anyway**. Open Upshot from the Start menu and press Ctrl+N.
- **Linux** (`Upshot_1.0.0_amd64.AppImage` or `.deb`, tested on Ubuntu 24.04): `chmod +x Upshot_1.0.0_amd64.AppImage` and run it, or `sudo apt install ./Upshot_1.0.0_amd64.deb`. Press Ctrl+N.

No key needed on any computer.

**Try Pro (no real money)**
Settings › Plan › Upgrade to Pro. Create an account, then pay with the Stripe test card 4242 4242 4242 4242, any future date, any CVC. Then click **Auto ⌄** in the chat box and pick a model. Pro is $11 a month billed yearly, or $14 monthly. Delete the account any time in Settings › Profile.

**Where your data lives**
On your computer, in the `anarlog` folder (`~/Library/Application Support/anarlog/` on a Mac, `%APPDATA%\anarlog\` on Windows, `~/.local/share/anarlog/` on Linux). While you record, audio streams through the Upshot proxy (it stores nothing) to Deepgram for the transcript, same as Granola. On an Apple Silicon Mac you can switch to on-device transcription instead. When you make a summary or use chat, the note text goes through the Upshot AI proxy to OpenRouter. Pro stores only your email and Stripe customer ID. Full table in the README.

**What's next**
Sharing and teams first. Then the rest of Granola's features, and more. Roadmap: https://claude.ai/artifact/1pStsX6PV6TDSd6m7BQD1N

**How I built it**
Claude Code with B.L.A.S.T.: a blueprint first, a gate test before any change, one SOP per workstream, a codified design system, parallel Claude Code sessions and subagents, Granola as the benchmark for every flow, a full suite of about 4,880 automated tests (most from Anarlog), and a red-team security pass. Details are in `grandmaster/HOW-I-BUILT-THIS.md` in the repo.

**Credits**
Upshot is a fork of Anarlog by Fastrepl (MIT). It ships sqlite-sync unmodified (Elastic License 2.0). Fonts: Geist and Bricolage Grotesque (SIL Open Font License).

Repo: https://github.com/AdamWebsiteFormula/grandmaster-app
