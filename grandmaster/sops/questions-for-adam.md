# For Adam (Saturday morning, Oct 3)

Everything below is either a quick check only you can do, or a decision. Fixed items moved to night-log.md.

## Quick checks (about 15 minutes)

1. **Permissions again:** each new build is a "new app" to macOS (ad-hoc signing), so Upshot asks for the microphone, system audio and Accessibility once more. If the Accessibility row stays off after you allow it, click the new "Restart Upshot" button.
2. **Record one note** with sound playing (a YouTube clip) and check that both You and Them meters move and a summary appears.
3. **Granola import:** Settings › Imports › Granola › Connect. Do your Granola meetings appear?
4. **Glaido:** Settings › Developers › Connect to Glaido, then import the folder in Glaido (the steps follow Glaido's docs: Tools → Import; tell me if the menu says something else) and ask one question about a meeting.
5. **Model picker:** Settings › Intelligence: is there a "New" badge on recent models?
6. **Audio playback:** in a note's transcript, click a word. Do you hear it?

## One-minute account tasks (only you can do these)

7. **Private vulnerability reporting:** GitHub → grandmaster-app → Settings → Code security → "Private vulnerability reporting" → Enable. SECURITY.md links to it.
8. **Account safety** (from Jack's compliance lesson): two-factor login on GitHub, Anthropic and Google, and a spend limit on the key you use for the demo.

## Decided (no action)

- No demo server: judges use a free Gemini key (linked in the app) or their own key.
- App ID changed to `com.websiteformula.upshot` (done).
- Billing tests fixed (done).
- Repo stays under AdamWebsiteFormula (Upshot is Website Formula work).

## Optional, only if time allows

- **Notarization** (needs an Apple Developer account): removes the "Open Anyway" step for judges and the repeated permission prompts after each build. Without it, the README explains the steps.
