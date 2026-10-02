import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RecordingBar } from "./recording-bar";

const mocks = vi.hoisted(() => ({
  isMainWebviewWindow: true,
  mode: "active",
  requestMainListenerControl: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("~/stt/contexts", () => ({
  useListener: (selector: (state: unknown) => unknown) =>
    selector({
      getSessionMode: () => mocks.mode,
      live: { amplitude: { mic: 0, speaker: 0 }, muted: false },
      stop: mocks.stop,
    }),
}));
vi.mock("~/stt/window-control", () => ({
  isMainWebviewWindow: () => mocks.isMainWebviewWindow,
  requestMainListenerControl: mocks.requestMainListenerControl,
}));
vi.mock("~/shared/hooks/usePermissions", () => ({
  usePermission: () => ({ confirmedStatus: "authorized", open: vi.fn() }),
}));

describe("RecordingBar", () => {
  beforeEach(() => {
    mocks.isMainWebviewWindow = true;
    mocks.mode = "active";
    mocks.requestMainListenerControl.mockClear();
    mocks.stop.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders nothing when the note is not recording", () => {
    mocks.mode = "inactive";
    render(<RecordingBar sessionId="session-1" />);

    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
  });

  it("stops listening from the stop button", () => {
    render(<RecordingBar sessionId="session-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Stop" }));

    expect(mocks.stop).toHaveBeenCalledTimes(1);
  });

  it("delegates stop to the main window from standalone windows", () => {
    mocks.isMainWebviewWindow = false;
    render(<RecordingBar sessionId="session-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Stop" }));

    expect(mocks.requestMainListenerControl).toHaveBeenCalledWith(
      "stop",
      "session-1",
    );
    expect(mocks.stop).not.toHaveBeenCalled();
  });
});
