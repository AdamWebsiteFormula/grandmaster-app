import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResumeRecordingButton } from "./resume-recording";

const mocks = vi.hoisted(() => ({
  isMainWebviewWindow: true,
  requestMainListenerControl: vi.fn(),
  startListening: vi.fn(),
}));

vi.mock("~/stt/contexts", () => ({
  useListener: (selector: (state: unknown) => unknown) =>
    selector({
      getSessionMode: () => "inactive",
      canStartLiveSession: () => true,
    }),
}));
vi.mock("~/stt/useStartListeningWithBatchOverride", () => ({
  useStartListeningWithBatchOverride: () => mocks.startListening,
}));
vi.mock("~/stt/window-control", () => ({
  isMainWebviewWindow: () => mocks.isMainWebviewWindow,
  requestMainListenerControl: mocks.requestMainListenerControl,
}));

// redline3 S3: Resume sits in the note bar and calls the existing start path.
describe("ResumeRecordingButton (note bar)", () => {
  beforeEach(() => {
    mocks.isMainWebviewWindow = true;
    mocks.requestMainListenerControl.mockClear();
    mocks.startListening.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("is a labeled segment inside the bar, not a positioned pill", () => {
    render(<ResumeRecordingButton sessionId="session-1" variant="bar" />);

    const resume = screen.getByRole("button", { name: "Resume recording" });
    expect(resume.textContent).toBe("Resume");
    expect(resume.className).toContain("h-8");
    expect(resume.className).not.toContain("absolute");
    expect(resume.className).not.toContain("left-4");
  });

  it("starts listening through the existing action in the main window", () => {
    render(<ResumeRecordingButton sessionId="session-1" variant="bar" />);

    fireEvent.click(screen.getByRole("button", { name: "Resume recording" }));
    expect(mocks.startListening).toHaveBeenCalledTimes(1);
    expect(mocks.requestMainListenerControl).not.toHaveBeenCalled();
  });

  it("asks the main window to resume from a standalone window", () => {
    mocks.isMainWebviewWindow = false;
    render(<ResumeRecordingButton sessionId="session-1" variant="bar" />);

    fireEvent.click(screen.getByRole("button", { name: "Resume recording" }));
    expect(mocks.requestMainListenerControl).toHaveBeenCalledWith(
      "start",
      "session-1",
    );
    expect(mocks.startListening).not.toHaveBeenCalled();
  });
});
