<div align="center">

<img width="320" src="apps/desktop/public/assets/upshot-lockup-on-light.png" alt="Upshot" />

<p>
  <b>The bot-free AI meeting notepad for Apple Silicon Macs.</b>
  <br />
  Record, transcribe, and turn your meeting into clear notes with Upshot AI, out of the box.
</p>

</div>

## What it does

- **Works out of the box.** Summaries and chat run on Upshot AI right after install: no key, no account. Auto uses Claude Sonnet 5.5 at medium effort, through a Cloudflare Worker in front of OpenRouter.
- **Records without a bot.** New note (⌘N) records your mic and your call audio; Blank note (⇧⌘N) just opens a note. The recording bar shows a timer and You and Them sound meters, and warns you live when there is no sound from the other side. Stop, then Resume to keep going in the same note.
- **Transcribes on your Mac** with Apple Speech or Parakeet. No key, no account.
- **Full transcript you can hear.** Speaker bubbles with timestamps. Click any word to hear that moment: your audio stays on your Mac (Granola keeps no audio). Copy the transcript, or export notes, summary or transcript as PDF, text or Markdown.
- **Notes the way you want them.** 9 built-in templates (general meeting, 1:1, sales call, interview and more). Generate summary works from typed notes too, even when nothing was recorded.
- **Calendar.** Apple Calendar on your Mac. Google and Outlook calendars come in by adding the account to the Mac (the app's **Add an account** button opens System Settings › Internet Accounts). Home shows what's coming up; you get meeting reminders and a "Take notes" prompt when a call starts. Auto-start is optional.
- **Chat.** Ask from the Home composer, the Chat page (recents and recipes) or inside a note ("Say more", "Turn into an email"). **Draft follow-up email** sits in the note's bottom bar.
- **Find and organize.** Folders, ⌘K search across note contents, and locked notes that stay private: never sent to chat, MCP or export until you unlock them.
- **Imports your Granola meetings** through Granola's official MCP connection (you sign in to Granola; no Upshot account needed).
- **Answers questions about your meetings inside Glaido** and other AI tools (built-in MCP server).
- **Looks like a Mac app.** Black and orange, Bricolage Grotesque titles with Geist text, Light, Dark or Match my Mac (the default), and Settings in 8 pages.

## Pro

Everything above is free, with no account. Pro adds one thing: pick the chat model instead of Auto. Click **Auto ⌄** in the chat box and choose from this week's models from Anthropic, OpenAI and Google. The list is rebuilt from OpenRouter's catalog at launch, with a bundled fallback.

- Price: $11 a month billed $132 yearly, or $14 billed monthly. Settings › Plan › Upgrade to Pro.
- Payments run in the Stripe sandbox for the contest: use card 4242 4242 4242 4242, any future date, any CVC. No real money is charged.
- Accounts are email and password in Supabase Auth. Checkout and "Manage subscription" are Stripe Checkout and the Stripe customer portal, in your browser. Delete your account in Settings › Profile (this cancels the subscription and removes the account).
- Keys stay on the server. The app talks only to the Upshot AI Worker, which holds the OpenRouter, Stripe and Supabase keys as Cloudflare secrets and checks Pro on every picked-model request. Stripe webhooks (signature-checked) keep the plan current.

## Install

Requirements: a Mac with Apple Silicon and macOS 15 or later. Apple Speech needs macOS 26.

1. Open the DMG.
2. Drag Upshot to Applications.
3. Open Upshot. The app is not notarized yet, so macOS blocks it the first time. Open System Settings › Privacy & Security, scroll down, click **Open Anyway** next to Upshot, then confirm. macOS asks only once.
4. Allow the microphone and system audio. Calendar and Accessibility are optional (Accessibility adds meeting details). Transcription sets itself up.
5. Press ⌘N to record your first meeting. No key needed: Upshot AI works out of the box.

How it was built: [grandmaster/HOW-I-BUILT-THIS.md](grandmaster/HOW-I-BUILT-THIS.md). Security reports: [SECURITY.md](SECURITY.md).

## Build

```bash
pnpm install --frozen-lockfile
pnpm dev:desktop
```

Release DMG: `grandmaster/scripts/release.sh`.

## Where your data lives

Everything stays on your Mac until you make a summary or use chat.

| What | Where |
|---|---|
| Notes, transcripts, summaries, settings | Local SQLite database in `~/Library/Application Support/anarlog/` (the folder keeps the upstream name on purpose; do not rename it) |
| Meeting audio | The same folder, one `audio.mp3` per meeting. Kept until you change the retention setting (Settings › Meetings) |
| AI keys | None on your Mac. The Upshot AI key lives only on the Cloudflare Worker. Never in the repo, the build or the app bundle |
| Pro account (optional) | Your sign-in session in the macOS Keychain, and your last known plan cached in the app. Your email, plan status and Stripe customer ID in Supabase. Card details only at Stripe. Settings › Profile › Delete account removes the Stripe customer and the Supabase account |
| Transcription | On your Mac: Apple Speech (macOS 26+) or Parakeet. Apple Speech language files come from Apple |
| Model list | Public catalogs (models.dev, OpenRouter), cached locally. No user data is sent |
| Glaido connection (optional) | `~/Library/Application Support/Upshot/glaido/mcp.json`, pointing at the CLI inside the app |

**What leaves your Mac:**

- When you make a summary or use chat: the note text and transcript go through the Upshot AI proxy (a Cloudflare Worker that stores nothing; logging is off) to OpenRouter, which runs Claude Sonnet 5.5 on Auto, or the model a Pro user picked. Audio never leaves your Mac. A locked note is never sent to chat, MCP tools or webhooks until you unlock it.
- Only if you get Pro: your email and Stripe customer ID are stored in Supabase, and Stripe handles the payment.
- Only if you set one up: a webhook (Settings › Connectors › Webhooks) sends finished notes where you point it.
- Nothing else: no telemetry, no crash reports, no cloud sync, no auto-updater. Free needs no account.

**Delete your data:** delete a note in the app, or quit the app and delete the folder above.

## Import from Granola

1. In Upshot, open **Settings › Connectors › Import notes**. Granola is at the top of the list.
2. Click **Connect** and sign in to your Granola account in the browser window that opens. This uses Granola's official MCP connection (docs.granola.ai/help-center/sharing/integrations/mcp).
3. Back in Upshot, click **Sync now**. Your Granola meetings appear in Notes on Home.

Other apps: Plaud imports through its CLI, and most other notetakers through their export files (**Choose files**).

## Support

- **Report a bug or suggest a feature:** [open an issue](https://github.com/AdamWebsiteFormula/grandmaster-app/issues/new). Say what you did, what you expected and what happened, and add your macOS version and the Upshot version (Upshot › About Upshot).
- **Keyboard shortcuts:** Help › Keyboard shortcuts, or press ⌘/.
- **Security problems:** follow [SECURITY.md](SECURITY.md); don't post them in an issue.

## Credits and licenses

Upshot is a fork of [Anarlog](https://github.com/fastrepl/anarlog) (desktop v1.4.28), by Fastrepl, Inc. Anarlog is MIT licensed. See [LICENSE](LICENSE).

Fonts: Geist and Geist Mono (Vercel) and Bricolage Grotesque, all under the SIL Open Font License 1.1 (license files in `apps/desktop/public/fonts/`).

The sync library in `crates/cloudsync` is [sqlite-sync](https://github.com/sqliteai/sqlite-sync), licensed under the Elastic License 2.0 (ELv2). It ships unmodified. See [LICENSE.enterprise](LICENSE.enterprise) and [NOTICE](NOTICE).
