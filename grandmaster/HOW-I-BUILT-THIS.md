# How I built Upshot

Upshot is a bot-free AI meeting notepad for Apple Silicon Macs. I built it in 3 days with Claude Code, starting from the open-source Anarlog app (MIT) instead of from zero. The goal: beat Granola for one person on a Mac.

## The stack, in plain words

| Layer | What | Why |
|---|---|---|
| App shell | Tauri 2 (Rust) | A real Mac app, small and fast, with a web UI inside |
| Interface | React 19, Tailwind 4, Bricolage Grotesque titles and Geist text | Fast to restyle; one design system |
| Data | Local SQLite on your Mac | No server to run, nothing to leak |
| Transcription | Apple Speech (macOS 26+) or Parakeet, on device | Private, free, no key |
| Summaries and chat | Upshot AI: a Cloudflare Worker in front of OpenRouter | Works out of the box on Auto (Claude Sonnet 5.5 at medium effort), no key and no account; Pro picks this week's models from Anthropic, OpenAI and Google, like Granola |
| Pro accounts and billing | Supabase Auth (email and password) and Stripe Checkout in the sandbox, both behind the same Worker | Real Pro you can test with card 4242 4242 4242 4242; no keys in the app |
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

- **First-principles delete pass.** If a judge would not touch it in a two-minute test, it was hidden (UI only, so nothing breaks): the upstream cloud account and billing, cloud sync, teams, dictation, bring-your-own-key AI settings. See blueprint section 5. Pro came back later as Upshot's own small account and Stripe flow.
- **Granola as the benchmark.** Every flow was checked against Granola's own help pages and screenshots, then improved: zero-setup transcription, ⌘N records, a live "can't hear the other side" warning, audio you can replay (Granola keeps none), Home, Chat, the note page and Settings laid out the way Granola does them.
- **Parallel Claude Code sessions.** One session built and shipped, one owned the design, and subagents built features F1 to F6 in separate files at the same time.
- **Research before building.** Each change names its source (Granola docs, Apple guidance, Nielsen Norman Group, ChatGPT's model picker). See `grandmaster/sops/night-log.md`.
- **Audits, then fixes.** A five-area UX audit, a WCAG 2.2 contrast audit in light and dark, three user journeys (first run, meeting, after the meeting) and two design redlines, each row fixed with its source named. See `grandmaster/sops/ux-audit-oct3.md`, `contrast-audit.md` and `journey-*.md`.
- **Tests on every change.** About 4,700 automated tests run on each change, plus the Worker's own tests; the final run had 0 failures.
- **Red-team pass.** A security review of secrets, local servers, prompt injection, the MCP tools, dependencies and logging, plus secret scanners. See `grandmaster/sops/red-team.md`.

## What I added on top of Anarlog

| Feature | What it does |
|---|---|
| Upshot AI | Summaries and chat with no key and no account, on Claude Sonnet 5.5 |
| Pro | "Auto ⌄" in the chat box, like Granola; Pro picks this week's models, rebuilt from OpenRouter at launch, bundled fallback offline. $11 a month billed yearly or $14 monthly, Stripe sandbox, account deletion in Settings › Profile |
| Capture health | Recording timer, You and Them sound meters, and a live warning when there's no sound from the other side |
| Transcript you can hear | Speaker bubbles with times; click any word to hear it; audio stays on the Mac |
| Note page | Editable title, template and folder chips, Generate summary from typed notes, Resume after Stop, Share menu, export to PDF, text or Markdown |
| Chat | Home composer, Chat page with recents and recipes, Say more and Turn into an email, Draft follow-up email |
| Calendar | Apple Calendar with Coming up on Home, reminders, a "Take notes" prompt when a call starts, optional auto-start; Google and Outlook through macOS Internet Accounts |
| Organize | Folders with their notes, 9 built-in templates, ⌘K search inside notes, locked notes kept out of chat, MCP, webhooks and export |
| Glaido bridge | One folder connects Glaido to your meetings |
| Granola import | Bring your Granola meetings over through Granola's MCP, no Upshot account |
| Design | Black and orange, Light, Dark or Match my Mac, Settings in 8 pages |
| Safety | Chat changes wait for your Apply; AI output can't load remote images |

## Credits

Upshot is a fork of [Anarlog](https://github.com/fastrepl/anarlog) by Fastrepl, Inc. (MIT). It ships [sqlite-sync](https://github.com/sqliteai/sqlite-sync) unmodified (Elastic License 2.0). See the [README](../README.md).
