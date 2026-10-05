# Feature research, Oct 5, 2026: Granola pain points and post-meeting ideas

Two research passes (web, read-only): problems people report with Granola, and Adam's post-meeting ideas checked against competitors and user evidence. Nothing here is approved to build; Adam picks. Evidence notes: many review blogs are competitors repeating each other, Reddit and G2 were mostly seen as search excerpts, and vendor claims were not all read in full.

## Ranked recommendations

| # | Idea | Problem it solves (evidence) | Upshot's edge | Size |
|---|---|---|---|---|
| 1 | **Verified client recap link**: summary, transcript and the real audio, private by default, expiring | Granola's web viewers see the summary only, not the transcript ([docs](https://docs.granola.ai/help-center/sharing/sharing-notes)); share links once defaulted to public ([Reddit](https://www.reddit.com/r/ArtificialInteligence/comments/1m9lox6/)); consultants say clients value the recording ([r/consulting](https://www.reddit.com/r/consulting/comments/1i5txsl/)); Fathom, Fireflies, Avoma and Gong share by link | Upshot keeps audio, so the client can hear the exact moment. Make the page look great (this covers the "beautiful deck" idea) | M, on top of Sharing step 1a |
| 2 | **Send the follow-up email** from your own Gmail or Outlook, with a review step and undo | Granola sends via Gmail only, paid plan, Outlook "not yet" ([docs](https://docs.granola.ai/help-center/taking-notes/follow-up-emails)); writing up takes users an hour ([r/projectmanagement](https://www.reddit.com/r/projectmanagement/comments/1w0383c/)) | Outlook is a gap Granola leaves open | M (send-only Gmail scope avoids Google's yearly security audit; Google review takes weeks) |
| 3 | **Promises across meetings**: who owes whom what, across all calls, with a morning reminder | Commitments get lost between meetings; users query old calls by hand ([Granola blog](https://www.granola.ai/blog/query-meeting-notes-across-folders)); about an hour a day of follow-up work ([zackproser](https://zackproser.com/granola)); Baton tracks promises | Notes and chat already local; Upshot already extracts action items | M |
| 4 | **Never miss a recording**: an "armed" check before a calendar meeting and an alert when a call happened but nothing was captured | Silent recording failure is the most-cited Granola complaint (~6 sources, e.g. [r/macapps](https://www.reddit.com/r/macapps/comments/1rkuk8u/)) | Upshot already warns live when it can't hear the other side | S |
| 5 | **Proposal draft** from a discovery call, in your template; hand off to PandaDoc or DocuSign for signing later | Freelancers spend hours per proposal ([r/Freelancers](https://www.reddit.com/r/Freelancers/comments/1og7bhd/)); Fireflies has a proposal generator. Risk: clients ignore generic AI proposals, and invented prices | Uses the full transcript plus your own actions (Phase 2) | Draft S to M; signing handoff L. Don't build our own e-sign |
| 6 | **Highlight reel from the real audio**: the 3 to 5 key moments as short clips | Teams, Read.ai, Fireflies Soundbites do this; mostly for people who missed the meeting | Kept audio means real clips, no synthetic voice that can sound sure and be wrong | M |
| 7 | **Notes where your work lives**: Google Docs, task managers, Salesforce | No auto-sync; users copy and paste about 5 minutes per call (~6 sources, e.g. [itsconvo](https://www.itsconvo.com/blog/granola-ai-review)); Salesforce only through Zapier ([coffee.ai](https://www.coffee.ai/articles/granola-crm-integration-reviews-2026)) | The Markdown folder (roadmap) is step one | M each |

## Defer

- **AI audio recap with a synthetic voice** (Teams, Meeting.ai, NotebookLM do it): weak client demand, voice disclosure and cost. Idea 6 does the same job with real audio.
- **Video recap with AI voiceover:** needs video recording first (roadmap); internal catch-up use, not clients. 4+ weeks.
- **Social content (reels, carousels):** strong for podcasters and creators, thin for normal meetings, and risky for private calls. It works when the talk is meant to be public: podcasts, interviews, webinars, your own expert explanations, and client success stories with the client's written OK. Baton aims at creators, which fits Jack's audience. If added, make it one of "your own actions," not a default.

## Problems users rarely say out loud

1. Nobody writes the deliverable: users turn notes into a client recap, proposal or SOW by hand (ideas 1, 2, 5).
2. The other side needs proof, not just a note: a shareable "what we agreed" page with the audio (idea 1).
3. Missed recordings are found out too late (idea 4).
4. Commitments get lost between meetings (idea 3).
5. Too many outputs to triage: one list of next actions per meeting beats more documents (weak evidence).

## Other gaps worth noting

- Speaker names collapse to "Me" and "Them" (~7 sources). Already on the roadmap (speaker names from Zoom, Meet and Teams).
- Granola trains on data by default on Free and Business (~3 sources), and a class action alleges silent capture. Upshot's meeting-chat notice and stop-on-decline are a selling point; keep share links private by default.
- Free plan limits are Granola's most common complaint (~8 sources). Upshot keeps all notes on your computer.
