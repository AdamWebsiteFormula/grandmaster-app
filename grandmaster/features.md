# Features — Upshot

Oct 2, 2026 · Final scope · Source: the build plan §8, Adam's "Granola UX and UI weaknesses" research and "Glaido Crossover Features" research.

## The pitch

Granola's simplicity, with proof you can check, every new model the day it ships, and it talks to Glaido.

## The simplicity guard (applies to every feature)

Granola scores 9.9 for ease of setup and 9.6 for ease of use on G2. A rival that wins on trust but loses on simplicity loses. So:

- **The core loop is sacred.** Record, type, Enhance. If a feature adds a step to that loop, cut it.
- **Trust features stay out of sight until needed.** The meters live inside the recorder. The audio promise is one sentence. The Glaido bridge is one button in Settings.
- **Glaido's restraint.** Three stat cards and one streak. No badges, levels or confetti.

## Free claims: already in Anarlog, verify instead of building

| Granola weakness (evidence) | What we already have | Verify |
|---|---|---|
| Deletes audio; no playback; transcript not editable. Granola marks both "not planned" (A, critical) | `audio_retention` setting, default "forever" (`services/audio-retention-policy.ts`); audio player with click-a-transcript-line seek (`audio-player/`, `transcript/renderer/transcript.tsx`) | Record, then click a line and hear it. Check whether the transcript can be edited. |
| Notes hard to move; encrypted cache broke Obsidian (A) | Local SQLite, export, CLI with an MCP server (`apps/cli/src/mcp.rs`) | Export one meeting |
| 30-day history wall; sign-in and calendar required; no Apple Calendar (B) | No history limit, a skippable login, local Apple Calendar | After the rebrand: no sign-in anywhere |
| Training on by default; public share links (A/B) | Local-first, no training; sharing is cloud-only and gets hidden | Rewrite `stt/meeting-disclosure.ts` as a consent helper |
| Stale model picker (Adam's daily complaint) | Live `/models` fetch from each provider | F1 below |

## Build list, in order, with hard time boxes

Lanes: **Features** owns `settings/ai/**`, `apps/desktop/src/[app]-features/`, `glaido-bridge/`, `proxy/`, `models.fallback.json`. **Design** owns `styles/`, `packages/ui`, onboarding, home, note and recording screens. Features builds with existing components and no styling; Design styles them after the merge.

### F1. Always-current model picker · Features · 2–3 h

**Story:** I open the picker and see this week's models at the top, labelled New, without updating the app.

**Behavior:**
- Replace the `isOldModel()` regex in `settings/ai/shared/list-common.ts` (around L209) with a release-date rule plus deprecation signals: OpenAI `shutdown_date`, OpenRouter `expiration_date`, Groq `active`, models.dev `status`.
- Newest first. One row per family (strip `-YYYYMMDD`); older versions go under "More models". Previews go behind a "Show previews" toggle.
- Badges: **New** (released ≤30 days ago) and **Thinking**. Show the price tier and context window in the row's detail.
- Refresh at launch when the cache is over 24 h old. Add a Refresh button and an "Updated 2 h ago" label.
- Metadata from the models.dev `api.json` (MIT); backup is OpenRouter `/api/v1/models?sort=newest`. Fall back to a bundled `models.fallback.json`, labelled "Offline list".
- If a saved model vanishes, switch to the newest in its family and show a toast.
- Providers trimmed to Anthropic, OpenAI, Gemini, OpenRouter, Ollama, LM Studio and Apple Intelligence.
- Calls go through Rust or `@tauri-apps/plugin-http`, never the webview, to avoid CORS and keep keys out of page code.

**Done when:**
- [ ] With live keys, Claude Sonnet 5.5 (Sep 28) and GPT-6.1 Sol (Sep 29) show as New.
- [ ] Offline, the fallback list shows.
- [ ] Unit tests cover the merge, sort, family collapse and fallback.

**Demo moment:** open the picker. "Granola's still says Fable 5. Mine shows models released this week."

### F2. Capture health · Features (levels) + Design (visuals) · 2 h

**Story:** I can see the app is hearing both sides, and it tells me loudly when it isn't.

**Behavior:**
- Emit RMS levels for the mic (You) and system audio (Them) as a Tauri event about 30 times a second. Check what the fork already exposes first.
- Show You and Them meters inside the recorder.
- If Them is silent for 10 s while recording, show a persistent banner: "Can't hear the other side. Check system audio permission." It includes a button that opens the right System Settings pane.
- Onboarding gets a 10-second test: play any audio, see both meters move, then continue. Plain-language fix text for each failure.

**Done when:**
- [ ] Denying system audio in a second user account shows the banner within 10 s instead of silently recording zeros.

**Why:** silent capture failure is Granola's second critical weakness, and the one a judge would actually hit.

### F3. Summaries without a key · Features (`proxy/`) · 1 h

**Story:** a judge with no API key still sees Enhance work.

**Behavior:**
- Default to Apple Intelligence where available (macOS 26 on an eligible Mac).
- Otherwise, a "Demo" provider points at a small Cloudflare Worker that holds Adam's capped key:
  - set with `wrangler secret put`, never in the repo;
  - one cheap model, a max-tokens cap, a per-IP rate limit, a daily spend cap and a kill date (Oct 31).
- A one-field "Paste an OpenRouter or Anthropic key" screen is always available.
- Ollama and LM Studio are listed but never suggested to judges.

**Done when:**
- [ ] A clean second user with no keys can Enhance a memo.
- [ ] gitleaks finds no key anywhere.

**Never:** a key embedded in the app or repo.

### F4. Glaido bridge · Features, built by a sub-agent in `glaido-bridge/` that starts alongside F1 · 3 h hard cap

**Story:** Jack holds his Glaido key in Slack, asks "What did we decide about pricing in my last meeting?", and the answer pastes at his cursor.

**Behavior:**
- Glaido imports any folder whose root `mcp.json` names a local stdio server. See `creating-glaido-mcp-servers/references/glaido-integration.md` in github.com/daveebbelaar/glaido-skills.
- The bundled CLI already serves MCP over stdio (`mcp` subcommand) with `list_meetings`, `get_meeting`, `get_meeting_transcript`, `export_meeting`, `list_folders`, `get_recurring_meeting_history` and proposal tools.
- A **Connect to Glaido** button in Settings writes `~/Library/Application Support/[App]/glaido/mcp.json`, pointing at the CLI's absolute path inside `/Applications/[App].app` with `"args": ["mcp"]`, plus `instructions`.
- `toolApproval` is `auto` for the read tools and `deny` for `propose_*` and `decline_*`.
- After writing, it shows two steps: "In Glaido: Commands → Custom tools → Import folder → choose this folder." Include a Reveal in Finder button.
- Validate with `scripts/validate_glaido_mcp.py` from glaido-skills before the demo.
- In dev, point at the CLI built from `apps/cli`. The Release session bundles it as an `externalBin` sidecar and ad-hoc signs it.

**Done when:**
- [ ] Validation passes, Glaido imports the folder, and a question about a test meeting is answered.

**If it misses the cap:** show it working from Adam's Mac in the Loom, and ship it behind a Beta toggle in Settings › General (Glaido's own pattern).

