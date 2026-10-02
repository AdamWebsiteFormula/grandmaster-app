# Blueprint — Upshot

Oct 2, 2026 · B.L.A.S.T. phase 1 (Blueprint) · No code until Adam approves this file.

Companion files: `grandmaster/features.md` (what we build), `CLAUDE.md` (how sessions behave), and the planner's "Granola Rebuild - Research and Build Plan" (the schedule and the session prompts).

## 1. The naked question

**Given** Anarlog `desktop_v1.4.28`, an MIT-licensed Tauri 2 meeting notepad that already records without a bot, transcribes locally, has a notepad plus Enhance, and lists models live, together with about 48 hours and Claude Code.

**Aim** for a branded macOS app that a judge installs from one file and, within two minutes, uses to turn a real call into better-than-Granola notes from a model released this month.

**Constraints:**
- No meeting bot.
- Local-first.
- Pinned to the tag; never merge upstream.
- No API key in the repo, the build or the bundle.
- The repo stays public and open source (the sqlite-sync ELv2 term requires it).
- Upstream credits are kept.
- Adam commits and pushes; Claude never does.
- Due Sun Oct 4, 10:00 AM ET, with a target of 9:00 AM.

## 2. Five discovery questions (Jack's Level 1)

| # | Question | Answer for this build |
|---|---|---|
| 1 | North star | A judge drags the app to Applications, clicks Open Anyway, records 30 seconds of a call, types two notes, hits Enhance, and gets notes that read like theirs, from a model that shipped this month. Then they ask Glaido about that meeting. |
| 2 | Integrations | <ul><li>Model providers: Anthropic, OpenAI, Gemini, OpenRouter, Ollama, LM Studio and Apple Intelligence.</li><li>Transcription: Apple Speech on macOS 26, Soniqo local as the fallback.</li><li>macOS mic plus a Core Audio system-audio tap.</li><li>Apple Calendar: local and read-only.</li><li>Glaido: through the bundled CLI's MCP server.</li><li>models.dev (OpenRouter as backup) for model metadata.</li></ul> |
| 3 | Source of truth | <ul><li>The app's local SQLite database (`crates/db-app`) for meetings, notes, transcripts and audio references.</li><li>The model registry (live lists, then catalog, then bundled fallback) for models.</li><li>`grandmaster/` for every decision.</li></ul> |
| 4 | Delivery payload | <ul><li>One Apple Silicon DMG: ad-hoc signed, notarized if a cleared Developer account is available.</li><li>A GitHub Release.</li><li>The Skool post with a 60-second Loom.</li><li>In the app, the payload is the enhanced note.</li></ul> |
| 5 | Behavioural rules | `CLAUDE.md` at the repo root, plus each session's prompt (owns, don't touch, done when) |

## 3. Pitch and the one twist

**Pitch:** Granola's simplicity, with proof you can check, every new model the day it ships, and it talks to Glaido.

**The one twist:** the model picker is never out of date. Granola's still says Fable 5 and Opus 4.8 after Opus 5.5 and Fable 5.1 shipped. Ours shows a model the day it lands, with a New badge.

## 4. Brand (Adam fills in)

| Field | Value | Rule |
|---|---|---|
| Name | `[ ]` | Not a cereal pun (Anarlog, Muesli and Oats already crowd that lane). Nothing that looks or sounds like "Granola". Do a quick GitHub, domain and USPTO search. |
| Bundle ID | `co.websiteformula.[app]` | A new ID also gives a fresh macOS permissions identity |
| Deep link | `[app]://` | One scheme only |
| Icon | 1024 px PNG, which becomes `.icns` | Simple silhouette that reads at 16 px |
| Accent | Orange #FF6A1F, from the app icon (Adam picked, Oct 2) | One accent only |
| Fonts | Geist, plus Geist Mono for numbers (Adam picked, Oct 2) | OFL fonts only |
| Voice | Plain, sentence case, no eyebrow labels | — |
| IP rules | No Granola name, logo, cream-and-olive palette, slab serif or look-alike layout. Credit Anarlog (MIT) and sqlite-sync (ELv2) in NOTICE and README. | — |

## 5. Keep, hide, remove (the first-principles delete pass)

