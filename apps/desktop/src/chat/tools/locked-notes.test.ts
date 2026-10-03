import { beforeEach, describe, expect, it, vi } from "vitest";

// Fork: journey-after P1 "Locked notes". These tests run the real
// content-queries, chat note tools and session context hydrator against a fake
// SQLite client, and prove a locked note's text and transcript never reach chat
// until the user unlocks it.

const SECRET = "Private salary talk";
const SECRET_TRANSCRIPT = "confidential raise numbers";

type FakeSession = { id: string; locked: number; title: string; body: string };

const sessions: FakeSession[] = [
  { id: "open", locked: 0, title: "Open sync", body: "Shared salary plan" },
  { id: "secret", locked: 1, title: "Secret sync", body: SECRET },
];

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  renderSessionTranscript: vi.fn(),
  loadMeetingChatRecords: vi.fn(async () => []),
  formatMeetingChatRecordsAsMarkdown: vi.fn(() => ""),
  authenticate: vi.fn(),
  available: vi.fn(),
}));

vi.mock("~/db", () => ({ liveQueryClient: { execute: mocks.execute } }));
vi.mock("@anlg/plugin-transcription", () => ({
  commands: { renderSessionTranscript: mocks.renderSessionTranscript },
}));
vi.mock("@anlg/plugin-local-auth", () => ({
  commands: { authenticate: mocks.authenticate, available: mocks.available },
}));
vi.mock("~/stt/meeting-chat-records", () => ({
  loadMeetingChatRecords: mocks.loadMeetingChatRecords,
  formatMeetingChatRecordsAsMarkdown: mocks.formatMeetingChatRecordsAsMarkdown,
}));
vi.mock("~/session/queries", () => ({
  loadSessionSummariesByFolder: vi.fn(async () => []),
}));

import { hydrateSessionContext } from "../context/session-context-hydrator";
import { noteFileTestInternals, searchMeetingContent } from "./note-files";

import { useAppLock } from "~/lock/store";
import {
  loadActiveSessionIds,
  loadReadableSessionContentSnapshot,
} from "~/session/content-queries";

function contentRow(session: FakeSession) {
  return {
    id: session.id,
    owner_user_id: "user-1",
    owner_email: null,
    title: session.title,
    locked: session.locked,
    created_at: "2026-10-01T09:00:00.000Z",
    event_json: "null",
    source_apps_json: "[]",
    event_id: "",
    raw_note_id: session.id,
    raw_template_id: "",
    raw_body: session.body,
    raw_body_format: "markdown",
    enhanced_notes_json: JSON.stringify([
      {
        id: `${session.id}-summary`,
        title: "Summary",
        body: `${session.body} summary`,
        body_format: "markdown",
        template_id: "",
        sort_order: 0,
      },
    ]),
    transcripts_json: JSON.stringify([
      {
        id: `${session.id}-transcript`,
        started_at_ms: 0,
        ended_at_ms: 1,
        memo: "",
        words_json: JSON.stringify([
          { id: "w1", text: SECRET_TRANSCRIPT, start_ms: 0, end_ms: 1 },
        ]),
        speaker_hints_json: "[]",
      },
    ]),
    participants_json: "[]",
  };
}

// Emulates the two queries: the id list honors `locked = 0` only when the SQL
// asks for it, so the test fails if the filter is ever dropped.
mocks.execute.mockImplementation(async (sql: string, params?: unknown[]) => {
  if (sql.includes("FROM sessions AS session")) {
    const id = params?.[params.length - 1];
    const session = sessions.find((item) => item.id === id);
    return session ? [contentRow(session)] : [];
  }
  if (sql.includes("SELECT id") && sql.includes("FROM sessions")) {
    return sessions
      .filter((session) => !sql.includes("locked = 0") || !session.locked)
      .map((session) => ({ id: session.id }));
  }
  return [];
});

describe("locked notes stay out of chat", () => {
  beforeEach(() => {
    useAppLock.setState({ revealedNoteIds: {}, appUnlocked: false });
    mocks.renderSessionTranscript.mockResolvedValue({
      status: "ok",
      data: {
        segments: [{ speaker_label: "Me", text: SECRET_TRANSCRIPT }],
        started_at: null,
        ended_at: null,
      },
    });
  });

  it("never lists a locked note for grep_notes or related notes", async () => {
    await expect(loadActiveSessionIds()).resolves.toEqual(["open"]);
  });

  it("grep_notes finds unlocked text but not a locked note's text", async () => {
    const all = await searchMeetingContent({ query: "salary", limit: 10 });
    expect(all.results.map((result) => result.sessionId)).toEqual(["open"]);
    expect(JSON.stringify(all)).not.toContain(SECRET);

    // A folder-scoped search passes ids directly; the locked one still drops.
    const scoped = await searchMeetingContent({
      query: "confidential",
      sessionIds: ["secret"],
      limit: 10,
    });
    expect(scoped.results).toEqual([]);
  });

  it("reading a locked note by id returns nothing", async () => {
    await expect(
      noteFileTestInternals.loadNoteFile("secret"),
    ).resolves.toBeNull();
    await expect(
      loadReadableSessionContentSnapshot("secret"),
    ).resolves.toBeNull();
  });

  it("⌘J chat on a locked note gets no notes or transcript", async () => {
    await expect(hydrateSessionContext("secret")).resolves.toBeNull();
    expect(mocks.renderSessionTranscript).not.toHaveBeenCalled();
  });

  it("works again once the note is unlocked in this session", async () => {
    useAppLock.getState().markNoteRevealed("secret");

    const context = await hydrateSessionContext("secret");
    expect(context?.rawContent).toBe(SECRET);
    expect(context?.transcript?.segments[0]?.text).toBe(SECRET_TRANSCRIPT);

    // Background work (contact summaries) still skips it, as Insights does.
    await expect(
      loadReadableSessionContentSnapshot("secret", { allowRevealed: false }),
    ).resolves.toBeNull();

    // Locking the app again hides it.
    useAppLock.getState().lockApp();
    await expect(hydrateSessionContext("secret")).resolves.toBeNull();
  });
});
