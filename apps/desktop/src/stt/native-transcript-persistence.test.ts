import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  flushLiveTranscript: vi.fn(),
  listen: vi.fn(),
  releaseLiveTranscript: vi.fn(),
}));

vi.mock("@anlg/plugin-transcription", () => ({
  commands: {
    flushLiveTranscript: mocks.flushLiveTranscript,
    releaseLiveTranscript: mocks.releaseLiveTranscript,
  },
  events: {
    liveTranscriptPersistenceEvent: { listen: mocks.listen },
  },
}));

import type { LiveTranscriptPersistence } from "@anlg/plugin-transcription";

import { createNativeTranscriptPersistence } from "./native-transcript-persistence";

const status: LiveTranscriptPersistence = {
  session_id: "session-1",
  transcript_id: "transcript-1",
  transcript_created: true,
  persisted_through_ms: 600,
  error: null,
};

describe("createNativeTranscriptPersistence", () => {
  let emit: (event: {
    payload: { status: LiveTranscriptPersistence };
  }) => void = () => {};

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listen.mockImplementation((handler) => {
      emit = handler;
      return Promise.resolve(vi.fn());
    });
    mocks.flushLiveTranscript.mockResolvedValue({
      status: "ok",
      data: status,
    });
    mocks.releaseLiveTranscript.mockResolvedValue({
      status: "ok",
      data: null,
    });
  });

  it("filters persistence events and applies status from native flush", async () => {
    const onPersisted = vi.fn();
    const onError = vi.fn();
    const afterFlush = vi.fn(async () => undefined);
    let resolveNativeFlush:
      | ((result: { status: "ok"; data: LiveTranscriptPersistence }) => void)
      | undefined;
    mocks.flushLiveTranscript.mockImplementationOnce(
      () =>
        new Promise<{ status: "ok"; data: LiveTranscriptPersistence }>(
          (resolve) => {
            resolveNativeFlush = resolve;
          },
        ),
    );
    const persistence = createNativeTranscriptPersistence({
      sessionId: "session-1",
      transcriptId: "transcript-1",
      onPersisted,
      onError,
      afterFlush,
    });
    await Promise.resolve();

    emit({
      payload: {
        status: { ...status, session_id: "another-session" },
      },
    });
    emit({
      payload: {
        status: { ...status, transcript_id: "another-transcript" },
      },
    });
    expect(onPersisted).not.toHaveBeenCalled();

    const flush = persistence.flush();
    await Promise.resolve();
    expect(afterFlush).not.toHaveBeenCalled();
    resolveNativeFlush?.({ status: "ok", data: status });
    await flush;

    expect(mocks.flushLiveTranscript).toHaveBeenCalledWith("session-1");
    expect(onPersisted).toHaveBeenCalledWith(status);
    expect(afterFlush).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
    expect(persistence.hasPendingFailure()).toBe(false);

    emit({
      payload: {
        status: { ...status, error: "database is locked" },
      },
    });
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(persistence.hasPendingFailure()).toBe(true);

    persistence.dispose();
    expect(mocks.releaseLiveTranscript).toHaveBeenCalledWith(
      "session-1",
      "transcript-1",
    );
  });

  it("does not compact after native flush reports a persistence failure", async () => {
    mocks.flushLiveTranscript.mockResolvedValue({
      status: "ok",
      data: { ...status, error: "disk full" },
    });
    const onError = vi.fn();
    const afterFlush = vi.fn(async () => undefined);
    const persistence = createNativeTranscriptPersistence({
      sessionId: "session-1",
      transcriptId: "transcript-1",
      onPersisted: vi.fn(),
      onError,
      afterFlush,
    });

    await persistence.flush();

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(afterFlush).not.toHaveBeenCalled();
    expect(persistence.hasPendingFailure()).toBe(true);
    persistence.dispose();
  });
});
