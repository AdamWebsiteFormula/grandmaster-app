<div align="center">

<img width="320" src="apps/desktop/public/assets/upshot-lockup-on-light.png" alt="Upshot" />

<p>
  <b>The bot-free AI meeting notepad for Mac, Windows and Linux.</b>
  <br />
  It records your calls without a bot joining, then writes the notes for you.
</p>

<p>
  <a href="https://github.com/AdamWebsiteFormula/grandmaster-app/releases/latest"><b>Download Upshot</b></a>
  &nbsp;·&nbsp;
  <a href="GUIDE.md">Guide</a>
  &nbsp;·&nbsp;
  <a href="ROADMAP.md">Roadmap</a>
  &nbsp;·&nbsp;
  <a href="grandmaster/HOW-I-BUILT-THIS.md">How I built it</a>
</p>

</div>

## Why Upshot over Granola

| | Upshot | Granola |
|---|---|---|
| Computers | Mac, Windows and Linux | Mac and Windows |
| Your audio | Kept on your computer. Click any word to hear that moment | Not kept |
| Transcript | You can edit it | Read only |
| Calendars on a Mac | Google, Outlook and iCloud at once | The account you sign in with |
| MCP, CLI and webhooks | Built in, local, on the free plan | Webhooks need a Business plan |
| Free plan history | All your notes, stored on your computer | Limited meeting history |

Comparisons come from Granola's public help center and pricing page, read on Oct 4, 2026.

Built in about three days with Claude Code, using the B.L.A.S.T. method: a blueprint first, a gate test before any change, one SOP per workstream and a codified design system. [How I built it](grandmaster/HOW-I-BUILT-THIS.md).

## What it does

- **Works out of the box.** Summaries and chat run on Upshot AI right after install: no key, no account. Auto uses Claude Sonnet 5.5 at medium effort, through a Cloudflare Worker in front of OpenRouter.
- **Records without a bot.** New note (⌘N on a Mac, Ctrl+N on Windows and Linux) records your mic and your call audio; Blank note (⇧⌘N or Ctrl+Shift+N) just opens a note. The recording bar shows a timer and You and Them sound meters, and warns you live when there is no sound from the other side. Stop, then Resume to keep going in the same note.
- **Transcribes out of the box** with Upshot transcription (Deepgram Nova 3 through the Upshot proxy), on every computer. No key, no account. On Apple Silicon Macs you can switch to on-device Apple Speech or Parakeet in Settings › Transcription.
- **Full transcript you can hear.** Speaker bubbles with timestamps. Click any word to hear that moment: your recording stays on your computer (Granola keeps no audio). Copy the transcript, or export notes, summary or transcript as PDF, text or Markdown.
- **Notes the way you want them.** 9 built-in templates (general meeting, 1:1, sales call, interview and more). Generate summary works from typed notes too, even when nothing was recorded.
- **Calendar (Mac).** Upshot reads the Google, Outlook and iCloud calendars on your Mac, several at once. Click **Add account** in Settings › Calendar to add one (it opens System Settings › Internet Accounts). Home shows what's coming up; you get meeting reminders and a "Take notes" prompt when a call starts. Auto-start is optional. Windows and Linux have no calendar in 1.0; Google and Outlook sign-in on every computer comes next.
- **Chat.** Ask from the Home composer, the Chat page (recents and recipes) or inside a note ("Say more", "Turn into an email"). **Draft follow-up email** sits in the note's bottom bar.
- **Find and organize.** Folders, ⌘K (Ctrl+K) search across note contents, and locked notes that stay private: never sent to chat, MCP or export until you unlock them.
- **Imports your Granola meetings** through Granola's official MCP connection (you sign in to Granola; no Upshot account needed).
- **Answers questions about your meetings inside Glaido** (Mac) and other AI tools (built-in MCP server).
- **Looks good everywhere.** Black and orange, Bricolage Grotesque titles with Geist text, Light, Dark or match your system (the default), and Settings in 8 pages.

