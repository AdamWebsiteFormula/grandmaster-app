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
- Transcribes on your Mac with Apple Speech.
- Enhances your notes with the AI provider you choose. Paste your own API key.
- Shows this week's models in the model picker. A bundled list is the fallback.

## Install

1. Open the DMG.
2. Drag Upshot to Applications.
3. Open Upshot and allow microphone and system audio.

## Build

```bash
pnpm install --frozen-lockfile
pnpm dev:desktop
```

Release DMG: `grandmaster/scripts/release.sh`.

## Data folder

Your notes stay in `~/Library/Application Support/anarlog/`. The folder keeps the upstream name on purpose. Do not rename it.

## Credits and licenses

Upshot is a fork of [Anarlog](https://github.com/fastrepl/anarlog) (desktop v1.4.28), by Fastrepl, Inc. Anarlog is MIT licensed. See [LICENSE](LICENSE).

The sync library in `crates/cloudsync` is [sqlite-sync](https://github.com/sqliteai/sqlite-sync), licensed under the Elastic License 2.0 (ELv2). It ships unmodified. See [LICENSE.enterprise](LICENSE.enterprise) and [NOTICE](NOTICE).
