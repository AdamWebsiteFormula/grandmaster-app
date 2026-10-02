# Jack's course: what applies to Upshot

Source: four transcripts of Jack Roberts' Claude Code course, kept outside this repo (`~/code/grandmaster-private/course-transcripts/`). Summarized in our own words, Oct 2, 2026. Line numbers are approximate and point into those private files.

Short names used below:
- **BA** = Build Anything (chapter 7)
- **CM** = Compliance & Maintenance (chapter 9)
- **DS** = Design Systems (level 8)
- **L6** = Level 6, Apps

What Upshot is: a local-first Mac app (Tauri 2, Rust, React 19, Tailwind 4, pnpm). Local SQLite. Transcription on the Mac. You bring your own AI key. No backend, no Supabase in use, shipped as a DMG. The repo is public on GitHub.

## 1. Platforms and tools Jack names

| Tool | Where | What Jack uses it for | Upshot |
|---|---|---|---|
| Claude Code (Opus) | All four | Main builder; DS ~177 names Opus as the strongest model | **Uses.** Built the whole fork |
| Claude connectors / MCP | BA ~305, L6 ~150 | Plug services into Claude | **Uses** the other way round: Upshot ships an MCP server (CLI `mcp`) for Glaido |
| Claude subagents and session forks | L6 ~620, ~760 | Parallel research cohorts; a fork per side quest | **Uses** (parallel sessions, research agents, critics). Say so in the Loom |
| GitHub | BA ~405, DS ~455, L6 ~350 | Every project lives in a repo | **Uses.** Public repo |
| Vercel | BA ~403, DS ~456, L6 ~350 | Hosts websites and dashboards | **Not applicable.** No web app. Only fits if a key-free proxy (F3) is ever built |
| Supabase | BA ~652, L6 ~84 to ~470 | Default database, auth, triggers; Glaido and his site use it | **Not applicable.** Data stays on the Mac in SQLite. Jack's reason for Supabase ("a place to store the data") is met locally. Upstream `supabase/` folder is unused |
| Supabase CLI | L6 ~804 | Let Claude do the setup itself | Not applicable |
| Stripe (sandbox) | L6 ~609 to ~935 | Paid tier and checkout | **Not applicable.** Upshot is free and open source; billing is hidden |
| OpenRouter | CM ~196, L6 ~941 | AI calls with a hard credit cap per key; premium model first, then a cheaper one, plus rate limits | **Uses** as one provider and as the backup model catalog. Point users to OpenRouter's per-key credit limit |
| Anthropic spend limits | CM ~193 | Hard cap on variable cost | **Should mention.** Tell users to cap their own key |
| Resend | L6 ~960 | Welcome emails | Not applicable (no accounts, no email) |
| Beehiiv | L6 ~204 | Email list | Not applicable |
| Sign in with Google, magic link | L6 ~439, ~469 | Easy sign-in | Not applicable. Upshot has no sign-in, which is simpler. Say "no account needed" |
| Sentry | CM ~398 | Error monitoring | **Deliberately not used.** Telemetry stays off: `release.sh` clears the Sentry and PostHog keys. Explain this as a privacy choice |
| Vercel analytics, Supabase logs, Stripe dashboard | CM ~394 | Weekly health dashboards | Not applicable. Our version is the health-check list in section 4 |
| Gitleaks, Semgrep, Trivy | CM ~316 | Off-the-shelf scanners in pre-commit | **Should use.** Gitleaks and Semgrep are installed on this Mac. Trivy is not |
| Red-team prompt | CM ~233 to ~255 | Ask an AI to attack your own repo | **Should do** before submission |
| Apify, Apollo, AnyMailFinder | BA ~252 to ~515 | Lead scraping and email checks | Not applicable |
| n8n | BA ~626 | Fine-grained workflows | Not applicable |
| ChatGPT, Cursor, Antigravity | BA ~612, ~620 | Other AI tools and IDEs | Not applicable |
| Figma | BA ~642 | Stands in for design assets | Not applicable |
| Claude Design, Open Design | DS ~32 to ~210 | Design surface; Open Design is the open-source take | Optional. Not needed for an app restyle |
| Power Design repo (his 20 rules) | DS ~115 to ~135, ~596 to ~616 | Codified design rules | **Uses.** `design-system.md` already applies several rules (section 3 lists the gaps) |
| Design extractor skill (brand extraction) | DS ~254 to ~360 | Pull a reference site's design language into a blueprint | **Should use** on Glaido (Adam has the `design-language` skill) |
| Competitor research skill | DS ~468 | Top 10 competitors in a niche | Done by hand (Granola research). Mention it |
| Kie.ai, Higgsfield, Spline | DS ~227, ~402, ~686 | Images, video, 3D | Not needed. A Loom only |
| coolors.co | DS ~722 | Color pairings | Not needed. One accent, sampled from the icon |

