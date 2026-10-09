import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildNotesMailto,
  getAttendeeEmails,
  MAILTO_BODY_LIMIT,
  markdownToPlainText,
  useNoteShareActions,
} from "./share-actions";

const mocks = vi.hoisted(() => ({
  openUrl: vi.fn(
    (): Promise<{ status: string; data?: null; error?: string }> =>
      Promise.resolve({ status: "ok", data: null }),
  ),
  copyTextToClipboard: vi.fn(() => Promise.resolve(true)),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  rawMd: "",
  enhancedContent: "",
  participants: [] as { email: string; human_id: string }[],
}));

vi.mock("@anlg/plugin-opener2", () => ({
  commands: { openUrl: mocks.openUrl },
}));

vi.mock("@anlg/ui/components/ui/toast", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("~/session/components/note-input/header-shared", () => ({
  copyTextToClipboard: mocks.copyTextToClipboard,
  getStoredNoteMarkdown: (content: string | undefined) => content ?? "",
}));

vi.mock("~/session/queries", () => ({
  useSession: () => ({
    title: "Weekly sync",
    raw_md: mocks.rawMd,
    user_id: "me",
  }),
  useSessionParticipants: () => mocks.participants,
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

// Fork tests: journey-meeting P2 (follow-up email recipients).
describe("getAttendeeEmails", () => {
  it("keeps valid, unique attendee addresses and drops the owner", () => {
    expect(
      getAttendeeEmails(
        [
          { email: "me@example.com", human_id: "me" },
          { email: "ana@example.com", human_id: "h1" },
          { email: "ANA@example.com", human_id: "h2" },
          { email: "", human_id: "h3" },
          { email: "not an email", human_id: "h4" },
          { email: "x@y.com?cc=evil@z.com", human_id: "h5" },
          { email: " bo@example.org ", human_id: "h6" },
        ],
        "me",
      ),
    ).toEqual(["ana@example.com", "bo@example.org"]);
  });
});

describe("buildNotesMailto recipients", () => {
  it("fills the To line from the attendees", () => {
    const { url } = buildNotesMailto({
      title: "Weekly sync",
      body: "Notes",
      truncatedNote: "",
      to: ["ana@example.com", "bo+team@example.org"],
    });
    expect(
      url.startsWith("mailto:ana%40example.com,bo%2Bteam%40example.org?"),
    ).toBe(true);
  });

  it("leaves the To line empty with no attendees", () => {
    const { url } = buildNotesMailto({
      title: "Weekly sync",
      body: "Notes",
      truncatedNote: "",
    });
    expect(url.startsWith("mailto:?subject=")).toBe(true);
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

  // Fork: the opener returns {status: "error"} rather than throwing.
  it("shows an error when the mail app can't open", async () => {
    mocks.openUrl.mockResolvedValueOnce({ status: "error", error: "denied" });
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    const { result } = renderHook(() =>
      useNoteShareActions("session-1", { type: "enhanced", id: "summary-1" }),
    );

    await act(() => result.current.sendNotesViaEmail());

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Couldn't open your mail app. Try again.",
    );
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

  // Fork test: task test, Oct 8 (a failed copy still said it worked).
  it("does not open a cut email when the full notes could not be copied", async () => {
    mocks.enhancedContent = Array.from(
      { length: 300 },
      (_, i) => `- Point ${i}`,
    ).join("\n");
    mocks.copyTextToClipboard.mockResolvedValueOnce(false);
    const { result } = renderHook(() =>
      useNoteShareActions("session-1", { type: "enhanced", id: "summary-1" }),
    );

    await act(() => result.current.sendNotesViaEmail());

    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Couldn't copy your full notes. Try again.",
    );
    expect(mocks.openUrl).not.toHaveBeenCalled();
  });
});