**Open question (mapping pass):** does the CLI find the desktop app's database by default, or does it need a path argument?

### F5. Home stat cards · Features (numbers) + Design (cards) · 2–3 h

**Story:** I open the app and see what it's done for me, the way Jack sees his Glaido Home.

**Behavior:** three cards, each with a big number and a plain-English line.

| Card | Number | Line |
|---|---|---|
| Time saved | Words in enhanced notes and drafts ÷ 40 wpm | Rotates as it grows: "That's a lunch break", "a workday", "a full week" |
| Talk share | % of meeting speech that was you, last 7 days, plus your wpm | "You talked 38% of this week's meetings" |
| Wrap-up streak | Consecutive workdays where every transcribed meeting was enhanced. Weekends and no-meeting days never break it | "Wrap up today's meeting to start a streak" |

- One quiet line under the cards: "AI cost this month ≈ $0.84 · Granola Business $14/mo". Use exact token usage if Enhance records it; otherwise estimate chars ÷ 4 at catalog prices and show "≈".
- Everything is computed locally from SQLite. Nothing leaves the Mac.
- Empty states use the same lines as calls to action, not zeros.

**Done when:**
- [ ] With 3 test meetings the cards show plausible numbers.
- [ ] With 0 meetings they show the empty states.

### F6. "Your audio is safe" · Features · 1 h

**Story:** I trust that a bad transcript can be checked and a failed one can be retried.

**Behavior:**
- One line in the note header: "Audio saved on this Mac · kept [retention setting]". It links to the retention setting.
- If transcription failed, keep the audio and show **Retry** on the note. Check whether upstream already does this before building.
- Click any transcript line to hear it (upstream). Make sure it's discoverable: a hover hint on the first line.

**Done when:**
- [ ] A recorded note shows the line.
- [ ] Clicking a line plays that moment.

## Stretch: only if Features is on schedule at 2:00 PM Saturday. Pick ONE.

- **S1. Style rules that apply themselves (Glaido Formatting) · 1–2 h.** Choose this if the now-unlocked "template auto-format" already matches templates to meetings.
  - Add a "Styled by: Client calls" label on each note, with one-click switching.
  - Built-in rule: External calls (any attendee outside your email domain).
- **S2. Model Duel · 3–5 h.** Two models' notes side by side for the same meeting, with cost and seconds under each. It fits Jack's model-vs-model videos.

## Cut, with reasons

| Cut | Why |
|---|---|
| Floating pill recorder | 3–4 h, NSPanel focus bugs, and it adds no new value over F2 |
| Action items to Things | Narrow audience; not a Granola weakness |
| Hotkey commands with tools (Glaido #6) | Days of work; Glaido already does it, and the bridge gives us the connection |
| Learning dictionary (Glaido #4) | Upstream has a dictionary; learning-from-edits is polish |
| Referral loop | Needs billing to mean anything |
| Speaker separation beyond You/Them | Weeks of work (Granola weakness #3 is structural) |
| Mobile, Windows, team, sharing | Out of scope for a 48 h desktop entry |

## Demo order (the Loom's middle 50 seconds)

1. Home cards.
2. Record a pre-cued clip with both meters moving, type two notes, Stop.
3. The Enhance reveal, then click a line to hear it.
4. The picker's New badges.
5. Switch to Slack and ask Glaido about the meeting.

## Freeze

Feature freeze: **5:00 PM Saturday.** After that, only bug fixes and the capped Design Loop on the in-meeting note screen.
