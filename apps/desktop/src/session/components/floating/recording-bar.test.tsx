import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CaptureHealthNotice } from "./capture-health";
import {
  CaptureHealthBanner,
  formatElapsed,
  RecordingBar,
} from "./recording-bar";

const mocks = vi.hoisted(() => ({
  isMainWebviewWindow: true,
  mode: "active",
  muted: false,
  seconds: 0,
  requestMainListenerControl: vi.fn(),
  stop: vi.fn(),
  resume: vi.fn(),
  platform: "macos",
  notice: "none" as CaptureHealthNotice,
}));

vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => mocks.platform }));

vi.mock("./capture-health", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./capture-health")>()),
  useCaptureHealthNotice: () => mocks.notice,
}));

vi.mock("~/stt/useStartListeningWithBatchOverride", () => ({
  useStartListeningWithBatchOverride: () => mocks.resume,
}));

vi.mock("~/stt/contexts", () => ({
  useListener: (selector: (state: unknown) => unknown) =>
    selector({
      getSessionMode: () => mocks.mode,
      canStartLiveSession: () => true,
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
    mocks.notice = "none";
    mocks.requestMainListenerControl.mockClear();
    mocks.stop.mockClear();
    mocks.resume.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  // Fork: the open chat covers the notice spot, so the soft hint waits
  // under it, still mounted (NN/g #8).
  it("holds the quiet hint while the chat covers it", () => {
    mocks.notice = "quiet";
    const view = render(<RecordingBar sessionId="session-1" holdQuietHint />);
    const hint = () => screen.getByText("No sound from the other side yet");
    expect(hint().closest("[hidden]")).not.toBeNull();

    view.rerender(<RecordingBar sessionId="session-1" />);
    expect(hint().closest("[hidden]")).toBeNull();
  });

  // Fork: the red alert never waits, so it is seen or announced (NN/g #1;
  // WCAG 2.2 SC 4.1.3).
  it("keeps the red alert while the chat is open", () => {
    mocks.notice = "permission";
    render(<RecordingBar sessionId="session-1" holdQuietHint />);
    expect(screen.getByRole("alert").closest("[hidden]")).toBeNull();
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

  // Fork tests: journey-meeting P1 (Resume), P2 (live region), P3 (shadow).
  // redline3 S3: Resume moved into the note bar; no far-left pill.
  it("shows no separate Resume pill once recording stops", () => {
    mocks.mode = "inactive";
    const { container } = render(<RecordingBar sessionId="session-1" />);

    expect(
      screen.queryByRole("button", { name: "Resume recording" }),
    ).toBeNull();
    expect(container.querySelector("[data-resume-recording]")).toBeNull();
    expect(mocks.resume).not.toHaveBeenCalled();
  });

  it("announces only the label, not the ticking timer and meters", () => {
    const view = render(<RecordingBar sessionId="session-1" />);

    const bar = view.container.querySelector("[data-recording-bar]")!;
    expect(bar.getAttribute("role")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Recording");
    expect(screen.getByRole("timer")).toBeTruthy();
  });

  it("separates the pill from the note with a light-only shadow", () => {
    const view = render(<RecordingBar sessionId="session-1" />);

    const bar = view.container.querySelector("[data-recording-bar]")!;
    expect(bar.className).toContain("shadow-sm");
    expect(bar.className).toContain("dark:shadow-none");
  });

  // Fork: the same surface as the note bar beside it (NN/g #4).
  it("uses the note bar's card fill and field border", () => {
    const view = render(<RecordingBar sessionId="session-1" />);

    const bar = view.container.querySelector("[data-recording-bar]")!;
    expect(bar.className).toContain("border-input");
    expect(bar.className).toContain("bg-card");
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

// Fork: only a Mac has a system audio permission and a System Settings
// pane to open (NN/g heuristic #5: no control that cannot work).
describe("CaptureHealthBanner off a Mac", () => {
  afterEach(() => {
    cleanup();
    mocks.platform = "macos";
  });

  it.each(["windows", "linux"])(
    "points at the sound output and offers no System Settings on %s",
    (os) => {
      mocks.platform = os;
      render(
        <CaptureHealthBanner notice="permission" onOpenSettings={vi.fn()} />,
      );

      expect(screen.getByRole("alert").textContent).toBe(
        "Can't hear the other side. Check your computer's sound output.",
      );
      expect(screen.queryByRole("button")).toBeNull();
    },
  );

  it("keeps Open System Settings on a Mac", () => {
    render(
      <CaptureHealthBanner notice="permission" onOpenSettings={vi.fn()} />,
    );

    expect(
      screen.getByRole("button", { name: "Open System Settings" }),
    ).toBeTruthy();
  });
});

describe("formatElapsed", () => {
  it("pads minutes and seconds", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(59)).toBe("00:59");
  });

  // Fork: journey-meeting P3, h:mm:ss past an hour.
  it("shows hours past an hour", () => {
    expect(formatElapsed(3599)).toBe("59:59");
    expect(formatElapsed(3600)).toBe("1:00:00");
    expect(formatElapsed(4512)).toBe("1:15:12");
  });
});
