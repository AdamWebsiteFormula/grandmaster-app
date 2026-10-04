# Upshot guide

Upshot is a meeting notepad for Mac, Windows and Linux. It records your calls without a bot and turns them into clear notes. It's free, with no account and no API key.

**Download:** https://github.com/AdamWebsiteFormula/grandmaster-app/releases/latest (always the newest build)

## Install (about 2 minutes)

| Your computer | File |
|---|---|
| Mac with Apple silicon (M1 or newer), macOS 15 or later | `Upshot_1.0.0_aarch64.dmg` |
| Mac with an Intel chip, macOS 15 or later | `Upshot_1.0.0_x64.dmg` |
| Windows 10 or 11, 64-bit | `Upshot_1.0.0_x64-setup.exe` |
| Linux, 64-bit (tested on Ubuntu 24.04) | `Upshot_1.0.0_amd64.AppImage` or `Upshot_1.0.0_amd64.deb` |

**Mac.** Open the DMG and drag Upshot to Applications, then open it. The first time, macOS blocks it because it isn't notarized yet. Go to System Settings › Privacy & Security, scroll down, and click **Open Anyway**. Allow the microphone and system audio when asked.

**Windows.** Open the installer. Windows says "Windows protected your PC" because the installer isn't signed yet. Click **More info**, then **Run anyway**. Open Upshot from the Start menu.

**Linux.** For the AppImage: `chmod +x Upshot_1.0.0_amd64.AppImage && ./Upshot_1.0.0_amd64.AppImage`. On Ubuntu or Debian: `sudo apt install ./Upshot_1.0.0_amd64.deb`.

## Your first meeting

1. Press ⌘N on a Mac, or Ctrl+N on Windows and Linux. Upshot starts recording both sides of the call.
2. Type notes if you like, or don't.
3. Click **Stop**. The summary writes itself. Talk for at least half a minute, or Upshot asks before it writes one.
4. Click **Transcript** at the bottom to see who said what. Click any word to hear that moment.

## What's different from Granola

- It keeps your audio, and you can edit the transcript.
- It runs on Linux too.
- It works with no account and no key. Transcription uses Deepgram Nova 3, and summaries use Claude Sonnet 5.5.
- It warns you during the call if it can't hear the other side.
- On a Mac, it reads all your calendars at once: Google, Outlook and iCloud.
- It can import your Granola meetings.

## Try Pro (no real money)

Go to Settings › Plan › **Upgrade to Pro**. Create an account and pay with the Stripe test card 4242 4242 4242 4242, any future date, any CVC. Then click **Auto ⌄** in a chat box to pick this week's models from Anthropic, OpenAI and Google. Pro is $11 a month billed yearly, or $14 monthly. You can delete the account any time in Settings › Profile.

## Where your data lives

Your notes, transcripts and recordings stay on your computer, in the `anarlog` folder (`~/Library/Application Support/anarlog/` on a Mac, `%APPDATA%\anarlog\` on Windows, `~/.local/share/anarlog/` on Linux). While you record, audio passes through Upshot's proxy to Deepgram for the transcript, and nothing is stored. Summaries and chat send the note text through Upshot's proxy to OpenRouter. Pro keeps only your email and your Stripe customer ID. The [README](README.md) has the full details.

## Credits

Upshot is a fork of [Anarlog](https://github.com/fastrepl/anarlog) by Fastrepl (MIT). It ships [sqlite-sync](https://github.com/sqliteai/sqlite-sync) unmodified (Elastic License 2.0). Fonts: Geist and Bricolage Grotesque (SIL Open Font License).
