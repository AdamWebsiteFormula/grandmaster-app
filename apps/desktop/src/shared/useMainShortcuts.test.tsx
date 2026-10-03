import { cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  newNote: vi.fn(),
  newNoteCurrent: vi.fn(),
  newNoteAndListen: vi.fn(),
  startNewChat: vi.fn(),
  currentTab: { type: "sessions" } as { type: string } | null,
}));

vi.mock("@anlg/ui/hooks/use-mount-effect", () => ({
  useMountEffect: vi.fn(),
}));
vi.mock("~/contexts/shell", () => ({
  useShell: () => ({
    chat: {
      mode: "FloatingClosed",
      sendEvent: vi.fn(),
      startNewChat: mocks.startNewChat,
    },
  }),
}));
vi.mock("~/shared/leave-overlay-tab", () => ({ leaveOverlayTab: vi.fn() }));
vi.mock("~/shared/useNewNote", () => ({
  useNewNote: ({ behavior }: { behavior?: string } = {}) =>
    behavior === "current" ? mocks.newNoteCurrent : mocks.newNote,
  useNewNoteAndListen: () => mocks.newNoteAndListen,
}));
vi.mock("~/store/zustand/tabs", () => ({
  useTabs: (selector: (state: unknown) => unknown) =>
    selector({ currentTab: mocks.currentTab }),
}));

import { useMainShortcuts } from "./useMainShortcuts";

function press(init: KeyboardEventInit) {
  fireEvent.keyDown(document, init);
  fireEvent.keyUp(document, init);
}

describe("useMainShortcuts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentTab = { type: "sessions" };
  });
  afterEach(cleanup);

  // UX audit Oct 3, A: ⌘N is New note (records), as the button and Granola.
  it("⌘N creates a note and starts recording", () => {
    renderHook(() => useMainShortcuts());

    press({ key: "n", code: "KeyN", metaKey: true });

    expect(mocks.newNoteAndListen).toHaveBeenCalledTimes(1);
    expect(mocks.newNote).not.toHaveBeenCalled();
  });

  it("⇧⌘N creates a blank note without recording", () => {
    renderHook(() => useMainShortcuts());

    press({ key: "N", code: "KeyN", metaKey: true, shiftKey: true });

    expect(mocks.newNote).toHaveBeenCalledTimes(1);
    expect(mocks.newNoteAndListen).not.toHaveBeenCalled();
  });
});
