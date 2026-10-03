import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  upNext: { isLoading: false, event: null as unknown },
  followUps: [] as unknown[],
  recent: {
    isLoading: false,
    hasNotes: true,
    groups: [] as unknown[],
    hasMore: false,
  },
  recentLimits: [] as number[],
  calendarStatus: "authorized" as string | undefined,
  openNew: vi.fn(),
  revealLockedNote: vi.fn(async () => true),
  getOrCreateSessionForEventId: vi.fn(async () => "session-1"),
  openSessionAndListen: vi.fn(),
  openNewNoteAndListen: vi.fn(),
  openCurrent: vi.fn(),
  setFollowUpDone: vi.fn(async () => {}),
}));

vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => "macos" }));

vi.mock("./home-data", () => ({
  useUpNext: () => mocks.upNext,
  useFollowUps: () => ({ isLoading: false, items: mocks.followUps }),
  useRecentNotes: (limit: number) => {
    mocks.recentLimits.push(limit);
    return mocks.recent;
  },
  setFollowUpDone: mocks.setFollowUpDone,
  RECENT_PAGE_SIZE: 20,
}));

vi.mock("~/shared/hooks/usePermissions", () => ({
  usePermission: () => ({ status: mocks.calendarStatus }),
}));

vi.mock("~/lock/notes", () => ({ revealLockedNote: mocks.revealLockedNote }));

vi.mock("~/sidebar/timeline/item", () => ({
  useSessionContextMenu: () => [],
}));

vi.mock("~/shared/ui/interactive-button", () => ({
  InteractiveButton: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick: () => void;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  ),
}));

vi.mock("~/session/queries", () => ({
  getOrCreateSessionForEventId: mocks.getOrCreateSessionForEventId,
}));

vi.mock("~/shared/hooks/useTimeFormat", () => ({
  useTimeFormat: () => "h:mm a",
}));

vi.mock("~/shared/useNewNote", () => ({
  useNewNote: () => vi.fn(),
  openNewNoteAndListen: mocks.openNewNoteAndListen,
  openSessionAndListen: mocks.openSessionAndListen,
}));

vi.mock("~/store/zustand/tabs", () => ({
  useTabs: (
    selector: (state: {
      openCurrent: () => void;
      openNew: () => void;
    }) => unknown,
  ) => selector({ openCurrent: mocks.openCurrent, openNew: mocks.openNew }),
}));

import { HomeView } from "./home-view";

const time = (hour: number, minute = 0) =>
  new Date(2026, 9, 3, hour, minute).getTime();

