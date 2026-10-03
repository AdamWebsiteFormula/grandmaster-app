# Skool post draft

Post in the category Jack names for submissions (check the pinned post first). Attach the DMG and the Loom.

**Check before you post (Adam only; delete a line from the post if its check fails):**
- [ ] Category: confirm the name in Jack's pinned comment ("Dubai Grandmaster" or "AI Grandmaster Competition").
- [ ] The attached DMG is the latest build: its SHA-256 matches the last entry in grandmaster/sops/night-log.md.
- [ ] Install in a second macOS user: Open Anyway works, ⌘N records, and the summary appears with no key.
- [ ] Clicking a transcript word plays the audio.
- [ ] Calendar: Coming up on Home shows your next meetings after you allow access.
- [ ] Granola import: Settings › Connectors › Import notes › Granola › Connect, then Sync now, and your meetings appear.
- [ ] Glaido: Settings › Connectors › Glaido › Create Glaido folder, import it in Glaido (Tools › Import), ask one question, get an answer.
- [ ] Pro: sign up with a new email, Upgrade to Pro, card 4242 4242 4242 4242, then Auto ⌄ in the chat box lets you pick a model.
- [ ] Stripe Dashboard: the sandbox customer portal cancels "at end of billing period", and the restricted key has Customers write (needed by Delete account).
- [ ] Settings › Profile › Delete account… works on that throwaway account (this also confirms the Worker is deployed with the latest code).

---

**Upshot: a Granola-style meeting notepad for your Mac, free out of the box**

Upshot records any call without a bot and turns it into clear notes. Your notes, transcripts and audio stay on your Mac.

**What's better than Granola**
- Keeps your audio. Click any word in the transcript to hear that moment. Granola keeps no audio.
- Warns you live when it can't hear the other side, with You and Them meters.
- Free with no key and no account: Upshot AI (Claude Sonnet 5.5) writes your summaries and answers chat from the first meeting.
- Pro picks this week's models from Anthropic, OpenAI and Google, right in the chat box.
- Plugs into Glaido: ask about your meetings from any app.
- Imports your Granola meetings.

**Also in the box**
⌘N to record, ⇧⌘N for a blank note, Resume after Stop, Generate summary from typed notes. Full transcript with speakers and times; copy it or export PDF, text or Markdown. Chat on Home, a Chat page with recipes, and Draft follow-up email in every note. Apple Calendar with Coming up, reminders and a "Take notes" prompt when a call starts (add Google or Outlook in System Settings › Internet Accounts). Folders, 9 templates, ⌘K search inside your notes, and locked notes that never reach chat. Light, dark or Match my Mac.

**Install (2 minutes)**
1. Open the attached DMG and drag Upshot to Applications.
2. Open Upshot. macOS blocks it the first time because it isn't notarized yet: go to System Settings › Privacy & Security, scroll down, click **Open Anyway**.
3. Allow the microphone and system audio. Transcription sets itself up.
4. Press ⌘N to record. No key needed.

Needs a Mac with Apple Silicon and macOS 15 or later (macOS 26 for Apple Speech).

**Try Pro (no real money)**
Settings › Plan › Upgrade to Pro. Create an account, then pay with the Stripe test card 4242 4242 4242 4242, any future date, any CVC. Then click **Auto ⌄** in the chat box and pick a model. Pro is $11 a month billed yearly, or $14 monthly. Delete the account any time in Settings › Profile.

**Where your data lives**
On your Mac, in `~/Library/Application Support/anarlog/`. When you make a summary or use chat, the note text goes through the Upshot AI proxy (stores nothing) to OpenRouter. Audio never leaves your Mac. Pro stores only your email and Stripe customer ID. Full table in the README.

**How I built it**
Claude Code with B.L.A.S.T.: a blueprint first, a gate test before any change, one SOP per workstream, a codified design system, parallel Claude Code sessions and subagents, Granola as the benchmark for every flow, about 4,300 automated tests, and a red-team security pass. Details: `grandmaster/HOW-I-BUILT-THIS.md` in the repo.

**Credits**
Upshot is a fork of Anarlog by Fastrepl (MIT). It ships sqlite-sync unmodified (Elastic License 2.0). Fonts: Geist and Bricolage Grotesque (SIL Open Font License).

Repo: https://github.com/AdamWebsiteFormula/grandmaster-app