## Pro

Everything above is free, with no account. Pro adds one thing: pick the chat model instead of Auto. Click **Auto ⌄** in the chat box and choose from this week's models from Anthropic, OpenAI and Google. The list is rebuilt from OpenRouter's catalog at launch, with a bundled fallback.

- Price: $11 a month billed $132 yearly, or $14 billed monthly. Settings › Plan › Upgrade to Pro.
- Payments run in the Stripe sandbox for the contest: use card 4242 4242 4242 4242, any future date, any CVC. No real money is charged.
- Accounts are email and password in Supabase Auth. Checkout and "Manage subscription" are Stripe Checkout and the Stripe customer portal, in your browser. Delete your account in Settings › Profile (this cancels the subscription and removes the account).
- Keys stay on the server. The app talks only to the Upshot AI Worker, which holds the OpenRouter, Stripe and Supabase keys as Cloudflare secrets and checks Pro on every picked-model request. Stripe webhooks (signature-checked) keep the plan current.

## Install

| Computer | File |
|---|---|
| Mac with Apple Silicon (M1 or newer), macOS 15 or later | `Upshot_1.0.0_aarch64.dmg` |
| Mac with Intel, macOS 15 or later | `Upshot_1.0.0_x64.dmg` |
| Windows 10 or 11, 64-bit | `Upshot_1.0.0_x64-setup.exe` |
| Linux, 64-bit (tested on Ubuntu 24.04) | `Upshot_1.0.0_amd64.AppImage` or `Upshot_1.0.0_amd64.deb` |

**Mac**

1. Open the DMG and drag Upshot to Applications.
2. Open Upshot. The app is not notarized yet, so macOS blocks it the first time. Open System Settings › Privacy & Security, scroll down, click **Open Anyway** next to Upshot, then confirm. macOS asks only once.
3. Allow the microphone and system audio. Calendar and Accessibility are optional (Accessibility adds meeting details).
4. Press ⌘N to record your first meeting. No key needed.

**Windows**

1. Open `Upshot_1.0.0_x64-setup.exe`. The installer is not code-signed yet, so Windows shows "Windows protected your PC". Click **More info**, then **Run anyway** (Microsoft Defender SmartScreen).
2. Finish the installer, then open Upshot from the Start menu.
3. Press Ctrl+N to record. If Windows asks for the microphone, click **Allow**.

**Linux**

- AppImage: make it executable, then run it: `chmod +x Upshot_1.0.0_amd64.AppImage && ./Upshot_1.0.0_amd64.AppImage` (docs.appimage.org).
- Ubuntu or Debian: `sudo apt install ./Upshot_1.0.0_amd64.deb`, then open Upshot from your apps.
- Press Ctrl+N to record.

Transcription and summaries work right after install on every computer: no key, no account.

How it was built: [grandmaster/HOW-I-BUILT-THIS.md](grandmaster/HOW-I-BUILT-THIS.md). Security reports: [SECURITY.md](SECURITY.md).

## Build

```bash
pnpm install --frozen-lockfile
pnpm dev:desktop
```

Mac DMGs: `grandmaster/scripts/release.sh` (Apple Silicon) and `grandmaster/scripts/release.sh x86_64` (Intel). Windows and Linux installers: the `upshot-release.yaml` GitHub Actions workflow.

## Where your data lives

Everything stays on your computer except what is listed under "What leaves your computer".

