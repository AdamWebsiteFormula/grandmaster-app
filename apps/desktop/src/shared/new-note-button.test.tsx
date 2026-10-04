import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NewNoteButton } from "./new-note-button";

const mocks = vi.hoisted(() => ({
  newNoteAndListen: vi.fn(),
  status: "inactive",
  platform: "macos",
}));

vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => mocks.platform }));

vi.mock("~/shared/useNewNote", () => ({
  useNewNoteAndListen: () => mocks.newNoteAndListen,
}));
vi.mock("~/stt/contexts", () => ({
  useListener: (selector: (state: unknown) => unknown) =>
    selector({ live: { status: mocks.status } }),
}));

describe("NewNoteButton", () => {
  afterEach(() => {
    cleanup();
    mocks.status = "inactive";
    mocks.platform = "macos";
    mocks.newNoteAndListen.mockClear();
  });

  it("creates a note and starts recording", () => {
    render(<NewNoteButton />);

    fireEvent.click(screen.getByRole("button", { name: "New note" }));

    expect(mocks.newNoteAndListen).toHaveBeenCalledTimes(1);
  });

  it("uses the accent when idle", () => {
    render(<NewNoteButton />);

    expect(screen.getByRole("button").className).toContain("bg-primary");
  });

  it("steps back to neutral while recording", () => {
    mocks.status = "active";
    render(<NewNoteButton />);

    const className = screen.getByRole("button").className;
    expect(className).toContain("bg-secondary");
    expect(className).not.toContain("bg-primary ");
  });

  // Fork test: journey-meeting P3, the label matches what a click does.
  it("says Back to recording while recording, and goes there", () => {
    mocks.status = "active";
    render(<NewNoteButton />);

    const button = screen.getByRole("button", { name: "Back to recording" });
    expect(button.getAttribute("title")).toBe("Go to the note being recorded");
    fireEvent.click(button);
    expect(mocks.newNoteAndListen).toHaveBeenCalledTimes(1);
  });

  it("names the shortcut when idle", () => {
    render(<NewNoteButton />);

    expect(screen.getByRole("button").getAttribute("title")).toBe(
      "New note and start recording (⌘N)",
    );
  });

  // Microsoft Writing Style Guide, Keys and keyboard shortcuts.
  it("names Ctrl+N off a Mac", () => {
    mocks.platform = "windows";
    render(<NewNoteButton />);

    expect(screen.getByRole("button").getAttribute("title")).toBe(
      "New note and start recording (Ctrl+N)",
    );
  });
});
