import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listener: undefined as ((event: any) => void) | undefined,
  on: vi.fn(),
  toastWarning: vi.fn(),
  toastError: vi.fn(),
  tabsGetState: vi.fn(),
}));

vi.mock("@anlg/ui/components/ui/toast", () => ({
  toast: { warning: mocks.toastWarning, error: mocks.toastError },
}));

vi.mock("~/services/enhancer", () => ({
  getEnhancerService: () => ({ on: mocks.on }),
}));

vi.mock("~/store/zustand/tabs", () => ({
  useTabs: { getState: mocks.tabsGetState },
}));

import { useAutoEnhance } from "./useAutoEnhance";

describe("useAutoEnhance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listener = undefined;
    mocks.on.mockImplementation((listener) => {
      mocks.listener = listener;
      return vi.fn();
    });
  });

  it("shows why an automatic summary was skipped for a short transcript", () => {
    renderHook(() =>
      useAutoEnhance({ type: "sessions", id: "session-1" } as any),
    );

    act(() => {
      mocks.listener?.({
        type: "auto-enhance-skipped",
        sessionId: "session-1",
        reason:
          "Transcript too short to summarize (120/160 characters minimum)",
        reasonCode: "transcript_too_short",
      });
    });

    expect(mocks.toastWarning).toHaveBeenCalledWith(
      "Summary wasn't generated",
      {
        id: "auto-summary-too-short-session-1",
        description:
          "Transcript too short to summarize (120/160 characters minimum)",
      },
    );
  });

  // Fork tests: journey-meeting P2 (auto summary after Stop).
  it("says a failed automatic summary wasn't generated and how to recover", () => {
    renderHook(() =>
      useAutoEnhance({ type: "sessions", id: "session-1" } as any),
    );

    act(() => {
      mocks.listener?.({
        type: "auto-enhance-skipped",
        sessionId: "session-1",
        reason: "Could not generate the summary after repeated attempts.",
        reasonCode: "error",
      });
    });

    expect(mocks.toastError).toHaveBeenCalledWith("Summary wasn't generated", {
      id: "auto-summary-failed-session-1",
      description:
        "Upshot couldn't reach Upshot AI. Open the Summary and click Generate summary.",
    });
  });

  it("says Upshot AI is getting ready when there is no model", () => {
    renderHook(() =>
      useAutoEnhance({ type: "sessions", id: "session-1" } as any),
    );

    act(() => {
      mocks.listener?.({
        type: "auto-enhance-no-model",
        sessionId: "session-1",
      });
    });

    expect(mocks.toastError).toHaveBeenCalledWith("Summary wasn't generated", {
      id: "auto-summary-failed-session-1",
      description: "Upshot AI is getting ready. Try again in a minute.",
    });
  });

  it("ignores events for other notes", () => {
    renderHook(() =>
      useAutoEnhance({ type: "sessions", id: "session-1" } as any),
    );

    act(() => {
      mocks.listener?.({ type: "auto-enhance-no-model", sessionId: "other" });
    });

    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