Glaido comes up in DS (~643 to ~680). It is Jack's speech-to-text startup. He describes Glaido's "time saved, turned into life bought back" micro-goals. Upshot's Home "Time saved" card (coffee break, then lunch break, then workday) follows the same idea. Point to it in the Loom.

## 2. His method, and how Upshot maps to it

| Jack's method | Where | Upshot | Gap |
|---|---|---|---|
| Imagine it, then build it with AI | BA early, L6 ~31 | Pitch and twist in `blueprint.md` §3 | None |
| First principles: only physics is a fixed limit; everything else is a convention | BA ~39 to ~122 | The fork decision: about a day saved by reusing what Anarlog already has | None |
| 5-step order: question every requirement (each needs a person's name), delete (if you add back under 10%, you didn't delete enough), simplify, speed up, then automate | BA ~151 to ~181 | `blueprint.md` §5 is the delete pass, including the 10% rule | Requirements in `features.md` don't name an owner (Adam, the judge, or "Granola gap"). Small fix: tag each one |
| Strip the problem until it's boring, then code | BA ~184 | `blueprint.md` §1, "The naked question" | None |
| Prompt pattern: say the goal and the outcome, have Claude ask clarifying questions, find the bottleneck | BA ~673 to ~684 | Used in sessions; `questions-for-adam.md` | None |
| B.L.A.S.T. framework | L6 ~6 names it. The steps are taught elsewhere (Level 1) | CLAUDE.md Process; `blueprint.md` is phase 1 | Missing: a one-page map from each B.L.A.S.T. step to a file. It belongs in `HOW-I-BUILT-THIS.md` |
| LLMs are probabilistic; keep the parts that must be exact deterministic | L6 ~34 to ~43 | Home stats are SQL, not AI. The model registry is code with a bundled fallback | None. Good talking point |
| Never put a secret key in the front end; route through a backend | L6 ~286 to ~296 | Keys stay out of the repo, build and bundle. The user's key goes to the app's secret store (macOS Keychain via `store2`; the saved settings row keeps an empty key) | Confirm the Keychain path in the release build once |
| Let Claude do it (CLIs) instead of doing it by hand | L6 ~804 to ~849 | Night log: autonomous runs | None |
| Iterate on screenshots with exact feedback | L6 ~534 to ~547, ~863 to ~870 | Design session, critics | None |
| Parallel subagents, then critically merge their output | L6 ~760 to ~777 | Critics and research agents | None |
| Test in sandbox mode first | L6 ~671 to ~678 | Gate test (a) to (d); second macOS user | The second-user DMG test is still open |

## 3. Design rules: Jack vs `design-system.md`

Already covered: design as code, codified rules, a 3-second glance test, nothing touching the edges, one accent, sentence case, a reference app (Glaido, black).

Gaps:
1. **Size ratio.** Jack wants paired text sizes (headline next to body) about 1.6x apart, which he calls the golden ratio (DS ~596 to ~611). We use one 1.2 ratio, which is right for a dense app. Add a line: a headline paired with its body sits three steps apart (1.2³ = 1.73, close to his 1.6), for example a `text-2xl` stat number over a `text-sm` label. That keeps one ratio and matches his rule.
2. **Equal spacing.** The gap from a heading to its rule should equal the gap from the rule to the next text (DS ~605). It's not written down. Add it as a rule.
3. **No widows.** Never let a heading end with one word alone on its last line (L6 ~868). Add `text-wrap: balance` for headings and `pretty` for short copy to the rules and to `globals.css`.
4. **Few words per screen.** His reference sites use about 10 words per page (DS ~577). Add "empty states and Home: at most about 10 words above the fold" to the glance test.
5. **Brand extraction is the method** (DS ~488, ~572). Our "like Glaido" direction came from Adam's notes, not from an extraction. Run the `design-language` skill on Glaido's site. Record the matching tokens (black base, one accent, type) in `design-system.md` as the source.
6. **Value proposition in one sentence**, shown in the product (DS ~324). Use the pitch line on the first onboarding screen and in the README hero. The README hero already comes close.
7. **Delight details** (L6 ~399, ~574, ~889). Jack likes small touches such as confetti and a loading animation. One quiet one fits our rules, for example a short accent pulse when Enhance finishes. Optional.
8. **Logo quality** (DS ~588). Jack pays close attention to logos. Check the icon at 16 px and the DMG background art (redraw at 660×430).

