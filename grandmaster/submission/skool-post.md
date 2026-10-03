# Skool post draft

Post in the category Jack names for submissions (check the pinned post first). Attach the DMG and the Loom.

**Check before you post (delete a line from the post if its check fails):**
- [ ] Granola import: Settings › Imports › Granola › Connect, and your meetings appear.
- [ ] Glaido: import the folder from Settings › Developers, ask one question, and get an answer.
- [ ] The model picker shows a "New" badge.
- [ ] Clicking a transcript word plays the audio.

---

**Upshot: Granola, rebuilt for one person on a Mac**

Upshot records any call without a bot and turns it into clear notes with the newest AI models. Your notes, transcripts and audio stay on your Mac.

**What's better than Granola**
- Keeps your audio. Click any word in the transcript to hear it.
- Warns you live when it can't hear the other side.
- AI summaries and chat with no key: Upshot AI (Claude Sonnet 5.5) works from the first meeting. Prefer your own model? Add any key, including models released this week.
- Imports your Granola meetings.
- Plugs into Glaido: ask about your meetings from anywhere.
- No account, no subscription, no telemetry.

**Install (2 minutes)**
1. Open the attached DMG and drag Upshot to Applications.
2. Open Upshot. macOS blocks it the first time because it isn't notarized yet: go to System Settings › Privacy & Security, scroll down, click **Open Anyway**.
3. Allow the microphone, system audio and Accessibility. Transcription sets itself up.
4. Click **New note** to record, then **Enhance**. No key needed. Your own AI key is optional, in Settings › Intelligence.

Needs a Mac with Apple Silicon and macOS 15 or later (macOS 26 for Apple Speech).

**Tech stack, in plain words**
Tauri 2 (a small Rust app shell with a web interface), React and Tailwind, a local SQLite database, on-device transcription (Apple Speech or Parakeet), Upshot AI by default (a Cloudflare Worker in front of OpenRouter), or bring your own AI key. A built-in MCP server lets AI tools like Glaido read your meetings.

**Where your data lives**
On your Mac, in `~/Library/Application Support/anarlog/`. Keys you add are in the macOS Keychain. Only when you press Enhance or use chat do your notes leave: through the Upshot AI proxy (nothing stored or logged) to OpenRouter, or straight to your own provider if you add a key. Full table in the README.

**How I built it**
Claude Code with B.L.A.S.T.: a blueprint first, a gate test before any change, one SOP per workstream, a codified design system, parallel Claude Code sessions and subagents, Granola as the benchmark for every flow, about 4,100 automated tests, and a red-team security pass. Details: `grandmaster/HOW-I-BUILT-THIS.md` in the repo.

**Credits**
Upshot is a fork of Anarlog by Fastrepl (MIT). It ships sqlite-sync unmodified (Elastic License 2.0).

Repo: https://github.com/AdamWebsiteFormula/grandmaster-app
