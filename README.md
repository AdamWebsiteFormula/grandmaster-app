<div align="center">

<img width="320" src="apps/desktop/public/assets/upshot-lockup-on-light.png" alt="Upshot" />

<p>
  <b>The bot-free AI meeting notepad for Apple Silicon Macs.</b>
  <br />
  Record, transcribe, and turn your meeting into clear notes. Pick any current AI model.
</p>

</div>

## What it does

- Records your mic and your call audio. No bot joins your meeting.
- Transcribes on your Mac with Apple Speech or Parakeet. No key, no account.
- Enhances your notes with the AI provider you choose. Paste your own API key.
- Shows this week's models in the model picker. A bundled list is the fallback.

## Install

Requirements: a Mac with Apple Silicon and macOS 15 or later. Apple Speech and Apple Intelligence need macOS 26.

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

Everything stays on your Mac unless you choose an AI provider and press Enhance or use chat.

| What | Where |
|---|---|
| Notes, transcripts, summaries, settings | Local SQLite database in `~/Library/Application Support/anarlog/` (the folder keeps the upstream name on purpose; do not rename it) |
| Meeting audio | The same folder, one `audio.mp3` per meeting. Kept until you change the retention setting (Settings › Meetings) |
| AI provider keys | The macOS Keychain. Never in the repo, the build or the app bundle |
| Transcription | On your Mac: Apple Speech (macOS 26+) or Parakeet. Apple Speech language files come from Apple |
| Model list | Public catalogs (models.dev, OpenRouter), cached locally. No user data is sent |
| Glaido connection (optional) | `~/Library/Application Support/Upshot/glaido/mcp.json`, pointing at the CLI inside the app |

**What leaves your Mac:** only when you press Enhance or use chat, the notes and transcript go to the AI provider you picked, under your own key. No account, no telemetry, no cloud sync, no auto-updater.

**Delete your data:** delete a note in the app, or quit the app and delete the folder above.

## Credits and licenses

Upshot is a fork of [Anarlog](https://github.com/fastrepl/anarlog) (desktop v1.4.28), by Fastrepl, Inc. Anarlog is MIT licensed. See [LICENSE](LICENSE).

The sync library in `crates/cloudsync` is [sqlite-sync](https://github.com/sqliteai/sqlite-sync), licensed under the Elastic License 2.0 (ELv2). It ships unmodified. See [LICENSE.enterprise](LICENSE.enterprise) and [NOTICE](NOTICE).
