import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  listen: vi.fn(),
  stop: vi.fn(),
  live: { sessionId: "live-1", status: "active", loading: false } as {
    sessionId: string | null;
    status: string;
    loading: boolean;
  },
  emitTo: vi.fn(async () => {}),
  stopCaptureForSession: vi.fn(async () => ({ status: "ok", data: true })),
}));

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: hoisted.emitTo,
  listen: hoisted.listen,
}));

vi.mock("@anlg/plugin-transcription", () => ({
  commands: {
    stopCaptureForSession: hoisted.stopCaptureForSession,
  },
}));

vi.mock("@anlg/plugin-windows", () => ({
  getCurrentWebviewWindowLabel: () => "note-1",
}));

vi.mock("./contexts", () => ({
  useListener: (selector: (state: unknown) => unknown) =>
    selector({ stop: hoisted.stop }),
}));
vi.mock("./useStartListeningWithBatchOverride", () => ({
  useStartListeningWithBatchOverride: vi.fn(),
}));
vi.mock("~/store/zustand/listener/instance", () => ({
  listenerStore: { getState: () => ({ live: hoisted.live }) },
}));

import { act, cleanup, render } from "@testing-library/react";
import { createElement } from "react";

import {
  MainListenerControlBridge,
  requestMainListenerControl,
} from "./window-control";

describe("requestMainListenerControl", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    hoisted.emitTo.mockClear();
    hoisted.stopCaptureForSession.mockClear();
  });

  test("asks the main webview first, then stops that session natively", async () => {
    const request = requestMainListenerControl("stop", "session-1");

    expect(hoisted.emitTo).toHaveBeenCalledWith(
      "main",
      "anlg:listener-control",
      expect.objectContaining({ action: "stop", sessionId: "session-1" }),
    );
    expect(hoisted.stopCaptureForSession).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();
    await request;

    expect(hoisted.stopCaptureForSession).toHaveBeenCalledTimes(1);
    expect(hoisted.stopCaptureForSession).toHaveBeenCalledWith("session-1");
  });

  test("stops natively when the main window cannot be reached", async () => {
    hoisted.emitTo.mockRejectedValueOnce(new Error("window not found"));

    const request = requestMainListenerControl("stop", "session-1");
    await vi.runAllTimersAsync();
    await request;

    expect(hoisted.stopCaptureForSession).toHaveBeenCalledWith("session-1");
  });

  test("still routes start requests to the main webview", async () => {
    await requestMainListenerControl("start", "session-1");

    expect(hoisted.emitTo).toHaveBeenCalledWith(
      "main",
      "anlg:listener-control",
      expect.objectContaining({ action: "start", sessionId: "session-1" }),
    );
    expect(hoisted.stopCaptureForSession).not.toHaveBeenCalled();
  });
});

// Fork tests: journey-meeting P3 (tray Stop recording sends an empty id).
describe("MainListenerControlBridge", () => {
  afterEach(cleanup);

  const deliver = async (sessionId: string) => {
    let handler: ((event: { payload: unknown }) => void) | undefined;
    hoisted.listen.mockImplementation(async (_name, callback) => {
      handler = callback;
      return () => {};
    });
    render(createElement(MainListenerControlBridge));
    await act(async () => {});
    await act(async () => {
      handler?.({
        payload: { action: "stop", requestId: "tray-stop-1", sessionId },
      });
    });
  };

  beforeEach(() => {
    hoisted.stop.mockClear();
    hoisted.live = { sessionId: "live-1", status: "active", loading: false };
  });

  test("stops the live note when the tray sends no session id", async () => {
    await deliver("");
    expect(hoisted.stop).toHaveBeenCalledTimes(1);
  });

  test("does nothing for an empty id when nothing records", async () => {
    hoisted.live = { sessionId: null, status: "inactive", loading: false };
    await deliver("");
    expect(hoisted.stop).not.toHaveBeenCalled();
  });

  test("still ignores a stop for a different note", async () => {
    await deliver("other-note");
    expect(hoisted.stop).not.toHaveBeenCalled();
  });
});