## 4. Compliance and maintenance for a desktop app

His 12 rules (CM ~81 to ~210), applied to Upshot:

| Rule | Applies? | Status / action |
|---|---|---|
| 1. Don't paste live keys into chat; set them by a terminal command | Yes | Adam enters keys in the app or terminal, never in Claude chat. F3 option B already has Adam set the secret himself |
| 2. Never commit `.env` | Yes | Run gitleaks on the full git history before posting |
| 3. Treat the service key like a nuclear key | No | No Supabase |
| 4. Row-level security on every public table | No | No server database |
| 5. Keep dev, preview and production apart | Yes, adapted | The dev build uses the `com.hyprnote.dev` ID and folder; the release build uses `anarlog/`. Questions-for-Adam #4 (own bundle ID) is the matching fix |
| 6. 2FA everywhere | Yes | GitHub (both accounts), Anthropic, OpenRouter, Apple ID |
| 7. Pin and audit dependencies | Yes | Lockfile is pinned and installs are frozen. Run `pnpm audit` and `cargo audit` as a report only (no upgrades, per CLAUDE.md) |
| 8. Vet every MCP server | Yes, in reverse | Upshot ships one. The read tools auto-approve; the write tools (`propose_*`) are denied. Say that in the README |
| 9. Sandbox LLM calls that touch user input; tool output is untrusted | Yes | Transcripts are untrusted input to Enhance and chat (someone in a meeting could say "ignore your instructions"). Chat tools are local and read-only, and chat web search is hidden. Confirm that in the red-team pass |
| 10. Cap spend before anything else | Yes | Users bring their own key; tell them to set a cap. If F3 is ever built, it needs a hard cap plus rate limits |
| 11. Know where data lives before anyone asks | Yes | Write the data map (below) into the README |
| 12. Verify webhook signatures | Maybe | The Developers page keeps local webhooks. If they send meeting data out, note that the user owns the endpoint |

