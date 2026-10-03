import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { beginCloudsyncActivity, endCloudsyncActivity } from "@anlg/plugin-db";

const mocks = vi.hoisted(() => ({
  audioPath: vi.fn(),
  handleBatchFailed: vi.fn(),
  queueAutoEnhanceIfSummaryEmpty: vi.fn(),
  runBatch: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@anlg/plugin-fs-sync", () => ({
  commands: { audioPath: mocks.audioPath },
}));

vi.mock("@anlg/ui/components/ui/toast", () => ({
  toast: { error: mocks.toastError },
}));

vi.mock("~/services/enhancer", () => ({
  getEnhancerService: () => ({
    queueAutoEnhanceIfSummaryEmpty: mocks.queueAutoEnhanceIfSummaryEmpty,
  }),
}));

vi.mock("~/stt/contexts", () => ({
  useListener: (selector: (state: unknown) => unknown) =>
    selector({ handleBatchFailed: mocks.handleBatchFailed }),
}));

vi.mock("~/stt/useRunBatch", () => ({
  isStoppedTranscriptionError: (error: unknown) =>
    error instanceof Error && error.message === "Transcription stopped.",
  useRunBatch: () => mocks.runBatch,
}));

import { useRegenerateTranscript } from "./actions";

describe("useRegenerateTranscript", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.audioPath.mockResolvedValue({
      status: "ok",
      data: "/tmp/session.wav",
    });
  });

  it("shows batch transcription failures even when an old transcript exists", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mocks.runBatch.mockRejectedValue(new Error("Authentication failed"));
    const { result } = renderHook(() => useRegenerateTranscript("session-1"));

    await act(async () => {
      await result.current();
    });

    expect(mocks.runBatch).toHaveBeenCalledWith("/tmp/session.wav", {
      promotion: { scope: "whole_session" },
    });
    expect(mocks.handleBatchFailed).toHaveBeenCalledWith(
      "session-1",
      "Authentication failed",
    );
    // Plain words and a next step; the raw error goes to the console only.
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Couldn't transcribe this recording again",
      {
        id: "transcript-regenerate-failed-session-1",
        description:
          "Try again, or pick another engine in Settings › Transcription.",
      },
    );
    expect(consoleError).toHaveBeenCalledWith(
      "[transcript] transcribe again failed",
      expect.objectContaining({ message: "Authentication failed" }),
    );
    consoleError.mockRestore();
  });

  it("keeps CloudSync deferred until summary scheduling settles", async () => {
    let finishSummaryScheduling: (() => void) | undefined;
    mocks.runBatch.mockResolvedValue(undefined);
    mocks.queueAutoEnhanceIfSummaryEmpty.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishSummaryScheduling = resolve;
      }),
    );
    const { result } = renderHook(() => useRegenerateTranscript("session-1"));

    const regeneration = result.current();
    await waitFor(() => {
      expect(mocks.queueAutoEnhanceIfSummaryEmpty).toHaveBeenCalledWith(
        "session-1",
      );
    });

    expect(beginCloudsyncActivity).toHaveBeenCalledWith(
      "transcription",
      expect.stringMatching(/^session-1:retranscription:/),
    );
    expect(endCloudsyncActivity).not.toHaveBeenCalled();

    finishSummaryScheduling?.();
    await act(async () => {
      await regeneration;
    });
    expect(endCloudsyncActivity).toHaveBeenCalledWith(
      "transcription",
      vi.mocked(beginCloudsyncActivity).mock.calls[0]?.[1],
    );
  });
});
