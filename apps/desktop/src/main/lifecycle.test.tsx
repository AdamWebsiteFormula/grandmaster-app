import { renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  openNew: vi.fn(),
  takePendingWelcomeSession: vi.fn(),
  options: null as null | {
    onInitialized: () => void;
    onEmpty: () => void;
  },
}));

vi.mock("~/shared/desktop-tab-lifecycle", () => ({
  useDesktopTabLifecycle: (options: typeof mocks.options) => {
    mocks.options = options;
  },
}));
vi.mock("~/store/zustand/tabs", () => ({
  useTabs: (select: (state: { openNew: typeof mocks.openNew }) => unknown) =>
    select({ openNew: mocks.openNew }),
}));
vi.mock("./move-to-applications", () => ({
  promptMoveToApplications: vi.fn(async () => {}),
}));
vi.mock("~/onboarding/welcome-note", () => ({
  takePendingWelcomeSession: mocks.takePendingWelcomeSession,
}));

import { useClassicMainLifecycle } from "./lifecycle";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.options = null;
});

// Journey-first-run P1: after the onboarding relaunch, land on Home.
it("opens Home, not the Welcome note, after the onboarding relaunch", () => {
  mocks.takePendingWelcomeSession.mockReturnValue("welcome-session");
  renderHook(() => useClassicMainLifecycle());

  mocks.options!.onInitialized();
  expect(mocks.openNew).toHaveBeenCalledWith({ type: "empty" });
  expect(mocks.openNew).not.toHaveBeenCalledWith(
    expect.objectContaining({ type: "sessions" }),
  );
});

it("opens nothing extra on a normal launch", () => {
  mocks.takePendingWelcomeSession.mockReturnValue(null);
  renderHook(() => useClassicMainLifecycle());

  mocks.options!.onInitialized();
  expect(mocks.openNew).not.toHaveBeenCalled();
});
