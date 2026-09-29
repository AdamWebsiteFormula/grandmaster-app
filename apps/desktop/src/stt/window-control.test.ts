import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  emitTo: vi.fn(async () => {}),
  getCaptureSnapshot: vi.fn(),
  stopCapture: vi.fn(async () => ({ status: "ok", data: null })),
}));

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: hoisted.emitTo,
  listen: vi.fn(),
}));

vi.mock("@anlg/plugin-transcription", () => ({
  commands: {
    getCaptureSnapshot: hoisted.getCaptureSnapshot,
    stopCapture: hoisted.stopCapture,
  },
}));

vi.mock("@anlg/plugin-windows", () => ({
  getCurrentWebviewWindowLabel: () => "note-1",
}));

vi.mock("./contexts", () => ({ useListener: vi.fn() }));
vi.mock("./useStartListeningWithBatchOverride", () => ({
  useStartListeningWithBatchOverride: vi.fn(),
}));
vi.mock("~/store/zustand/listener/instance", () => ({
  listenerStore: { getState: vi.fn() },
}));

import { requestMainListenerControl } from "./window-control";

describe("requestMainListenerControl", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    hoisted.emitTo.mockClear();
    hoisted.getCaptureSnapshot.mockReset();
    hoisted.stopCapture.mockClear();
  });

  test("stops the native capture when the main webview does not", async () => {
    hoisted.getCaptureSnapshot.mockResolvedValue({
      status: "ok",
      data: { activeSessionId: "session-1", finalizingSessionIds: [] },
    });

    const request = requestMainListenerControl("stop", "session-1");
    await vi.runAllTimersAsync();
    await request;

    expect(hoisted.emitTo).toHaveBeenCalledWith(
      "main",
      "anlg:listener-control",
      expect.objectContaining({ action: "stop", sessionId: "session-1" }),
    );
    expect(hoisted.stopCapture).toHaveBeenCalledTimes(1);
  });

  test("stops natively when the main window cannot be reached", async () => {
    hoisted.emitTo.mockRejectedValueOnce(new Error("window not found"));
    hoisted.getCaptureSnapshot.mockResolvedValue({
      status: "ok",
      data: { activeSessionId: "session-1", finalizingSessionIds: [] },
    });

    const request = requestMainListenerControl("stop", "session-1");
    await vi.runAllTimersAsync();
    await request;

    expect(hoisted.stopCapture).toHaveBeenCalledTimes(1);
  });

  test("leaves the stop to the main webview when it already stopped", async () => {
    hoisted.getCaptureSnapshot.mockResolvedValue({
      status: "ok",
      data: { activeSessionId: null, finalizingSessionIds: ["session-1"] },
    });

    const request = requestMainListenerControl("stop", "session-1");
    await vi.runAllTimersAsync();
    await request;

    expect(hoisted.stopCapture).not.toHaveBeenCalled();
  });

  test("does not stop a different active capture", async () => {
    hoisted.getCaptureSnapshot.mockResolvedValue({
      status: "ok",
      data: { activeSessionId: "session-2", finalizingSessionIds: [] },
    });

    const request = requestMainListenerControl("stop", "session-1");
    await vi.runAllTimersAsync();
    await request;

    expect(hoisted.stopCapture).not.toHaveBeenCalled();
  });

  test("still routes start requests to the main webview", async () => {
    await requestMainListenerControl("start", "session-1");

    expect(hoisted.emitTo).toHaveBeenCalledWith(
      "main",
      "anlg:listener-control",
      expect.objectContaining({ action: "start", sessionId: "session-1" }),
    );
    expect(hoisted.getCaptureSnapshot).not.toHaveBeenCalled();
  });
});
