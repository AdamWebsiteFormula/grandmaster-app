import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  comingUp: { isLoading: false, days: [] as unknown[] },
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
  useComingUp: () => mocks.comingUp,
  useFollowUps: () => ({ isLoading: false, items: mocks.followUps }),
  useRecentNotes: (limit: number) => {
    mocks.recentLimits.push(limit);
    return mocks.recent;
  },
  setFollowUpDone: mocks.setFollowUpDone,
  RECENT_PAGE_SIZE: 20,
  COMING_UP_DAYS: 7,
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
const day = (date: number) => new Date(2026, 9, date).getTime();
const today = () => ({ dayMs: day(3), isToday: true, events: [] as unknown[] });
const meeting = (
  id: string,
  title: string,
  date: number,
  hour: number,
  extra: Record<string, unknown> = {},
) => ({
  id,
  title,
  startMs: new Date(2026, 9, date, hour).getTime(),
  endMs: new Date(2026, 9, date, hour, 5).getTime(),
  attendees: 2,
  color: null,
  live: false,
  ...extra,
});

describe("HomeView", () => {
  beforeEach(() => {
    mocks.comingUp = { isLoading: false, days: [today()] };
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

  it("groups coming-up meetings by day and records one", async () => {
    mocks.comingUp.days = [
      today(),
      {
        dayMs: day(4),
        isToday: false,
        events: [meeting("event-1", "Design review", 4, 10)],
      },
      {
        dayMs: day(5),
        isToday: false,
        events: [
          meeting("event-2", "Hosting renewal", 5, 10, { color: "#3B82F6" }),
          meeting("event-3", "Outreach call", 5, 12),
        ],
      },
    ];
    const { container } = render(<HomeView />);

    expect(screen.getByRole("heading", { name: "Coming up" })).toBeTruthy();
    expect(container.querySelectorAll("[data-coming-up-day]")).toHaveLength(3);
    expect(screen.getByText("No more events today")).toBeTruthy();
    expect(screen.getByText("Sun")).toBeTruthy();
    expect(screen.getByText("Mon")).toBeTruthy();
    expect(screen.getAllByText("October")).toHaveLength(3);
    expect(screen.getAllByText("10:00 – 10:05 AM")).toHaveLength(2);
    expect(screen.getByText("12:00 – 12:05 PM")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "Record" })[0]);
    await vi.waitFor(() =>
      expect(mocks.openSessionAndListen).toHaveBeenCalledWith("session-1", {
        behavior: "current",
      }),
    );
    expect(mocks.getOrCreateSessionForEventId).toHaveBeenCalledWith(
      "event-1",
      "Design review",
    );

    fireEvent.click(screen.getByText("Outreach call"));
    await vi.waitFor(() =>
      expect(mocks.openCurrent).toHaveBeenCalledWith({
        type: "sessions",
        id: "session-1",
      }),
    );
  });

  it("pages coming-up days four at a time", () => {
    mocks.comingUp.days = [
      today(),
      ...[4, 5, 6, 7].map((date) => ({
        dayMs: day(date),
        isToday: false,
        events: [meeting(`e${date}`, `Meeting ${date}`, date, 9)],
      })),
    ];
    render(<HomeView />);

    expect(screen.queryByText("Meeting 7")).toBeNull();
    expect(
      (
        screen.getByRole("button", {
          name: "Earlier days",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Later days" }));
    expect(screen.getByText("Meeting 7")).toBeTruthy();
    expect(screen.queryByText("Meeting 4")).toBeNull();
  });

  it("shows one quiet line when the week is empty, with no Start recording", () => {
    render(<HomeView />);

    expect(screen.getByText("No meetings in the next 7 days")).toBeTruthy();
    expect(screen.queryByText("No more events today")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Start recording" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Connect calendar" }),
    ).toBeNull();
  });

  it("offers Connect calendar on the right when access is off", () => {
    mocks.calendarStatus = "denied";
    render(<HomeView />);

    expect(screen.queryByText("No meetings in the next 7 days")).toBeNull();
    expect(screen.getByText("Your next meetings show up here")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Start recording" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Connect calendar" }));
    expect(mocks.openNew).toHaveBeenCalledWith({
      type: "settings",
      state: { tab: "calendars" },
    });
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

  it("groups notes by day in two-line rows and hides the shortcuts", () => {
    const note = (
      id: string,
      title: string,
      timeMs: number,
      people: string[] = [],
      durationMs = 0,
      hasTranscript = durationMs > 0,
    ) => ({
      id,
      title,
      timeMs,
      attendees: people.length + 1,
      people,
      durationMs,
      hasTranscript,
      hasContent: true,
      locked: false,
      trackingId: null,
    });
    mocks.recent.groups = [
      {
        key: "today",
        kind: "today",
        dayMs: time(0),
        notes: [
          note("a", "Standup", time(9), [], 32 * 60_000),
          note("plain", "Ideas", time(8)),
          note("live", "Draft", time(7), [], 0, true),
        ],
      },
      {
        key: "yesterday",
        kind: "yesterday",
        dayMs: time(0) - 864e5,
        notes: [note("b", "", time(9) - 864e5, ["Bbaird", "Jimharbaugh104"])],
      },
      {
        key: "sep30",
        kind: "day",
        dayMs: new Date(2026, 8, 30).getTime(),
        notes: [
          note(
            "c",
            "Kickoff",
            new Date(2026, 8, 30, 11).getTime(),
            ["Ana", "Bo", "Cy", "Di"],
            65 * 60_000,
          ),
        ],
      },
    ];
    const { container } = render(<HomeView />);

    expect(screen.getByRole("heading", { name: "Notes" })).toBeTruthy();
    for (const name of ["Today", "Yesterday", "Wed, Sep 30"]) {
      expect(screen.getByRole("heading", { name })).toBeTruthy();
    }
    expect(screen.getByText("Standup")).toBeTruthy();
    expect(screen.getAllByText("9:00 AM")).toHaveLength(2);
    expect(screen.getByText("11:00 AM")).toBeTruthy();
    // Untitled notes read "Untitled note" in the same text color as titles.
    expect(
      screen.getByText("Untitled note").parentElement?.className,
    ).toContain("text-foreground");
    expect(screen.getByText("Standup").parentElement?.className).toContain(
      "text-foreground",
    );
    // Second line on every row: attendees when present, else the length.
    expect(screen.getByText("32 min")).toBeTruthy();
    expect(screen.getByText("Bbaird & Jimharbaugh104")).toBeTruthy();
    expect(screen.getByText("Ana, Bo & 2 others")).toBeTruthy();
    expect(screen.queryByText(/1 hr 5 min/)).toBeNull();
    // No filler label; a row without metadata keeps an empty second line,
    // so every row has the same two-line shape and height.
    expect(screen.queryByText("No transcript")).toBeNull();
    expect(screen.queryByText("Note")).toBeNull();
    const ideas = screen.getByText("Ideas").closest("button")!;
    expect(ideas.className).toContain("min-h-14");
    const blank = ideas.querySelector("span.text-xs")!;
    expect(blank.textContent).toBe("\u00a0");
    expect(blank.getAttribute("aria-hidden")).toBe("true");
    // Attendee initials only when people were there; no glyph otherwise.
    expect(screen.getByText("B")).toBeTruthy();
    expect(screen.getByText("A")).toBeTruthy();
    expect(container.querySelectorAll("[data-note-avatar]")).toHaveLength(2);
    // A row without attendees keeps an empty slot so titles line up.
    const plain = screen.getByText("Ideas").closest("button")!;
    expect(plain.querySelector("svg")).toBeNull();
    expect(plain.querySelector("span.size-8")?.textContent).toBe("");
    expect(screen.queryByText("S")).toBeNull();
    expect(screen.getByText("11:00 AM").className).toContain("text-sm");
    expect(screen.queryByRole("button", { name: /Blank note/ })).toBeNull();
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
            people: [],
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
            people: [],
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
      screen.getByRole("button", { name: /^Start recording\s*⌘ N$/ }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /^Blank note\s*⇧ ⌘ N$/ }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /New note/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Notes" })).toBeNull();
  });

  it("marks locked notes and titles truncated rows", () => {
    mocks.recent.groups = [
      {
        key: "today",
        kind: "today",
        dayMs: time(0),
        notes: [
          {
            id: "secret",
            title: "Board prep",
            timeMs: time(9),
            attendees: 0,
            people: [],
            locked: true,
            trackingId: null,
          },
        ],
      },
    ];
    render(<HomeView />);

    expect(screen.getByRole("img", { name: "Locked" })).toBeTruthy();
    expect(screen.getByTitle("Board prep")).toBeTruthy();
  });

  it("sets the page title in the display face on a centered 640 px column", () => {
    const { container } = render(<HomeView />);
    const title = screen.getByRole("heading", { name: "Coming up" });
    expect(title.className).toContain("font-display");
    expect(title.className).toContain("font-semibold");
    expect(title.className).toContain("tracking-[-0.01em]");
    expect(container.querySelector(".max-w-\\[640px\\].mx-auto")).toBeTruthy();
  });

  it("leaves no leading slot when no row has attendees", () => {
    mocks.recent.groups = [
      {
        key: "today",
        kind: "today",
        dayMs: time(0),
        notes: [
          {
            id: "a",
            title: "Ideas",
            timeMs: time(9),
            attendees: 1,
            people: [],
            durationMs: 0,
            hasTranscript: false,
            hasContent: true,
            locked: false,
            trackingId: null,
          },
        ],
      },
    ];
    render(<HomeView />);
    const row = screen.getByText("Ideas").closest("button")!;
    expect(row.querySelector("span.size-8")).toBeNull();
  });
});
