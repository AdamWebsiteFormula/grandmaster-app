import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatElapsed, RecordingBar } from "./recording-bar";

const mocks = vi.hoisted(() => ({
  isMainWebviewWindow: true,
  mode: "active",
  muted: false,
  seconds: 0,
  requestMainListenerControl: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("~/stt/contexts", () => ({
  useListener: (selector: (state: unknown) => unknown) =>
    selector({
      getSessionMode: () => mocks.mode,
      live: {
        amplitude: { mic: 0, speaker: 0 },
        muted: mocks.muted,
        seconds: mocks.seconds,
      },
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
    mocks.muted = false;
    mocks.seconds = 0;
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

  it("shows the elapsed recording time as mm:ss", () => {
    mocks.seconds = 125;
    render(<RecordingBar sessionId="session-1" />);

    expect(screen.getByLabelText("Recording time").textContent).toBe("02:05");
  });

  it("says the mic is muted, not that recording stopped", () => {
    mocks.muted = true;
    render(<RecordingBar sessionId="session-1" />);

    const label = screen.getByText("Your mic is muted");
    expect(label.getAttribute("title")).toBe(
      "Unmute in your call to be recorded",
    );
  });

  it.each(["finalizing", "running_batch"])(
    "shows Finishing transcript without Stop while %s",
    (mode) => {
      mocks.mode = mode;
      render(<RecordingBar sessionId="session-1" />);

      expect(screen.getByRole("status").textContent).toContain(
        "Finishing transcript…",
      );
      expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
    },
  );
});

describe("formatElapsed", () => {
  it("pads minutes and seconds", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(59)).toBe("00:59");
    expect(formatElapsed(3600)).toBe("60:00");
  });
});