| What | Where |
|---|---|
| Notes, transcripts, summaries, settings | A local SQLite database in the `anarlog` folder (the folder keeps the upstream name on purpose; do not rename it): `~/Library/Application Support/anarlog/` on a Mac, `%APPDATA%\anarlog\` on Windows, `~/.local/share/anarlog/` on Linux |
| Meeting audio | The same folder, one `audio.mp3` per meeting. Kept until you change the retention setting (Settings › Meetings) |
| AI keys | None on your computer. The Upshot AI and Deepgram keys live only on the Cloudflare Worker. Never in the repo, the build or the app |
| Pro account (optional) | Your sign-in session in your system's credential store (on a Mac, the Keychain), and your last known plan cached in the app. Your email, plan status and Stripe customer ID in Supabase. Card details only at Stripe. Settings › Profile › Delete account removes the Stripe customer and the Supabase account |
| Transcription | Upshot transcription on every computer by default: Deepgram Nova 3 through the Upshot proxy. On Apple Silicon Macs you can pick on-device Apple Speech (macOS 26+) or Parakeet instead in Settings › Transcription; Apple Speech language files come from Apple |
| Model list | Public catalogs (models.dev, OpenRouter), cached locally. No user data is sent |
| Glaido connection (Mac, optional) | `~/Library/Application Support/Upshot/glaido/mcp.json`, pointing at the CLI inside the app |

**What leaves your computer:**

- When you make a summary or use chat: the note text and transcript go through the Upshot AI proxy (a Cloudflare Worker that stores nothing; logging is off) to OpenRouter, which runs Claude Sonnet 5.5 on Auto, or the model a Pro user picked. A locked note is never sent to chat, MCP tools or webhooks until you unlock it.
- While you record: audio streams through the Upshot proxy (the same Cloudflare Worker, which stores nothing) to Deepgram for transcription, with Deepgram's model improvement program opted out, so Deepgram keeps the audio "only for the duration necessary to process the request" (Deepgram docs). Granola also sends meeting audio to cloud transcription. On an Apple Silicon Mac, pick Apple Speech or Parakeet in Settings › Transcription to keep audio on the Mac.
- Only if you get Pro: your email and Stripe customer ID are stored in Supabase, and Stripe handles the payment.
- Only if you set one up: a webhook (Settings › Connectors › Webhooks) sends finished notes where you point it.
- Nothing else: no telemetry, no crash reports, no cloud sync, no auto-updater. Free needs no account.

**Delete your data:** delete a note in the app, or quit the app and delete the folder above.

**Privacy policy:** [upshot-ai.adam-694.workers.dev/privacy](https://upshot-ai.adam-694.workers.dev/privacy) (source: `grandmaster/worker/public/privacy.html`).

## Import from Granola

1. In Upshot, open **Settings › Connectors › Import notes**. Granola is at the top of the list.
2. Click **Connect** and sign in to your Granola account in the browser window that opens. This uses Granola's official MCP connection (docs.granola.ai/help-center/sharing/integrations/mcp).
3. Back in Upshot, click **Sync now**. Your Granola meetings appear in Notes on Home.

Other apps: Plaud imports through its CLI, and most other notetakers through their export files (**Choose files**).

## Support

- **Report a bug or suggest a feature:** email [adam@websiteformula.co](mailto:adam@websiteformula.co). Say what you did, what you expected and what happened, and add your operating system and the Upshot version (on a Mac: Upshot › About Upshot).
- **Keyboard shortcuts (Mac):** Help › Keyboard shortcuts, or press ⌘/.
- **Security problems:** follow [SECURITY.md](SECURITY.md); don't post them in an issue.

## Credits and licenses

Upshot is a fork of [Anarlog](https://github.com/fastrepl/anarlog) (desktop v1.4.28), by Fastrepl, Inc. Anarlog is MIT licensed. See [LICENSE](LICENSE).

Fonts: Geist and Geist Mono (Vercel) and Bricolage Grotesque, all under the SIL Open Font License 1.1 (license files in `apps/desktop/public/fonts/`).

The sync library in `crates/cloudsync` is [sqlite-sync](https://github.com/sqliteai/sqlite-sync), licensed under the Elastic License 2.0 (ELv2). It ships unmodified. See [LICENSE.enterprise](LICENSE.enterprise) and [NOTICE](NOTICE).