The test: would a judge touch it in a two-minute test? If not, hide or remove it. Prefer **hide** (UI only) over **delete**, because hiding can't break the build. Add 10% back later only if something proves needed.

**Keep:**
- Recording (mic plus system audio), the live transcript, the Memos notepad, Enhance and templates.
- Meeting history and search, and chat across meetings.
- Audio retention and click-a-line playback, Apple Calendar (local) and export.
- The CLI with `mcp`, which powers the Glaido bridge.

**Keep, trimmed:**
- LLM providers, cut from 35 to the seven in section 2.
- Transcription choices: Apple Speech and Soniqo local; hide the cloud ones.
- Locales: English only (109 catalogs hold most of the brand strings).
- The AI settings screens, kept but simplified.

**Hide (UI only):**
- The sign-in step and account screens.
- Billing, trial and plan-gate prompts (force `isPro = true` in `useBillingAccess`).
- Cloud sync and team.
- Sharing (`session-sharing/`, `shared-notes/`).
- Google and Outlook calendar (Nango), automations and the cloud API, and chat web search.
- The "Anarlog" cloud providers and the alternate icon picker.
- Dictation: it's a different product, and it overlaps Glaido, which is the judge's own app.
- Contacts and reminders prompts during onboarding.

**Remove:**
- `enterprise/` (commercial license, not part of the desktop app).
- PostHog and Sentry telemetry.
- The updater (config, pubkey, the `plugins/updater2` check).
- 108 non-English locale catalogs.
- The "Welcome to Anarlog" demo note (replaced by our own Try-it note).
- Upstream's agent setup: root `AGENTS.md` content, `.claude/skills/`, `.claude/settings.json`, `.mcp.json`.

**Leave in place (not shipped, but other workspaces may reference them):**
- `apps/web`, `apps/api`, `apps/stripe`, `apps/mobile`, `apps/watch` and `supabase/`.
- `docs/`: Anarlog's Mintlify site. Excluded from the rebrand check.

**Never touch:**
- Audio capture and the transcription engines.
- `crates/cloudsync` and its `cloudsync.dylib`. Ship the binary unmodified and never point sync at a server.
- LICENSE files.
- Internal `@anlg/*` and `anlg-*` package names.

**Rebrand check definition:** "user-visible" means what ships. `scripts/rebrand-check.sh` greps the built frontend assets, `Info.plist`, `tauri.conf.[brand].json`, the English locale and `apps/desktop/src` for `anarlog|hyprnote|fastrepl|char.com` and must return 0. LICENSE, NOTICE and credits are excluded.

## 6. Data shapes (build against these; extend Anarlog's existing types in `settings/ai/shared/` rather than replacing them)

```ts
type Provider = "anthropic" | "openai" | "google" | "openrouter" | "ollama" | "lmstudio" | "apple";

interface ModelEntry {
  provider: Provider;
  id: string;                 // API id, e.g. "claude-opus-5-5"
  displayName: string;        // "Claude Opus 5.5"
  family: string;             // "claude-opus": used to collapse dated snapshots
  releasedAt?: string;        // ISO date from the provider (created_at) or the catalog
  firstSeenAt: string;        // when this app first saw the id
  contextWindow?: number;
  priceInPerMTok?: number;    // USD, from the catalog
  priceOutPerMTok?: number;
  thinking: boolean;
  preview: boolean;           // hidden unless "Show previews" is on
  deprecated: boolean;        // OpenAI shutdown_date, OpenRouter expiration_date, Groq active, models.dev status
  source: "live" | "catalog" | "fallback";
}

interface ModelRegistry {
  fetchedAt: string;          // drives the "Updated 2 h ago" label and the 24 h refresh
  entries: ModelEntry[];
  catalogSource: "models.dev" | "openrouter" | "bundled";
  fallbackVersion: string;    // date the bundled models.fallback.json was written
}

interface ProviderConfig {
  provider: Provider;
  enabled: boolean;
  keyRef?: string;            // Keychain or app-settings reference, never the key itself
  baseUrl?: string;           // Ollama, LM Studio, or the demo proxy
}

interface HomeStats {          // computed locally, nothing leaves the Mac
  timeSavedMin: number;       // words in enhanced notes and drafts / 40 wpm
  talkSharePct: number;       // mic speech time / (mic + system speech time), last 7 days
  speakingWpm: number;        // mic-channel words / mic speech minutes
  wrapUpStreakDays: number;   // consecutive workdays where every transcribed meeting was enhanced; weekends and no-meeting days never break it
  aiCostMonthUsd: number;     // tokens x catalog price; estimate chars/4 if Anarlog doesn't record usage, shown with "≈"
}
```

