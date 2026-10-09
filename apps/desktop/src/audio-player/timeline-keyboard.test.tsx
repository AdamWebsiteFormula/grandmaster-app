import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ seek: vi.fn() }));

vi.mock("./provider", () => ({
  useAudioPlayer: () => ({
    registerContainer: vi.fn(),
    state: "paused",
    pause: vi.fn(),
    resume: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    playbackRate: 1,
    setPlaybackRate: vi.fn(),
    requestDeleteRecording: vi.fn(),
    isDeletingRecording: false,
    seek: mocks.seek,
  }),
  useAudioTime: () => ({ current: 10, total: 60 }),
}));
vi.mock("~/auth/billing-context", () => ({
  useBillingAccess: () => ({ isPro: false }),
}));
vi.mock("~/shared/hooks/useNativeContextMenu", () => ({
  useNativeContextMenu: () => vi.fn(),
}));

import { Timeline } from "./timeline";

// Fork tests: task test, Oct 9 (the waveform was mouse-only).
describe("Timeline keyboard seeking", () => {
  beforeEach(() => mocks.seek.mockClear());
  afterEach(cleanup);

  it("is a named slider that reports where playback is", () => {
    render(<Timeline />);
    const slider = screen.getByRole("slider", { name: "Playback position" });
    expect(slider.getAttribute("tabindex")).toBe("0");
    expect(slider.getAttribute("aria-valuenow")).toBe("10");
    expect(slider.getAttribute("aria-valuemax")).toBe("60");
  });

  it("moves 5 seconds with the arrows and to the ends with Home and End", () => {
    render(<Timeline />);
    const slider = screen.getByRole("slider", { name: "Playback position" });

    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(mocks.seek).toHaveBeenLastCalledWith(15);
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(mocks.seek).toHaveBeenLastCalledWith(5);
    fireEvent.keyDown(slider, { key: "Home" });
    expect(mocks.seek).toHaveBeenLastCalledWith(0);
    fireEvent.keyDown(slider, { key: "End" });
    expect(mocks.seek).toHaveBeenLastCalledWith(60);
  });
});
