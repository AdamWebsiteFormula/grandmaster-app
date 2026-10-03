<div align="center">

<img width="320" src="apps/desktop/public/assets/upshot-lockup-on-light.png" alt="Upshot" />

<p>
  <b>The bot-free AI meeting notepad for Apple Silicon Macs.</b>
  <br />
  Record, transcribe, and turn your meeting into clear notes with Upshot AI, out of the box.
</p>

</div>

## What it does

- Records your mic and your call audio. No bot joins your meeting.
- Transcribes on your Mac with Apple Speech or Parakeet. No key, no account.
- Enhances your notes and answers chat with Upshot AI right after install: no key, no account. Upshot AI runs on Auto, the current Claude model (Claude Sonnet 5.5 today).
- Pro picks this week's models from Anthropic, OpenAI and Google in the chat box ("Auto ⌄"), the way Granola does. The list is rebuilt from OpenRouter's catalog at launch, with a bundled fallback.
- Warns you live when it can't hear the other side, with You and Them sound meters.
- Keeps your audio on your Mac. Click any word in the transcript to hear it.
- Imports your Granola meetings through Granola's official MCP connection (you sign in to Granola; no Upshot account needed).
- Answers questions about your meetings inside Glaido and other AI tools (built-in MCP server).

## Pro

Everything above is free, with no account. Pro adds one thing: pick the chat model (this week's models from Anthropic, OpenAI and Google) instead of Auto.

- Price: $14 a month, or $132 a year (save 21%). Settings › Plan › Upgrade to Pro.
- Payments run in the Stripe sandbox for the contest: use card 4242 4242 4242 4242, any future date, any CVC. No real money is charged.
- Accounts are email and password in Supabase Auth. Checkout and "Manage subscription" are Stripe Checkout and the Stripe customer portal, in your browser.
- Keys stay on the server. The app talks only to the Upshot AI Worker, which holds the Stripe and Supabase keys as Cloudflare secrets and checks Pro on every picked-model request. Stripe webhooks (signature-checked) keep the plan current.

## Install

Requirements: a Mac with Apple Silicon and macOS 15 or later. Apple Speech needs macOS 26.

1. Open the DMG.
2. Drag Upshot to Applications.
3. Open Upshot. The app is not notarized yet, so macOS blocks it the first time. Open System Settings › Privacy & Security, scroll down, click **Open Anyway** next to Upshot, then confirm. macOS asks only once.
4. Allow microphone and system audio. Transcription sets itself up.

How it was built: [grandmaster/HOW-I-BUILT-THIS.md](grandmaster/HOW-I-BUILT-THIS.md). Security reports: [SECURITY.md](SECURITY.md).

## Build

```bash
pnpm install --frozen-lockfile
pnpm dev:desktop
```

Release DMG: `grandmaster/scripts/release.sh`.

## Where your data lives

Everything stays on your Mac until you press Enhance or use chat.

| What | Where |
|---|---|
| Notes, transcripts, summaries, settings | Local SQLite database in `~/Library/Application Support/anarlog/` (the folder keeps the upstream name on purpose; do not rename it) |
| Meeting audio | The same folder, one `audio.mp3` per meeting. Kept until you change the retention setting (Settings › Meetings) |
| AI keys | None on your Mac. The Upshot AI key lives only on the Cloudflare Worker. Never in the repo, the build or the app bundle |
| Pro account (optional) | Your sign-in session in the macOS Keychain. Your email, plan status and Stripe customer ID in Supabase. Card details only at Stripe |
| Transcription | On your Mac: Apple Speech (macOS 26+) or Parakeet. Apple Speech language files come from Apple |
| Model list | Public catalogs (models.dev, OpenRouter), cached locally. No user data is sent |
| Glaido connection (optional) | `~/Library/Application Support/Upshot/glaido/mcp.json`, pointing at the CLI inside the app |

**What leaves your Mac:** only when you press Enhance or use chat. By default, the note and transcript go through the Upshot AI proxy (a Cloudflare Worker that stores and logs nothing) to OpenRouter, which runs Claude Sonnet 5.5 on Auto (or the model a Pro user picked). No account, no telemetry, no cloud sync, no auto-updater.

**Delete your data:** delete a note in the app, or quit the app and delete the folder above.

## Import from Granola

1. In Upshot, open **Settings › Imports**. Granola is at the top of the list.
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
