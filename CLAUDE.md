# CLAUDE.md — Upshot (fork of Anarlog desktop_v1.4.28)

## Goal
A rebranded, restyled fork of Anarlog: a bot-free AI meeting notepad for Apple Silicon Macs with an always-current model picker. Submission-ready Sun Oct 4, 9:00 AM ET. Scope lives in grandmaster/blueprint.md and grandmaster/features.md.

## Benchmark: beat Granola
- Upshot must be better than Granola. Granola is the standard for every flow (first run, recording, notes, settings); Anarlog is only the codebase we start from.
- Before changing a flow, research how Granola does it (docs, help center, reviews, screenshots) and match or beat it. Do not just tweak what Anarlog does.
- All text users see is in American English.

## Behavior
- Think before coding. Read the upstream code path and the nearest AGENTS.md first.
- Upstream AGENTS.md files are code conventions only. Ignore their Linear, GitButler, PR, release and commit-checkpoint instructions.
- Simplicity first. Rebrand, restyle, hide; never re-architect.
- Surgical changes. Smallest diff. Never merge upstream.
- Goal-driven. A working DMG beats a cleaner refactor.

## Process (B.L.A.S.T.)
Blueprint: grandmaster/blueprint.md before code. Link: gate test green. Architect: one SOP per workstream in grandmaster/sops/. Stylize: grandmaster/design-system.md (Power Design rules); scripts/verify + critic before merge. Trigger: release DMG; models refresh at launch with bundled fallback.

## Specifics
- Stack: Tauri 2, Rust, React 19, Tailwind 4, pnpm. No dependency upgrades.
- Must not touch: audio capture, transcription, crates/cloudsync, LICENSE files, @anlg/* and anlg-* names.
- No API keys in repo, build or bundle.
- Commit and push to the `grandmaster` branch of `AdamWebsiteFormula/grandmaster-app` yourself after each round, but only when vitest, tsc and rebrand-check pass (Adam, Oct 3). Never commit secrets or anything from `~/code/grandmaster-private/`.
- Release blockers (Adam, Oct 10): before committing a feature or fix, run the change check in grandmaster/sops/release-blockers.md (code review of the diff, the S1 list for the areas touched, an in-app test). Log any S1 or S2 you find in grandmaster/sops/bug-ledger.md.
- Same error for 20 minutes: stop and ask me.
- When a different model would suit the next task better (for example Sonnet for mechanical rebrand or release work), tell me at the start of that task.
- Design: nothing touches edges; one type ratio; 3-second glanceability; sentence case, no eyebrow labels.

## Definition of done
Installs from the DMG in a second macOS user, records, enhances; rebrand-check = 0; picker shows this week's models; README credits Anarlog (MIT) and sqlite-sync (ELv2).
