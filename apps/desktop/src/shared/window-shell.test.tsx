import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  platform: "windows",
  label: "main",
  close: vi.fn().mockResolvedValue(undefined),
  minimize: vi.fn().mockResolvedValue(undefined),
  toggleMaximize: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => mocks.platform }));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    label: mocks.label,
    close: mocks.close,
    isMaximized: vi.fn().mockResolvedValue(false),
    minimize: mocks.minimize,
    onResized: vi.fn().mockResolvedValue(vi.fn()),
    toggleMaximize: mocks.toggleMaximize,
  }),
}));

import { StandaloneWindowShell } from "./window-shell";

// Fork: Microsoft "Title bar" design guidance: minimize, maximize and close
// are always there. The main window has no OS title bar off a Mac.
describe("StandaloneWindowShell", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.platform = "windows";
    mocks.label = "main";
  });

  it.each(["windows", "linux"])(
    "gives onboarding in the main window caption buttons on %s",
    (os) => {
      mocks.platform = os;
      render(
        <StandaloneWindowShell>
          <h1>Welcome to Upshot</h1>
        </StandaloneWindowShell>,
      );

      fireEvent.click(screen.getByRole("button", { name: "Minimize" }));
      fireEvent.click(screen.getByRole("button", { name: "Maximize" }));
      fireEvent.click(screen.getByRole("button", { name: "Close" }));

      expect(mocks.minimize).toHaveBeenCalledOnce();
      expect(mocks.toggleMaximize).toHaveBeenCalledOnce();
      expect(mocks.close).toHaveBeenCalledOnce();
      // Top right, above the onboarding header (z-30).
      const controls = screen.getByRole("button", {
        name: "Minimize",
      }).parentElement?.parentElement;
      expect(controls?.className).toContain("top-0 right-0 z-50");
      expect(
        screen.getByRole("heading", { name: "Welcome to Upshot" }),
      ).toBeTruthy();
    },
  );

  it("adds none on a Mac, which keeps its traffic lights", () => {
    mocks.platform = "macos";
    render(
      <StandaloneWindowShell>
        <p>Onboarding</p>
      </StandaloneWindowShell>,
    );

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("adds none to other windows, which keep their OS title bar", () => {
    mocks.label = "note-1";
    render(
      <StandaloneWindowShell topDragRegion={false}>
        <p>Note</p>
      </StandaloneWindowShell>,
    );

    expect(screen.queryByRole("button")).toBeNull();
  });
});
