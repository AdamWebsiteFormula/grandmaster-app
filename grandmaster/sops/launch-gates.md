# Launch gates (Oct 9, 2026)

Four things to finish before Upshot takes real money. Features are not on this list: Granola launched (May 2024) with only the core loop, Mac only.

| Gate | Status | Who |
|---|---|---|
| 1. Notarized install (no "can't be opened" block) | Script ready. Needs a Developer ID certificate. | Adam: steps A1–A4 |
| 2. Auto-update | On. Feed: GitHub Releases `latest.json`. Key: `~/.upshot-release/updater.key` | Claude; Adam backs up the key |
| 3. Stripe live | Works in test mode since Oct 3. Link comes back by itself with a live key. | Adam: steps S1–S8 |
| 4. Terms of service | Draft at `grandmaster/worker/drafts/terms.html`, not deployed (drafts/ is never served) | Adam: read, pick refund rule, lawyer check |

## Gate 1: Apple (Adam)

Sources: developer.apple.com/programs/enroll; developer.apple.com/documentation/security/notarizing-macos-software-before-distribution.

- A1. Enroll at developer.apple.com/programs/enroll ($99 a year). Individual is fastest and shows your name as the developer. Organization shows "Website Formula" but needs a D-U-N-S number first, which can take days.
- A2. Xcode › Settings › Accounts › add your Apple ID › Manage Certificates › + › Developer ID Application.
- A3. account.apple.com › Sign-In and Security › App-Specific Passwords › make one named "notarytool".
- A4. In Terminal: `xcrun notarytool store-credentials upshot --apple-id <your Apple ID email> --team-id <Team ID from developer.apple.com/account>`. Paste the app-specific password when it asks.

Then `APP_VERSION=1.0.x bash grandmaster/scripts/release.sh` finds the certificate, signs with the hardened runtime, notarizes, and staples. First signed build: test recording, Enhance and on-device transcription, since the hardened runtime can block things ad-hoc builds allow.

Why it matters beyond the warning: an ad-hoc app gets a new identity with every build, so macOS asks for microphone and screen permission again after every update. A Developer ID build keeps them.

## Gate 2: Auto-update (done; how to ship a release)

1. `APP_VERSION=1.0.1 bash grandmaster/scripts/release.sh` (and `x86_64` for Intel). Output in `~/grandmaster-release/`: the DMG, `Upshot_<v>_<arch>.app.tar.gz`, its `.sig`, and `latest.darwin-<arch>.json`.
2. Merge the `latest.darwin-*.json` pieces into one `latest.json`: `{ "version", "notes", "pub_date", "platforms": { ...pieces } }` (v2.tauri.app/plugin/updater, static JSON file).
3. Make GitHub release `v<version>` on AdamWebsiteFormula/grandmaster-app, marked Latest, with the DMG, `.app.tar.gz`, `.sig` and `latest.json`. The site's Download button and the app's feed both read releases/latest.
4. Copies installed from 1.0.0 have no updater. Those people must download once more.

The updater checks at open and every 30 minutes, installs at open, and never downloads or installs during a recording (plugins/updater2). Settings › General has "Install updates automatically"; the app menu, tray and Dock have Check for updates.

Back up `~/.upshot-release/updater.key` in your password manager. Without it no installed copy can ever accept an update again.

Windows and Linux: not yet in the feed (release.sh builds macOS only).

## Gate 3: Stripe live (Adam)

Sources: docs.stripe.com/get-started/checklist/website; Cal. Bus. & Prof. Code §17600 et seq. (AB 2863, in force July 1, 2025).

- S1. Dashboard › turn off Test mode › Activate payments (business details and bank account).
- S2. Settings › Public details: support email, and the terms and privacy URLs (`https://upshotnotes.com/terms`, `/privacy`) after the terms are deployed.
- S3. Product catalog: create "Upshot Pro" with a monthly and a yearly price. If the price is not $14 / $132, tell Claude: the price also appears in `grandmaster/worker/src/billing.js` (checkout text) and the app's Plan screen.
- S4. Developers › Webhooks › add `https://upshotnotes.com/billing/webhook` with events `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
- S5. Developers › API keys › restricted key with the same permissions as the test key.
- S6. Settings › Billing › Customer portal: allow cancel and update payment method.
- S7. Settings › Billing › Subscriptions and emails: turn on emails for upcoming renewals (the terms promise a reminder before a yearly renewal) and for failed payments.
- S8. In `grandmaster/worker`: `PATH=/usr/local/bin:$PATH npx wrangler secret put STRIPE_SECRET_KEY` (then `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`), and paste each live value.

Then test with your own card, and refund yourself in the Dashboard.

## Gate 4: Terms (Adam)

- Read `grandmaster/worker/drafts/terms.html` (open it in a browser).
- Refund rule in the draft: full refund on request within 14 days of a charge. Change it if you want.
- Not in the draft: governing law and arbitration. A lawyer should add these and read the rest. Recording consent is the big risk: Chamberlain v. Granola (N.D. Cal., filed July 30, 2026) is about it.
- After approval, Claude moves it to `public/`, deploys the Worker and changes "By continuing you agree to the privacy policy" in the app (onboarding and upgrade dialog) to name the terms too.
