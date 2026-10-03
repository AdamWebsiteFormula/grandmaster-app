import { describe, expect, it, vi } from "vitest";

vi.mock("~/db", () => ({ useLiveQuery: vi.fn(() => ({ data: undefined })) }));

import { emptyNoteIdsFromRows } from "./empty-note-ids";

// Fork: journey-after P3 "⌘K search, no query": Home's empty-note rule.
describe("emptyNoteIdsFromRows", () => {
  it("keeps only untitled notes with no text, transcript or audio", () => {
    const ids = emptyNoteIdsFromRows([
      { id: "empty", title: "", has_transcript: 0, has_content: 0 },
      { id: "blank-title", title: "   ", has_transcript: 0, has_content: 0 },
      { id: "recorded", title: "", has_transcript: 1, has_content: 0 },
      { id: "written", title: null, has_transcript: 0, has_content: true },
      { id: "named", title: "Standup", has_transcript: 0, has_content: 0 },
    ]);
    expect([...ids].sort()).toEqual(["blank-title", "empty"]);
  });
});
