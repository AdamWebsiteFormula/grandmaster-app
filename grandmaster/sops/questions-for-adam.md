# Questions for Adam (morning, Oct 3)

Work continued around each of these. Answer with the number and your pick.

1. **F3 "Summaries without a key" needs your Cloudflare account.** The spec wants a small Cloudflare Worker that holds a capped key of yours (wrangler secret, rate limit, daily spend cap, kill date Oct 31), so a judge with no key still gets Enhance. I can't create your Cloudflare resources or handle your key.
   - A (my pick): skip the Worker. Judges paste a key (the onboarding/Intelligence path is now one paste, and the provider switches automatically). Apple Intelligence works with no key on macOS 26.
   - B: you run `wrangler login` and set the secret yourself; I write the Worker code and the steps.
2. **Second-account DMG test** is still open (definition of done). It also checks the new onboarding transcription step and the window placement bug (#1), which only reproduce on a clean install.
3. **Billing tests:** 2 upstream tests fail because they hard-code 2025 dates. Billing is hidden. Fix them (5 minutes) or leave them?
