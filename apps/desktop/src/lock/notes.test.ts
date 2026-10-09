import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(() => Promise.resolve(true)),
  concealNote: vi.fn(),
  markNoteRevealed: vi.fn(),
  updateSession: vi.fn(() => Promise.resolve()),
  toastError: vi.fn(),
}));

vi.mock("./store", () => ({
  useAppLock: {
    getState: () => ({
      authenticate: mocks.authenticate,
      concealNote: mocks.concealNote,
      markNoteRevealed: mocks.markNoteRevealed,
    }),
  },
}));

vi.mock("~/session/queries", () => ({
  updateSession: mocks.updateSession,
}));

vi.mock("@anlg/ui/components/ui/toast", () => ({
  toast: { error: mocks.toastError },
}));

import { toggleSessionLock } from "./notes";

describe("toggleSessionLock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("locks the note without a message when the save works", async () => {
    await toggleSessionLock("session-1", true);

    expect(mocks.updateSession).toHaveBeenCalledWith("session-1", {
      locked: true,
    });
    expect(mocks.concealNote).toHaveBeenCalledWith("session-1");
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("says the lock failed instead of looking locked", async () => {
    mocks.updateSession.mockRejectedValueOnce(new Error("disk full"));

    await toggleSessionLock("session-1", true);

    expect(mocks.concealNote).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Couldn't lock this note. Try again.",
    );
  });

  it("says the unlock failed", async () => {
    mocks.updateSession.mockRejectedValueOnce(new Error("disk full"));

    await toggleSessionLock("session-1", false);

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Couldn't unlock this note. Try again.",
    );
  });
});
