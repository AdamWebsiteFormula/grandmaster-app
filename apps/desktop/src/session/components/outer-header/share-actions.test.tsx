import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildNotesMailto,
  MAILTO_BODY_LIMIT,
  markdownToPlainText,
  useNoteShareActions,
} from "./share-actions";

const mocks = vi.hoisted(() => ({
  openUrl: vi.fn(() => Promise.resolve({ status: "ok", data: null })),
  copyTextToClipboard: vi.fn(() => Promise.resolve(true)),
  toastSuccess: vi.fn(),
  rawMd: "",
  enhancedContent: "",
}));

vi.mock("@anlg/plugin-opener2", () => ({
  commands: { openUrl: mocks.openUrl },
}));

vi.mock("@anlg/ui/components/ui/toast", () => ({
  toast: { success: mocks.toastSuccess, error: vi.fn() },
}));

vi.mock("~/session/components/note-input/header-shared", () => ({
  copyTextToClipboard: mocks.copyTextToClipboard,
  getStoredNoteMarkdown: (content: string | undefined) => content ?? "",
}));

vi.mock("~/session/queries", () => ({
  useSession: () => ({ title: "Weekly sync", raw_md: mocks.rawMd }),
  useEnhancedNoteRecords: () => [{ id: "summary-1" }],
  useEnhancedNote: (id: string) =>
    id ? { content: mocks.enhancedContent } : undefined,
}));

describe("markdownToPlainText", () => {
  it("drops Markdown marks but keeps structure", () => {
    expect(
      markdownToPlainText(
        [
          "# Weekly sync",
          "",
          "## Next steps",
          "* **Ship** the _beta_ by `Friday`",
          "- See [the plan](https://example.com/plan)",
          "",
          "",
          "",
          "Done\\.",
        ].join("\n"),
      ),
    ).toBe(
      [
        "Weekly sync",
        "",
        "Next steps",
        "- Ship the beta by Friday",
        "- See the plan (https://example.com/plan)",
        "",
        "Done.",
      ].join("\n"),
    );
  });
});

describe("buildNotesMailto", () => {
  it("puts the title in the subject and the notes in the body", () => {
    const { url, truncated } = buildNotesMailto({
      title: "Weekly sync",
      body: "Line one\nLine two & more",
      truncatedNote: "Full notes copied to clipboard.",
    });

    expect(truncated).toBe(false);
    expect(url).toBe(
      "mailto:?subject=Weekly%20sync&body=Line%20one%0ALine%20two%20%26%20more",
    );
  });

  it("cuts a long body at a line break and says the full notes were copied", () => {
    const body = Array.from({ length: 400 }, (_, i) => `Line ${i}`).join("\n");
    const { url, truncated } = buildNotesMailto({
      title: "Long",
      body,
      truncatedNote: "Full notes copied to clipboard.",
    });

    expect(truncated).toBe(true);
    const sent = decodeURIComponent(url.split("&body=")[1]!);
    expect(sent.length).toBeLessThan(MAILTO_BODY_LIMIT + 60);
    expect(sent.endsWith("…\n\nFull notes copied to clipboard.")).toBe(true);
    expect(sent.split("\n\n…")[0]!.endsWith("\n")).toBe(false);
  });
});

describe("useNoteShareActions", () => {
  beforeEach(() => {
    mocks.openUrl.mockClear();
    mocks.copyTextToClipboard.mockClear();
    mocks.toastSuccess.mockClear();
    mocks.rawMd = "My own notes";
    mocks.enhancedContent = "# Weekly sync\n\n## Decisions\n- **Ship** it";
  });

  afterEach(() => {
    cleanup();
  });

  it("mails the summary as plain text with the note title as subject", async () => {
    const { result } = renderHook(() =>
      useNoteShareActions("session-1", { type: "enhanced", id: "summary-1" }),
    );

    await act(() => result.current.sendNotesViaEmail());

    expect(mocks.openUrl).toHaveBeenCalledWith(
      `mailto:?subject=Weekly%20sync&body=${encodeURIComponent(
        "Decisions\n- Ship it",
      )}`,
      null,
    );
    expect(mocks.copyTextToClipboard).not.toHaveBeenCalled();
  });

  it("copies the notes the user is looking at", async () => {
    const { result } = renderHook(() =>
      useNoteShareActions("session-1", { type: "raw" }),
    );

    await act(() => result.current.copyNotes());

    expect(mocks.copyTextToClipboard).toHaveBeenCalledWith(
      "My own notes",
      expect.objectContaining({ success: "Notes copied to clipboard" }),
      { html: true },
    );
  });

  it("copies the full notes when the email body is cut", async () => {
    mocks.enhancedContent = Array.from(
      { length: 300 },
      (_, i) => `- Point ${i}`,
    ).join("\n");
    const { result } = renderHook(() =>
      useNoteShareActions("session-1", { type: "enhanced", id: "summary-1" }),
    );

    await act(() => result.current.sendNotesViaEmail());

    expect(mocks.copyTextToClipboard).toHaveBeenCalledTimes(1);
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Full notes copied to clipboard",
    );
    expect(mocks.openUrl).toHaveBeenCalledTimes(1);
  });
});