Other practices from CM:
- **Red-team yourself** (CM ~233 to ~266, ~548 to ~554). Run a red-team review over secrets, the MCP server, prompt injection, dependencies and logs. Use the `security-review` skill plus gitleaks and Semgrep. Fix anything critical or high (this is already in the blueprint's definition of done).
- **Off-the-shelf scanners in pre-commit** (CM ~277). Nice to have. A short gitleaks pre-commit hook is enough.
- **GDPR basics** (CM ~338 to ~393): a data processing agreement (DPA), a list of subprocessors, and the right to erasure. For a local app: the only subprocessor is the AI provider the user picks. Erasure means "delete the note, or delete the data folder." State it. Don't claim GDPR or HIPAA compliance. Jack adds those badges to a website (L6 ~410), but an unverified claim is a risk.
- **Health checks** (CM ~420 to ~454). Write down what a working journey looks like and re-test it. Ours: install from the DMG → allow permissions → record 30 s → You and Them both appear → Enhance → the picker shows this week's models. That is the second-user DMG test. Re-run it on each release.
- **Incident response** (CM ~455 to ~535): rotate keys, keys with expiry dates, prepaid cards with low limits, fast and honest disclosure. For Upshot: replace `SECURITY.md`, which still sends reports to Fastrepl's advisories page. Turn on GitHub private vulnerability reporting for the repo.
- **Abuse limits** (CM ~55 to ~76): drop to a cheaper model after heavy use, then a hard stop. This only matters for F3.

**Where Upshot data lives** (for the README, Loom and questions):

| Data | Location |
|---|---|
| Meetings, notes, transcripts | SQLite `app.db` in `~/Library/Application Support/anarlog/` (dev build: `com.hyprnote.dev/`) |
| Audio | `sessions/` in the same folder, kept per the retention setting |
| On-device speech models | `models/` in the same folder (Apple Speech uses the system's own) |
| Settings | `store.json` in the same folder |
| AI keys | macOS Keychain through the app's secret store, never in the repo or bundle |
| Model catalog cache | App local storage. Fetched from models.dev or OpenRouter; no user data is sent |
| Glaido bridge config | `~/Library/Application Support/Upshot/glaido/mcp.json` |
| What leaves the Mac | Only when you press Enhance or chat: the transcript and notes go to the AI provider you picked, under your own key. No telemetry, no account, no cloud sync |

## 5. What Jack will want to see

Judging criteria (`rules.md`): effectiveness, looks, creativity, simplicity, value.

**Loom (60 s)**
- [ ] One-sentence value proposition in the first 5 seconds.
- [ ] Live: record → You and Them meters → Enhance → notes from a model that shipped this week (New badge).
- [ ] The black UI, with one accent and nothing touching the edges.
- [ ] Glaido asking about the meeting (his company).
- [ ] Home "Time saved" card (his Glaido "life bought back" idea).
- [ ] One line: "Your notes stay on your Mac."

**Skool post**
- [ ] DMG attached, plus install steps, including Open Anyway.
- [ ] Tech stack in plain words: Tauri (a Rust shell with a web UI), React, Tailwind, local SQLite, on-device transcription, bring your own key.
- [ ] Where data lives: one sentence plus a link to the README table.
- [ ] How it was built: Claude Code; B.L.A.S.T.; the first-principles delete pass; one SOP per workstream; a codified design system (Power Design rules); critics and parallel subagents; a red-team pass.
- [ ] Credit Anarlog (MIT) and sqlite-sync (ELv2) openly.
- [ ] Repo link and GitHub Release link.

**README**
- [ ] Hero line (exists), Install (exists), Build (exists), Credits (exists).
- [ ] "Where your data lives" table (section 4).
- [ ] Privacy: no telemetry, no account, what is sent and when, how to delete everything.
- [ ] Security: how to report a problem; the MCP server is read-only by default.
- [ ] Requirements: Apple Silicon; macOS 15 or later (macOS 26 for Apple Speech and Apple Intelligence).
- [ ] Link to `grandmaster/HOW-I-BUILT-THIS.md`.

## 6. Action list

| # | Action | Tag | Effort |
|---|---|---|---|
| 1 | Add a "Where your data lives" and "Privacy" section to the README, from section 4 | Must before Sunday 9 AM ET | 30 min |
| 2 | Write `grandmaster/HOW-I-BUILT-THIS.md`: stack, B.L.A.S.T. step → file, delete pass, SOPs, design rules, critics, security pass (already in the definition of done) | Must before Sunday 9 AM ET | 45 min |
| 3 | Red-team pass: gitleaks over the full history, Semgrep, then a review against Jack's attack list (secrets, MCP server, prompt injection, dependencies, logs). Fix critical and high findings | Must before Sunday 9 AM ET | 1 to 1.5 h |
| 4 | Replace `SECURITY.md` (still points to Fastrepl) with Upshot's. Turn on private vulnerability reporting in the GitHub repo settings | Must before Sunday 9 AM ET | 15 min |
| 5 | Script and record the Loom; write the Skool post from section 5 | Must before Sunday 9 AM ET | 1 h |
| 6 | Second-user DMG test, kept as the written health-check list | Must before Sunday 9 AM ET | 30 min |
| 7 | Account hygiene (Adam): 2FA on GitHub, Anthropic and OpenRouter; a spend cap on the demo key; keys never pasted in chat | Must before Sunday 9 AM ET | 10 min |
| 8 | Design-system additions: three-step headline pairs (≈ golden ratio), the equal-spacing rule, no widows (`text-wrap: balance`), about 10 words above the fold. Run a critic on 5 key screens | Nice to have | 45 min |
| 9 | Dependency audit as a report only (`pnpm audit`, `cargo audit`), no upgrades | Nice to have | 20 min |
| 10 | Own bundle ID `com.websiteformula.upshot` (questions-for-Adam #4); keeps dev and release apart | Nice to have | 1 h |
| 11 | Run brand extraction on Glaido and cite it in `design-system.md` | Nice to have | 30 min |
| 12 | Add Supabase, Vercel, Stripe, Resend or Sentry, or the F3 key proxy | Skip | n/a |
