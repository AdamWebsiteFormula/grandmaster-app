import { md2json } from "@anlg/editor/markdown";
import type { SessionEvent } from "@anlg/store";

import { liveQueryClient } from "~/db";
import { EXAMPLE_NOTE_TRACKING_ID } from "~/onboarding/welcome-note.constants";
import { ensureSummaryDocument } from "~/services/enhancer/storage";
import { createSession, updateEnhancedNoteContent } from "~/session/queries";
import { DEFAULT_USER_ID, id } from "~/shared/utils";
import { createTranscript } from "~/stt/queries";
import type { WordWithId } from "~/stt/types";

// Fork: an example meeting on first run, so the summary and transcript have
// something to show before the first recording. Granola puts a demo meeting
// in the app at first sign-in, once only
// (docs.granola.ai/help-center/getting-started/setting-up-granola-for-the-first-time).

export const EXAMPLE_NOTE_TITLE = "Example: Product sync";

const EXAMPLE_MEMO = `This is an example meeting, so you can see what Upshot makes. Open **Summary** and **Transcript** above.


To delete it, right-click it on Home and choose **Delete note**.`;

export const EXAMPLE_SUMMARY = `## Summary

- User tests of the new checkout went well: 5 of 6 people finished without help.
- The one person who got stuck missed the promo code field.

## Decisions

- Move the promo code field above the total.
- Launch stays on the 12th, if the payment provider approves the new flow.

## Action items

- Them: have the promo code design ready by Wednesday.
- Them: follow up with the payment provider today.
- You: update the launch plan and share it with support by Thursday.
- Both: check in again on Friday.`;

// Channel 0 is your microphone (You); channel 1 is the Mac's sound (Them).
export const EXAMPLE_TURNS: ReadonlyArray<{ channel: 0 | 1; text: string }> = [
  {
    channel: 0,
    text: "Thanks for joining. Let's do a quick check on the checkout redesign. How did the user tests go?",
  },
  {
    channel: 1,
    text: "Really well. Five of six people finished checkout without help. The one who got stuck missed the promo code field.",
  },
  {
    channel: 0,
    text: "Okay, so let's move the promo code field above the total.",
  },
  { channel: 1, text: "Agreed. Design can have that ready by Wednesday." },
  { channel: 0, text: "Good. Are we still on track to launch on the twelfth?" },
  {
    channel: 1,
    text: "We are, as long as the payment provider approves the new flow. I'll follow up with them today.",
  },
  {
    channel: 0,
    text: "Great. I'll update the launch plan and share it with support by Thursday.",
  },
  { channel: 1, text: "Perfect. Let's check in again on Friday." },
];

const MS_PER_WORD = 380;
const TURN_GAP_MS = 600;

export function buildExampleWords(transcriptId: string): WordWithId[] {
  const words: WordWithId[] = [];
  let at = 0;
  for (const turn of EXAMPLE_TURNS) {
    for (const text of turn.text.split(" ")) {
      words.push({
        id: `${transcriptId}:word:${words.length}`,
        text: ` ${text}`,
        start_ms: at,
        end_ms: at + MS_PER_WORD - 40,
        channel: turn.channel,
      });
      at += MS_PER_WORD;
    }
    at += TURN_GAP_MS;
  }
  return words;
}

let pendingExampleSession: Promise<string | null> | null = null;

/** Seeds the example once. Returns null when it already exists or was
 * deleted by the user (a deleted example does not come back). */
export function seedExampleSessionOnce(): Promise<string | null> {
  if (!pendingExampleSession) {
    pendingExampleSession = seedExampleSession().finally(() => {
      pendingExampleSession = null;
    });
  }
  return pendingExampleSession;
}

async function seedExampleSession(): Promise<string | null> {
  const rows = await liveQueryClient.execute<{ id: string }>(
    `
      SELECT id
      FROM sessions
      WHERE CASE
          WHEN json_valid(event_json)
          THEN json_extract(event_json, '$.tracking_id')
        END = ?
      LIMIT 1
    `,
    [EXAMPLE_NOTE_TRACKING_ID],
  );
  if (rows[0]) return null;

  const words = buildExampleWords("example");
  const durationMs = words[words.length - 1]?.end_ms ?? 0;
  const startedAtMs = Date.now() - durationMs - 60_000;
  const startedAt = new Date(startedAtMs).toISOString();
  const event: SessionEvent = {
    tracking_id: EXAMPLE_NOTE_TRACKING_ID,
    calendar_id: "",
    title: EXAMPLE_NOTE_TITLE,
    started_at: startedAt,
    ended_at: new Date(startedAtMs + durationMs).toISOString(),
    is_all_day: false,
    has_recurrence_rules: false,
    meeting_link: "",
    description: "An example meeting to show what Upshot makes.",
  };

  const sessionId = await createSession(EXAMPLE_NOTE_TITLE, DEFAULT_USER_ID, {
    event_json: JSON.stringify(event),
    raw_md: JSON.stringify(md2json(EXAMPLE_MEMO)),
  });

  const transcriptId = id();
  await createTranscript({
    id: transcriptId,
    sessionId,
    ownerUserId: DEFAULT_USER_ID,
    createdAt: startedAt,
    startedAt: startedAtMs,
    endedAt: startedAtMs + durationMs,
    source: "example",
    words: buildExampleWords(transcriptId),
  });

  const summary = await ensureSummaryDocument(sessionId);
  await updateEnhancedNoteContent(
    summary.id,
    sessionId,
    JSON.stringify(md2json(EXAMPLE_SUMMARY)),
  );

  return sessionId;
}
