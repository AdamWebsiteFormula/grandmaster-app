import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCaptureHealthNotice,
  meterLevel,
  startThemSilence,
  THEM_SILENCE_MS,
  trackThemSilence,
  useCaptureHealthNotice,
} from "./capture-health";
import { CaptureHealthBanner } from "./recording-bar";

vi.mock("~/stt/contexts", () => ({ useListener: vi.fn() }));
vi.mock("~/stt/window-control", () => ({
  isMainWebviewWindow: () => true,
  requestMainListenerControl: vi.fn(),
}));
vi.mock("~/shared/hooks/usePermissions", () => ({ usePermission: vi.fn() }));

const LOUD = 0.05;

describe("silence rule", () => {
  it("stays quiet before 10 s of silence", () => {
    const state = startThemSilence(0);

    expect(getCaptureHealthNotice(state, THEM_SILENCE_MS - 1, "denied")).toBe(
      "none",
    );
  });

  it("warns about the permission after 10 s of silence when not authorized", () => {
    const state = startThemSilence(0);

    for (const status of ["denied", "neverRequested", undefined] as const) {
      expect(getCaptureHealthNotice(state, THEM_SILENCE_MS, status)).toBe(
        "permission",
      );
    }
  });

  it("shows only the soft hint when the permission is authorized", () => {
    const state = startThemSilence(0);

    expect(getCaptureHealthNotice(state, THEM_SILENCE_MS, "authorized")).toBe(
      "quiet",
    );
  });

  it("drops the soft hint once Them has been heard, since pauses are normal", () => {
    let state = startThemSilence(0);
    state = trackThemSilence(state, LOUD, 2_000);
    state = trackThemSilence(state, 0, 3_000);

    expect(
      getCaptureHealthNotice(state, 3_000 + THEM_SILENCE_MS, "authorized"),
    ).toBe("none");
    expect(
      getCaptureHealthNotice(state, 3_000 + THEM_SILENCE_MS, "denied"),
    ).toBe("permission");
  });

  it("resets the 10 s clock whenever Them makes a sound", () => {
    let state = startThemSilence(0);
    state = trackThemSilence(state, 0, 9_000);
    state = trackThemSilence(state, LOUD, 9_500);
    state = trackThemSilence(state, 0, 10_000);

    expect(getCaptureHealthNotice(state, 15_000, "denied")).toBe("none");
    expect(getCaptureHealthNotice(state, 20_000, "denied")).toBe("permission");
  });

  it("treats near-zero noise as silence", () => {
    const state = trackThemSilence(startThemSilence(0), 0.001, 1_000);

    expect(state).toEqual({ silentSince: 0, heardThem: false });
  });
});

describe("meterLevel", () => {
  it("lifts quiet speech and caps at full", () => {
    expect(meterLevel(0)).toBe(0);
    expect(meterLevel(0.02)).toBeCloseTo(0.316, 2);
    expect(meterLevel(0.2)).toBe(1);
    expect(meterLevel(0.9)).toBe(1);
  });
});

describe("useCaptureHealthNotice timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("raises the permission warning after 10 silent seconds", () => {
    const { result } = renderHook(
      ({ speaker }) => useCaptureHealthNotice(speaker, "denied"),
      { initialProps: { speaker: 0 } },
    );

    act(() => {
      vi.advanceTimersByTime(9_000);
    });
    expect(result.current).toBe("none");

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current).toBe("permission");
  });

  it("clears the warning as soon as Them is heard", () => {
    const { result, rerender } = renderHook(
      ({ speaker }) => useCaptureHealthNotice(speaker, "denied"),
      { initialProps: { speaker: 0 } },
    );

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current).toBe("permission");

    rerender({ speaker: LOUD });
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current).toBe("none");
  });

  it("counts a short burst between ticks as sound", () => {
    const { result, rerender } = renderHook(
      ({ speaker }) => useCaptureHealthNotice(speaker, "authorized"),
      { initialProps: { speaker: 0 } },
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });
    rerender({ speaker: LOUD });
    rerender({ speaker: 0 });
    act(() => {
      vi.advanceTimersByTime(20_000);
    });

    expect(result.current).toBe("none");
  });

  it("switches to the soft hint when the permission turns authorized", () => {
    const { result, rerender } = renderHook(
      ({ status }) => useCaptureHealthNotice(0, status),
      {
        initialProps: {
          status: "denied" as "denied" | "authorized",
        },
      },
    );

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current).toBe("permission");

    rerender({ status: "authorized" });
    expect(result.current).toBe("quiet");
  });
});

describe("CaptureHealthBanner", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders nothing when capture is healthy", () => {
    const { container } = render(
      <CaptureHealthBanner notice="none" onOpenSettings={vi.fn()} />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("opens System Settings from the permission warning", () => {
    const open = vi.fn().mockResolvedValue(undefined);
    render(<CaptureHealthBanner notice="permission" onOpenSettings={open} />);

    expect(screen.getByRole("alert").textContent).toContain(
      "Can't hear the other side. Check the system audio permission.",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Open System Settings" }),
    );
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("shows a soft hint without a button when authorized", () => {
    render(<CaptureHealthBanner notice="quiet" onOpenSettings={vi.fn()} />);

    expect(screen.getByRole("status").textContent).toBe(
      "No sound from the other side yet",
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});
