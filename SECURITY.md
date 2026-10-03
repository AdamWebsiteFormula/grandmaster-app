# Security policy

## Supported versions

Upshot ships fixes forward. Only the latest release gets security fixes.

## Report a vulnerability

Please do not open a public issue for a security problem.

Report it privately by email to [adam@websiteformula.co](mailto:adam@websiteformula.co).

Please include:

- What the problem is and what an attacker could do with it
- Steps to reproduce, a proof of concept, or the affected code
- The Upshot version and your macOS version

## What to expect

- We confirm we received your report within 3 business days.
- We tell you what we plan to do and when.
- We credit you in the fix, unless you ask us not to.

## Scope

Upshot is a local-first Mac app. Its only server is the Upshot AI proxy, a Cloudflare Worker (`grandmaster/worker/`) that passes Enhance and chat requests to OpenRouter and stores or logs nothing. Your notes, transcripts and audio stay on your Mac, and any AI keys you add stay in the macOS Keychain. See "Where your data lives" in the [README](README.md).

Pro is optional. If you create an account, your email and your plan (status, Stripe customer ID, renewal date) live in Supabase; the app keeps only your sign-in session, in the macOS Keychain. Card details never touch Upshot: you pay on Stripe Checkout, and the Worker receives only signature-checked Stripe webhooks. The Stripe and Supabase keys live only as Worker secrets, never in the repo, the build or the app.

Upshot is a fork of [Anarlog](https://github.com/fastrepl/anarlog). If a problem is in code that Upshot did not change, please also report it to the Anarlog project.
