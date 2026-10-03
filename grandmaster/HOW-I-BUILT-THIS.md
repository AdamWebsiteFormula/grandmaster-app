# How I built Upshot

Upshot is a bot-free AI meeting notepad for Apple Silicon Macs. I built it in 3 days with Claude Code, starting from the open-source Anarlog app (MIT) instead of from zero. The goal: beat Granola for one person on a Mac.

## The stack, in plain words

| Layer | What | Why |
|---|---|---|
| App shell | Tauri 2 (Rust) | A real Mac app, small and fast, with a web UI inside |
| Interface | React 19, Tailwind 4, Geist font | Fast to restyle; one design system |
| Data | Local SQLite on your Mac | No server to run, nothing to leak |
| Transcription | Apple Speech (macOS 26+) or Parakeet, on device | Private, free, no key |
| Summaries | Your own AI key: Anthropic, OpenAI, Gemini, OpenRouter, local models and more | You pick the model; the picker shows this week's models |
| AI tools access | Built-in MCP server (the bundled CLI) | Lets Glaido and other AI tools read your meetings |
| Distribution | Ad-hoc signed DMG (not notarized), built by `grandmaster/scripts/release.sh` | One file to install |

## The method: B.L.A.S.T.

| Step | What I did | Where it is |
|---|---|---|
| Blueprint | Scope, judging criteria, keep/hide/remove list, definition of done | `grandmaster/blueprint.md`, `grandmaster/features.md` |
| Link | A gate test before any change: the untouched fork must build, record both sides, enhance and install | `grandmaster/sops/gate-status.md` |
| Architect | One SOP per workstream, written by parallel read-only subagents | `grandmaster/sops/rebrand.md`, `design.md`, `models.md`, `features.md` |
| Stylize | A codified design system: black base, one orange accent, one 1.2 type scale, nothing touches the edges, sentence case | `grandmaster/design-system.md` |
| Trigger | A one-command release: build, sign inside out, DMG, checksum | `grandmaster/scripts/release.sh` |

## How the work was organized

- **First-principles delete pass.** If a judge would not touch it in a two-minute test, it was hidden (UI only, so nothing breaks): accounts, billing, cloud sync, teams, dictation. See blueprint section 5.
- **Granola as the benchmark.** Every flow was checked against Granola's own help pages and then improved: zero-setup transcription, one "New note" button that starts recording, live "can't hear the other side" warning (Granola has none), audio you can replay (Granola deletes it).
- **Parallel Claude Code sessions.** One session built and shipped, one owned the design, and subagents built features F1 to F6 in separate files at the same time.
- **Research before building.** Each change names its source (Granola docs, Apple guidance, Nielsen Norman Group, ChatGPT's model picker). See `grandmaster/sops/night-log.md`.
- **Tests on every change.** About 4,100 automated tests run on each change; the final run had 0 failures.
- **Red-team pass.** A security review of secrets, local servers, prompt injection, the MCP tools, dependencies and logging, plus secret scanners. See `grandmaster/sops/red-team.md`.

## What I added on top of Anarlog

| Feature | What it does |
|---|---|
| F1 Model picker | Newest models first, "New" badges, refresh at launch, works offline |
| F2 Capture health | You and Them sound meters and a warning when the other side is silent |
| F4 Glaido bridge | One click connects Glaido to your meetings |
| F5 Home cards | Time saved, talk share, wrap-up streak, AI cost |
| F6 Audio is safe | Shows where the audio is kept; click any word to hear it |
| Onboarding | No account; transcription sets itself up; Accessibility re-check with a restart button |
| Granola import | Bring your Granola meetings over without an account |
| Free to try | A free Gemini key from Google AI Studio (link built in) |
| Safety | Chat changes wait for your Apply; AI output can't load remote images |

## Credits

Upshot is a fork of [Anarlog](https://github.com/fastrepl/anarlog) by Fastrepl, Inc. (MIT). It ships [sqlite-sync](https://github.com/sqliteai/sqlite-sync) unmodified (Elastic License 2.0). See the [README](../README.md).
