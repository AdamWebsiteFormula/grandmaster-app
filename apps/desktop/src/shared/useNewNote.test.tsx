import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  showStillRecordingToast: vi.fn(),
}));

vi.mock("~/session/queries", () => ({
  createSession: mocks.createSession,
}));

vi.mock("~/stt/recording-request-toasts", () => ({
  showStillRecordingToast: mocks.showStillRecordingToast,
}));

import {
  openSessionAndListen,
  useNewNote,
  useNewNoteAndListen,
} from "./useNewNote";

import { resetSidebarNotes, useSidebarNotes } from "~/sidebar/note-filter";
import { listenerStore } from "~/store/zustand/listener/instance";
import { useTabs } from "~/store/zustand/tabs";
import { resetTabsStore } from "~/store/zustand/tabs/test-utils";

beforeEach(() => {
  vi.clearAllMocks();
  resetTabsStore();
  resetSidebarNotes();
  listenerStore.setState(listenerStore.getInitialState(), true);
});

it("creates a note in the active sidebar folder", async () => {
  mocks.createSession.mockResolvedValueOnce("folder-session");
  useSidebarNotes.getState().setView("mine", "CS 101");
  const { result } = renderHook(() => useNewNote());

  act(() => result.current());

  await vi.waitFor(() => {
    expect(mocks.createSession).toHaveBeenCalledWith("", undefined, {
      folder_id: "CS 101",
    });
  });
});

it("makes one note when the button is clicked twice quickly", async () => {
  let finish: (id: string) => void = () => {};
  mocks.createSession.mockImplementationOnce(
    () => new Promise<string>((resolve) => (finish = resolve)),
  );
  const { result } = renderHook(() => useNewNote());

  act(() => {
    result.current();
    result.current();
  });
  finish("only-session");

  await vi.waitFor(() => {
    expect(useTabs.getState().currentTab).toMatchObject({
      type: "sessions",
      id: "only-session",
    });
  });
  expect(mocks.createSession).toHaveBeenCalledTimes(1);
});

it("can open a listening note without a listener provider", async () => {
  mocks.createSession.mockResolvedValueOnce("new-session");
  const { result } = renderHook(() => useNewNoteAndListen());

  act(() => result.current());

  await vi.waitFor(() => {
    expect(useTabs.getState().currentTab).toMatchObject({
      type: "sessions",
      id: "new-session",
      state: { autoStart: true, scheduledAutoStart: null },
    });
  });
});

it("reads the current live session when the handler runs", () => {
  const { result } = renderHook(() => useNewNoteAndListen());

  listenerStore.setState((state) => ({
    live: {
      ...state.live,
      status: "active",
      sessionId: "live-session",
    },
  }));
  act(() => result.current());

  expect(mocks.createSession).not.toHaveBeenCalled();
  expect(useTabs.getState().currentTab).toMatchObject({
    type: "sessions",
    id: "live-session",
  });
});

it("does not rearm auto-start when opening the active live session", () => {
  useTabs.getState().openNew({
    type: "sessions",
    id: "live-session",
    state: { view: null, autoStart: null },
  });
  listenerStore.setState((state) => ({
    live: {
      ...state.live,
      status: "active",
      sessionId: "live-session",
    },
  }));

  openSessionAndListen("live-session");

  expect(useTabs.getState().currentTab).toMatchObject({
    type: "sessions",
    id: "live-session",
    state: { autoStart: null },
  });
  expect(mocks.showStillRecordingToast).not.toHaveBeenCalled();
});

it("opens the requested session without auto-start while another is live", () => {
  listenerStore.setState((state) => ({
    live: {
      ...state.live,
      status: "active",
      sessionId: "live-session",
    },
  }));

  openSessionAndListen("calendar-session");

  expect(useTabs.getState().currentTab).toMatchObject({
    type: "sessions",
    id: "calendar-session",
    state: { autoStart: null },
  });
});

// Fork test: journey-meeting P2 (another meeting already recording).
it("says which note is still recording when another meeting is asked to record", () => {
  listenerStore.setState((state) => ({
    live: {
      ...state.live,
      status: "active",
      sessionId: "live-session",
    },
  }));

  openSessionAndListen("calendar-session");

  expect(mocks.showStillRecordingToast).toHaveBeenCalledWith("live-session");
});
