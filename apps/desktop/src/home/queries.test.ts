import { createRequire } from "node:module";
import { expect, it, vi } from "vitest";

vi.mock("~/auth", () => ({ useAuth: vi.fn() }));
vi.mock("~/db", () => ({ useLiveQuery: vi.fn() }));

import { NOTES_SQL, STREAK_SQL, TALK_SQL } from "./queries";

import {
  EXAMPLE_NOTE_TRACKING_ID,
  WELCOME_NOTE_TRACKING_ID,
} from "~/onboarding/welcome-note.constants";

const { DatabaseSync } = createRequire(import.meta.url)(
  "node:sqlite",
) as typeof import("node:sqlite");

it("leaves the welcome note and the example meeting out of home stats", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`
      CREATE TABLE sessions (id TEXT PRIMARY KEY, owner_user_id TEXT, deleted_at TEXT, event_json TEXT);
      CREATE TABLE transcripts (id TEXT PRIMARY KEY, session_id TEXT, started_at_ms INTEGER, created_at TEXT, words_json TEXT, deleted_at TEXT);
      CREATE TABLE session_documents (id TEXT PRIMARY KEY, session_id TEXT, kind TEXT, body_format TEXT, body TEXT, created_at TEXT, deleted_at TEXT);
    `);
    const addSession = db.prepare(
      "INSERT INTO sessions VALUES (?, 'user', NULL, ?)",
    );
    const addTranscript = db.prepare(
      "INSERT INTO transcripts VALUES (?, ?, 5000, '2026-10-02T00:00:00Z', ?, NULL)",
    );
    const addSummary = db.prepare(
      "INSERT INTO session_documents VALUES (?, ?, 'summary', 'markdown', 'one two three', '2026-10-02T00:00:00Z', NULL)",
    );
    const words = JSON.stringify([
      { text: " Hi", start_ms: 0, end_ms: 400, channel: 0 },
      { text: " there", start_ms: 500, end_ms: 900, channel: 1 },
    ]);
    for (const [sessionId, trackingId] of [
      ["real", ""],
      ["welcome", WELCOME_NOTE_TRACKING_ID],
      ["example", EXAMPLE_NOTE_TRACKING_ID],
    ]) {
      addSession.run(sessionId, JSON.stringify({ tracking_id: trackingId }));
      addTranscript.run(sessionId, sessionId, words);
      addSummary.run(sessionId, sessionId);
    }

    const notes = db
      .prepare(NOTES_SQL)
      .get("2026-01-01", "2026-01-01", "2026-01-01", "user") as {
      month_generations: number;
    };
    expect(notes.month_generations).toBe(1);

    const talk = db.prepare(TALK_SQL).all("user", 0) as Array<{
      words: number;
    }>;
    expect(talk.map((row) => row.words)).toEqual([1, 1]);

    expect(db.prepare(STREAK_SQL).all("user", 0)).toHaveLength(1);
  } finally {
    db.close();
  }
});
