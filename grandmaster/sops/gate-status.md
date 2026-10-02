# Gate status (prompt A)

- 0 Agent hygiene: done (root AGENTS.md one line; .claude/skills, .claude/settings.json, .mcp.json removed; .claude/settings.local.json kept, untracked)
- 1a rustup + Rust 1.94.0: done (~/.cargo/bin, no sudo, PATH not modified in shell profiles)
- 1b process-compose v1.122.0: done (~/.local/bin, checksum ok)
- 1c MetalToolchain: done
- 1d pnpm install --frozen-lockfile: done (node v26.8.1)
- 1e pnpm dev:desktop: compiling (CARGO_TARGET_DIR=~/anarlog-target). Fixes so far:
  - Xcode 27 SwiftPM defaults to swiftbuild; swift-rs 1.0.7 expects the native layout. Fix: shim ~/.local/share/grandmaster-shims/swift adds --build-system native (no repo change). Must be first on PATH for dev and release.
  - cmake missing: CMake 4.4.4 Kitware tarball in ~/.local/opt, linked in ~/.local/bin; CMAKE_POLICY_VERSION_MINIMUM=3.5.
  - macOS 27 SDK: plugins/permissions/swift/check-permissions.swift needs `import ApplicationServices` (1 line).
- 2 SOPs (rebrand, design, models, features): done in grandmaster/sops/
- 3a analytics POSTHOG: done (option_env!, no-op without key)
- 3b VITE_API_URL: build-time env only, no code change
- 3c-d updater off / signingIdentity "-": pending (after dev test, to avoid a dev restart)
- 3e sidecars: script ready (cargo xtask copies from src-tauri/target, so it is reproduced with CARGO_TARGET_DIR)