**Registry rules:**
- Sort newest first.
- Show one row per family, with the rest under "More models".
- Badge a model **New** when it was released within the last 30 days.
- Refresh at launch when the cache is older than 24 h, and on the Refresh button.
- On failure, fall back to the cache, then to the bundled `models.fallback.json`, labelled "Offline list".
- If a saved model disappears, switch to the newest in its family and show a toast.

## 7. Link: the gate test (must be green by about 10 PM Fri, or switch to Meetily)

- [ ] (a) The dev build launches.
- [ ] (b) 30 s of system audio plus mic records with Apple Speech, and both You and Them appear.
- [ ] (c) A typed memo is enhanced with Adam's key.
- [ ] (d) The ad-hoc signed DMG, downloaded through Safari in a second macOS user, opens through Open Anyway and passes (b) and (c).

## 8. Open questions (tonight's mapping pass answers these in `grandmaster/sops/features.md`)

- [ ] Is audio kept by default, and does clicking a transcript line play it? The code says yes: `audio_retention` defaults to "forever" and `audio-player/` exists. Confirm in the running app.
- [ ] Is the transcript editable?
- [ ] Are mic and system audio separate channels end to end (needed for talk share)?
- [ ] Does `anarlog mcp` (the CLI) find the desktop app's database by default?
- [ ] What exactly does `isPro = true` unlock? Is "template auto-format" auto-applied templates (stretch S1)?
- [ ] Does Enhance record token usage (needed for exact cost)?
- [ ] Does `cloudsync.dylib` load with sync off?
- [ ] Does the onboarding permission check catch a denied system-audio tap, or does it record silence?

## 9. Definition of done (submission)

- [ ] The DMG installs in a clean second user, records, enhances, and the picker shows this week's models.
- [ ] `rebrand-check` = 0, gitleaks is clean, and no open critical or high review findings remain.
- [ ] The Glaido bridge imports and answers a question, or is shown in the Loom and shipped behind a Beta toggle.
- [ ] README: a 3-step open note, requirements (Apple Silicon, macOS 15+), a privacy line, and credits. `grandmaster/HOW-I-BUILT-THIS.md` maps each course method to a file.
- [ ] Loom (60 s), Skool post, GitHub Release link. Submitted by 9:00 AM Sun.

## 10. Decisions log

| Date | Decision | Why |
|---|---|---|
| Oct 2 | Fork Anarlog `desktop_v1.4.28` behind a 4-hour build gate; Meetily is the fallback | Notepad, Enhance, live model lists and a token-based theme already exist; that saves about a day |
| Oct 2 | Apple Silicon and macOS only; no Windows | No way to test capture on Windows in 48 h; macOS 27 dropped Intel |
| Oct 2 | Ad-hoc signing is the baseline. Notarize only if a Developer account is cleared for this app in time | Notarization is a bonus, never a dependency |
| Oct 2 | Planning docs live in `grandmaster/`, not `docs/` | `docs/` is Anarlog's Mintlify site with its own AGENTS.md |
| Oct 2 | Staged sessions: one tonight, one for the rebrand, then at most three in parallel | The rebrand touches everything; three is the usage and attention ceiling |
| Oct 2 | Feature scope is `grandmaster/features.md`; cut line at 2 PM Sat; freeze at 5 PM Sat | Adam's Granola-weaknesses and Glaido research |
| Oct 2 | Judges get summaries via Apple Intelligence first, then a capped-key Worker proxy; never an embedded key | Anything in an open-source repo or binary is public |
| Oct 2 | Pitch: "Granola's simplicity, with proof you can check, every new model the day it ships, and it talks to Glaido." | Trust gaps are the ones Granola says it won't close |
| | Name: `[ ]` | |
| | Developer account for notarization: `[ ] cleared / ad-hoc only` | |