describe("HomeView", () => {
  beforeEach(() => {
    mocks.upNext = { isLoading: false, event: null };
    mocks.followUps = [];
    mocks.recent = {
      isLoading: false,
      hasNotes: true,
      groups: [],
      hasMore: false,
    };
    mocks.recentLimits = [];
    mocks.calendarStatus = "authorized";
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it("shows the next meeting and records it", async () => {
    mocks.upNext.event = {
      id: "event-1",
      title: "Design review",
      startMs: time(14),
      endMs: time(15),
      attendees: 3,
      when: "today",
    };
    render(<HomeView />);

    expect(screen.getByText("Design review")).toBeTruthy();
    expect(screen.getByText("Today, 2:00 PM · 3 people")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    await vi.waitFor(() =>
      expect(mocks.openSessionAndListen).toHaveBeenCalledWith("session-1", {
        behavior: "current",
      }),
    );
    expect(mocks.getOrCreateSessionForEventId).toHaveBeenCalledWith(
      "event-1",
      "Design review",
    );
  });

  it("offers Record now when nothing is scheduled", () => {
    render(<HomeView />);

    expect(screen.getByText("No meetings coming up")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Record now" }));
    expect(mocks.openNewNoteAndListen).toHaveBeenCalledWith({
      behavior: "current",
    });
  });

  it("asks to connect the calendar when access is off", () => {
    mocks.calendarStatus = "denied";
    render(<HomeView />);

    expect(screen.queryByText("No meetings coming up")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Connect your calendar" }),
    );
    expect(mocks.openNew).toHaveBeenCalledWith({ type: "calendar" });
    expect(screen.getByRole("button", { name: "Record now" })).toBeTruthy();
  });

  it("hides Follow-ups when there are none", () => {
    render(<HomeView />);
    expect(screen.queryByRole("heading", { name: "Follow-ups" })).toBeNull();
  });

  it("lists follow-ups with a checkbox and a link to the note", () => {
    mocks.followUps = [
      {
        id: "item-1",
        text: "Send the deck",
        status: "todo",
        session_id: "session-9",
        session_title: "Kickoff",
      },
    ];
    render(<HomeView />);

    expect(screen.getByRole("heading", { name: "Follow-ups" })).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Mark as done" }));
    expect(mocks.setFollowUpDone).toHaveBeenCalledWith("item-1", true);

    fireEvent.click(screen.getByRole("button", { name: "Kickoff" }));
    expect(mocks.openCurrent).toHaveBeenCalledWith({
      type: "sessions",
      id: "session-9",
    });
  });

  it("groups notes by day and hides the shortcuts", () => {
    const note = (
      id: string,
      title: string,
      timeMs: number,
      attendees = 0,
    ) => ({
      id,
      title,
      timeMs,
      attendees,
      locked: false,
      trackingId: null,
    });
    mocks.recent.groups = [
      {
        key: "today",
        kind: "today",
        dayMs: time(0),
        notes: [note("a", "Standup", time(9))],
      },
      {
        key: "yesterday",
        kind: "yesterday",
        dayMs: time(0) - 864e5,
        notes: [note("b", "", time(9) - 864e5, 2)],
      },
      {
        key: "sep30",
        kind: "day",
        dayMs: new Date(2026, 8, 30).getTime(),
        notes: [note("c", "Kickoff", new Date(2026, 8, 30, 11).getTime())],
      },
    ];
    render(<HomeView />);

    expect(screen.getByRole("heading", { name: "Notes" })).toBeTruthy();
    for (const name of ["Today", "Yesterday", "Wed, Sep 30"]) {
      expect(screen.getByRole("heading", { name })).toBeTruthy();
    }
    expect(screen.getByText("Standup")).toBeTruthy();
    expect(screen.getAllByText("9:00 AM")).toHaveLength(2);
    expect(screen.getByText("11:00 AM")).toBeTruthy();
    expect(screen.getByText("Untitled")).toBeTruthy();
    expect(screen.getByText("2 people")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Start recording/ }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();

    fireEvent.click(screen.getByText("Standup"));
    expect(mocks.openCurrent).toHaveBeenCalledWith({
      type: "sessions",
      id: "a",
    });
  });

  it("pages the notes list with Show more", () => {
    mocks.recent.hasMore = true;
    mocks.recent.groups = [
      {
        key: "today",
        kind: "today",
        dayMs: time(0),
        notes: [
          {
            id: "a",
            title: "Standup",
            timeMs: time(9),
            attendees: 0,
            locked: false,
            trackingId: null,
          },
        ],
      },
    ];
    render(<HomeView />);

    expect(mocks.recentLimits[mocks.recentLimits.length - 1]).toBe(20);
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(mocks.recentLimits[mocks.recentLimits.length - 1]).toBe(40);
  });

  it("asks to unlock a locked note before opening it", async () => {
    mocks.recent.groups = [
      {
        key: "today",
        kind: "today",
        dayMs: time(0),
        notes: [
          {
            id: "secret",
            title: "Locked",
            timeMs: time(9),
            attendees: 0,
            locked: true,
            trackingId: null,
          },
        ],
      },
    ];
    render(<HomeView />);

    fireEvent.click(screen.getByText("Locked"));
    expect(mocks.revealLockedNote).toHaveBeenCalledWith("secret");
    await vi.waitFor(() =>
      expect(mocks.openCurrent).toHaveBeenCalledWith({
        type: "sessions",
        id: "secret",
      }),
    );
  });

  it("shows the shortcuts only when there are no notes", () => {
    mocks.recent = {
      isLoading: false,
      hasNotes: false,
      groups: [],
      hasMore: false,
    };
    render(<HomeView />);

    expect(
      screen.getByRole("button", { name: /Start recording/ }),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Notes" })).toBeNull();
  });
});
