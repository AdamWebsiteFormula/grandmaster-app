import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
  openNew: vi.fn(),
  preloadSession: vi.fn(),
  live: { status: "inactive", sessionId: null as string | null },
}));

vi.mock("@anlg/ui/components/ui/toast", () => ({ toast: mocks.toast }));
vi.mock("~/store/zustand/tabs", () => ({
  useTabs: { getState: () => ({ openNew: mocks.openNew }) },
}));
vi.mock("~/store/zustand/listener/instance", () => ({
  listenerStore: { getState: () => ({ live: mocks.live }) },
}));
vi.mock("~/session/queries", () => ({
  preloadSession: mocks.preloadSession,
}));

import {
  refuseWhileAnotherNoteRecords,
  showRecordingDidNotStartToast,
  showStillRecordingToast,
} from "./recording-request-toasts";

// Fork tests: journey-meeting P1 and P2.
describe("recording request toasts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("says recording didn't start and offers Start recording on the same path", () => {
    showRecordingDidNotStartToast("session-1");

    const [title, options] = mocks.toast.error.mock.calls[0];
    expect(title).toBe("Recording didn't start");
    expect(options.description).toBe(
      "Transcription is still getting ready. Try again in a moment.",
    );
    expect(options.action.label).toBe("Start recording");

    options.action.onClick();
    expect(mocks.openNew).toHaveBeenCalledWith({
      type: "sessions",
      id: "session-1",
      state: { view: null, autoStart: true, scheduledAutoStart: null },
    });
  });

  it("names the note still recording and goes to it", async () => {
    mocks.preloadSession.mockResolvedValue({ title: "Design review" });

    showStillRecordingToast("live-1");

    await vi.waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    const [title, options] = mocks.toast.mock.calls[0];
    expect(title).toBe('Still recording "Design review"');
    expect(options.description).toBe("Stop it first to record this meeting.");
    expect(options.action.label).toBe("Go to recording");

    options.action.onClick();
    expect(mocks.openNew).toHaveBeenCalledWith({
      type: "sessions",
      id: "live-1",
    });
  });

  it("still says so when the live note has no title", async () => {
    mocks.preloadSession.mockResolvedValue({ title: "  " });

    showStillRecordingToast("live-1");

    await vi.waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.toast.mock.calls[0][0]).toBe("Still recording another note");
  });

  // Fork test: task test, Oct 8 (Start recording in a note did nothing
  // while another note recorded).
  it("refuses and says so while another note records", async () => {
    mocks.preloadSession.mockResolvedValue({ title: "Design review" });
    mocks.live = { status: "active", sessionId: "other" };
    expect(refuseWhileAnotherNoteRecords("session-1")).toBe(true);
    await vi.waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        'Still recording "Design review"',
        expect.anything(),
      ),
    );
  });

  it("lets the recording note and an idle app start", () => {
    mocks.live = { status: "active", sessionId: "session-1" };
    expect(refuseWhileAnotherNoteRecords("session-1")).toBe(false);
    mocks.live = { status: "inactive", sessionId: null };
    expect(refuseWhileAnotherNoteRecords("session-1")).toBe(false);
    expect(mocks.toast).not.toHaveBeenCalled();
  });
});
