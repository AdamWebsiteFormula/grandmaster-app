import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  chatMode: "FloatingClosed" as
    | "FloatingClosed"
    | "FloatingOpen"
    | "RightPanelOpen",
  sendEvent: vi.fn(),
  platform: "macos",
}));

vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => mocks.platform }));

vi.mock("~/contexts/shell", () => ({
  useShell: () => ({
    chat: {
      mode: mocks.chatMode,
      sendEvent: mocks.sendEvent,
    },
  }),
}));

import { ChatCTA } from "./chat-cta";

describe("ChatCTA", () => {
  beforeEach(() => {
    cleanup();
    mocks.chatMode = "FloatingClosed";
    mocks.sendEvent.mockClear();
    mocks.platform = "macos";
  });

  // Microsoft Writing Style Guide, Keys and keyboard shortcuts.
  it("names Ctrl+J off a Mac", () => {
    mocks.platform = "linux";
    render(<ChatCTA />);

    const button = screen.getByRole("button", { name: "Ask anything" });
    expect(button.getAttribute("aria-keyshortcuts")).toBe("Control+J");
    expect(button.textContent).toContain("Ctrl+J");
    expect(button.textContent).not.toContain("⌘");
  });

  it("opens the floating chat", () => {
    render(<ChatCTA />);

    const button = screen.getByRole("button", {
      name: "Ask anything",
    });
    expect(button.getAttribute("aria-keyshortcuts")).toBe("Meta+J");
    expect(button.textContent).toContain("⌘J");

    fireEvent.click(button);

    expect(mocks.sendEvent).toHaveBeenCalledWith({ type: "OPEN" });
  });

  it.each(["FloatingOpen", "RightPanelOpen"] as const)(
    "hides while the %s chat is open",
    (chatMode) => {
      mocks.chatMode = chatMode;

      render(<ChatCTA />);

      expect(screen.queryByRole("button", { name: "Ask anything" })).toBeNull();
    },
  );
});
