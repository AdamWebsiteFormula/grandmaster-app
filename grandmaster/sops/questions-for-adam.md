# Questions for Adam (morning, Oct 3)

Work continued around each of these. Answer with the number and your pick.

1. **F3 "Summaries without a key" needs your Cloudflare account.** The spec wants a small Cloudflare Worker that holds a capped key of yours (wrangler secret, rate limit, daily spend cap, kill date Oct 31), so a judge with no key still gets Enhance. I can't create your Cloudflare resources or handle your key.
   - A (my pick): skip the Worker. Judges paste a key (the onboarding/Intelligence path is now one paste, and the provider switches automatically). Apple Intelligence works with no key on macOS 26.
   - B: you run `wrangler login` and set the secret yourself; I write the Worker code and the steps.
2. **Second-account DMG test** is still open (definition of done). It also checks the new onboarding transcription step and the window placement bug (#1), which only reproduce on a clean install.
3. **Glaido import, by hand (2 min).** Settings → Developers → Connect to Glaido, then import the folder in Glaido and ask about a test meeting. Tell me which menu Glaido 0.3.2 shows ("Tools → Import" per the Glaido docs, or "Commands → Custom tools → Import folder" per features.md), so the on-screen steps match.
4. **App ID (bundle identifier).** The app still uses `com.hyprnote.dev`, a name in Anarlog's company namespace. Apple's guidance: a unique reverse-domain ID you own. Data is safe either way (release builds always use the `anarlog/` folder).
   - A (my pick): change it to `com.websiteformula.upshot` on Saturday, then update the self-detection lists (crates/detect, plugins/detect/policy.rs), re-test permissions, and re-enter your key once in the dev app.
   - B: keep it for the contest. It works; only a Mac that also has Anarlog Dev installed could see clashes in permissions and saved keys.
5. **Billing tests:** 2 upstream tests fail because they hard-code 2025 dates. Billing is hidden. Fix them (5 minutes) or leave them?
