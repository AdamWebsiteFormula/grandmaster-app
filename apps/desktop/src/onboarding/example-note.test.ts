import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  createSession: vi.fn(),
  createTranscript: vi.fn(),
  ensureSummaryDocument: vi.fn(),
  updateEnhancedNoteContent: vi.fn(),
}));

vi.mock("~/db", () => ({ liveQueryClient: { execute: mocks.execute } }));
vi.mock("~/session/queries", () => ({
  createSession: mocks.createSession,
  updateEnhancedNoteContent: mocks.updateEnhancedNoteContent,
}));
vi.mock("~/stt/queries", () => ({ createTranscript: mocks.createTranscript }));
vi.mock("~/services/enhancer/storage", () => ({
  ensureSummaryDocument: mocks.ensureSummaryDocument,
}));

import {
  buildExampleWords,
  EXAMPLE_NOTE_TITLE,
  seedExampleSessionOnce,
} from "./example-note";
import { EXAMPLE_NOTE_TRACKING_ID } from "./welcome-note.constants";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.execute.mockResolvedValue([]);
  mocks.createSession.mockResolvedValue("example-session");
  mocks.createTranscript.mockResolvedValue(undefined);
  mocks.ensureSummaryDocument.mockResolvedValue({ id: "summary-note" });
  mocks.updateEnhancedNoteContent.mockResolvedValue(undefined);
});

it("seeds a labeled example with a two-speaker transcript and a finished summary", async () => {
  await expect(seedExampleSessionOnce()).resolves.toBe("example-session");

  const [title, , initial] = mocks.createSession.mock.calls[0];
  expect(title).toBe(EXAMPLE_NOTE_TITLE);
  expect(title).toMatch(/^Example: /);
  expect(JSON.parse(initial.event_json).tracking_id).toBe(
    EXAMPLE_NOTE_TRACKING_ID,
  );
  expect(initial.raw_md).toContain("Delete note");

  const transcript = mocks.createTranscript.mock.calls[0][0];
  expect(transcript.sessionId).toBe("example-session");
  const channels = new Set(
    transcript.words.map((word: { channel: number }) => word.channel),
  );
  expect(channels).toEqual(new Set([0, 1]));

  expect(mocks.ensureSummaryDocument).toHaveBeenCalledWith("example-session");
  const [noteId, sessionId, content] =
    mocks.updateEnhancedNoteContent.mock.calls[0];
  expect([noteId, sessionId]).toEqual(["summary-note", "example-session"]);
  expect(content).toContain("Action items");
});

it("never re-creates the example, even after the user deleted it", async () => {
  mocks.execute.mockResolvedValueOnce([{ id: "old-example" }]);

  await expect(seedExampleSessionOnce()).resolves.toBeNull();
  expect(mocks.createSession).not.toHaveBeenCalled();
  // The lookup ignores deleted_at, so a deleted example stays gone.
  expect(mocks.execute.mock.calls[0][0]).not.toContain("deleted_at");
});

it("builds ordered, non-overlapping words", () => {
  const words = buildExampleWords("t");
  for (let i = 1; i < words.length; i++) {
    expect(words[i]!.start_ms).toBeGreaterThan(words[i - 1]!.end_ms ?? 0);
  }
  expect(words[0]!.id).toBe("t:word:0");
});
