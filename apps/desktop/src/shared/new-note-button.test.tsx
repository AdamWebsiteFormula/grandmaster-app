import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NewNoteButton } from "./new-note-button";

const mocks = vi.hoisted(() => ({
  newNoteAndListen: vi.fn(),
  status: "inactive",
}));

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
});
