import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  openCurrent: vi.fn(),
  openNew: vi.fn(),
  onOpenChange: vi.fn(),
  search: vi.fn(),
  notes: [] as Array<{
    shareId: string;
    sessionId: string;
    title: string;
    publishedAt: string;
    manageAccess: boolean;
  }>,
  sessions: [] as Array<{
    id: string;
    title: string;
    created_at: string;
  }>,
  emptyIds: new Set<string>(),
  newNote: vi.fn(),
  newNoteAndListen: vi.fn(),
  select: vi.fn(),
  tabs: [] as Array<{ type: string }>,
  recentIds: [] as string[],
  platform: "macos",
}));

vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => mocks.platform }));

vi.mock("~/shared/empty-note-ids", () => ({
  useEmptyNoteIds: () => mocks.emptyIds,
}));

vi.mock("~/shared/useNewNote", () => ({
  useNewNote: () => mocks.newNote,
  useNewNoteAndListen: () => mocks.newNoteAndListen,
}));

vi.mock("~/auth", () => ({
  useAuth: () => ({ session: { user: { id: "viewer-1" } } }),
}));

vi.mock("~/auth/billing-context", () => ({
  useBillingAccess: () => ({ isPro: true }),
}));

vi.mock("~/settings/team/mirror", () => ({
  useMyWorkspacesWithMirror: () => ({ data: [], isLoading: false }),
}));

vi.mock("~/search/contexts/engine", () => ({
  useSearchEngine: () => ({ search: mocks.search }),
}));

vi.mock("~/session/queries", () => ({
  useSessionSummaries: () => mocks.sessions,
}));

vi.mock("~/shared-notes/cache", () => ({
  useDurableSharedNotes: () => mocks.notes,
}));

vi.mock("~/store/zustand/tabs", () => {
  const state = () => ({
    openCurrent: mocks.openCurrent,
    openNew: mocks.openNew,
    select: mocks.select,
    tabs: mocks.tabs,
    recentlyOpenedSessionIds: mocks.recentIds,
  });
  const useTabs = (selector: (s: ReturnType<typeof state>) => unknown) =>
    selector(state());
  useTabs.getState = state;
  return { useTabs };
});

import { buildSnippet, OpenNoteDialog } from "./open-note-dialog";

describe("OpenNoteDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notes = [];
    mocks.sessions = [];
    mocks.emptyIds = new Set();
    mocks.tabs = [];
    mocks.platform = "macos";
    mocks.search.mockResolvedValue([]);
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as typeof ResizeObserver;
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(cleanup);

  it("closes through the shared dialog escape behavior", () => {
    render(<OpenNoteDialog open onOpenChange={mocks.onOpenChange} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(mocks.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("opens a durable shared note from All Notes", () => {
    mocks.notes = [
      {
        shareId: "share-1",
        sessionId: "remote-session",
        title: "Shared roadmap",
        publishedAt: "2026-07-16T09:00:00.000Z",
        manageAccess: false,
      },
      {
        shareId: "owned-share",
        sessionId: "local-session",
        title: "Owned note",
        publishedAt: "2026-07-15T09:00:00.000Z",
        manageAccess: true,
      },
      {
        shareId: "viewer-local-share",
        sessionId: "local-session",
        title: "Viewer local snapshot",
        publishedAt: "2026-07-14T09:00:00.000Z",
        manageAccess: false,
      },
    ];
    mocks.sessions = [
      {
        id: "local-session",
        title: "Owned canonical note",
        created_at: "2026-07-15T09:00:00.000Z",
      },
    ];

    render(<OpenNoteDialog open onOpenChange={mocks.onOpenChange} />);

    expect(
      screen.getByRole("dialog", { name: "Search notes and settings" }),
    ).toBeTruthy();
    expect(
      document.querySelector("[data-open-note-dialog-drag-region]"),
    ).toBeTruthy();
    expect(screen.getByText("All notes")).toBeTruthy();
    const sharedNote = screen.getByRole("option", {
      name: "Shared roadmap",
    });
    expect(
      sharedNote.querySelector("[data-testid='shared-note-icon']"),
    ).toBeTruthy();
    expect(screen.queryByText("Owned note")).toBeNull();
    expect(screen.getByText("Owned canonical note")).toBeTruthy();
    expect(screen.getByText("Viewer local snapshot")).toBeTruthy();

    fireEvent.click(sharedNote);

    expect(mocks.onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.openCurrent).toHaveBeenCalledWith({
      type: "shared_sessions",
      id: "share-1",
    });
  });

  it("shows top-level pages when the query is empty", () => {
    render(<OpenNoteDialog open onOpenChange={mocks.onOpenChange} />);

    expect(screen.getByText("Go to")).toBeTruthy();
    expect(
      screen.getByRole("option", { name: "Calendar month view" }),
    ).toBeTruthy();
    // Fork: Contacts is hidden.
    expect(screen.queryByRole("option", { name: "Contacts" })).toBeNull();
    expect(screen.getByRole("option", { name: "Settings" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Transcription" })).toBeNull();
  });

  // Fork: journey-after P3 "⌘K search, no query": Home's empty-note rule
  // and its "Untitled note" label.
  it("hides empty notes and names untitled ones as Home does", () => {
    mocks.sessions = [
      { id: "empty", title: "", created_at: "2026-10-03T09:00:00.000Z" },
      { id: "kept", title: "", created_at: "2026-10-02T09:00:00.000Z" },
      { id: "named", title: "Standup", created_at: "2026-10-01T09:00:00.000Z" },
    ];
    mocks.emptyIds = new Set(["empty"]);
    render(<OpenNoteDialog open onOpenChange={mocks.onOpenChange} />);

    expect(
      screen.getAllByRole("option", { name: "Untitled note" }),
    ).toHaveLength(1);
    expect(screen.getByRole("option", { name: "Standup" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Untitled" })).toBeNull();
  });

  // Fork: journey-after P3 "⌘K search, go to".
  it("goes Home, to Chat, or makes a new note", () => {
    mocks.tabs = [{ type: "empty" }];
    render(<OpenNoteDialog open onOpenChange={mocks.onOpenChange} />);

    fireEvent.click(screen.getByRole("option", { name: "Home" }));
    expect(mocks.select).toHaveBeenCalledWith({ type: "empty" });

    fireEvent.click(screen.getByRole("option", { name: "Chat" }));
    expect(mocks.openCurrent).toHaveBeenCalledWith({ type: "chat" });

    // Fork: NN/g #4, the rows do what their ⌘N and ⇧⌘N hints do.
    fireEvent.click(screen.getByRole("option", { name: /Record meeting/ }));
    expect(mocks.newNoteAndListen).toHaveBeenCalledOnce();
    expect(mocks.newNote).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("option", { name: /Blank note/ }));
    expect(
      screen.getByRole("option", { name: /Blank note/ }).textContent,
    ).toContain("⇧⌘N");
    expect(mocks.newNote).toHaveBeenCalledOnce();
    expect(mocks.openNew).not.toHaveBeenCalled();
  });

  // Fork: Ctrl+N and Ctrl+Shift+N off a Mac (Microsoft Writing Style Guide,
  // Keys and keyboard shortcuts), and no Calendar page, which reads the
  // Mac's Calendar (NN/g #5).
  it("names Ctrl keys and lists no Calendar off a Mac", () => {
    mocks.platform = "windows";
    render(<OpenNoteDialog open onOpenChange={mocks.onOpenChange} />);

    expect(
      screen.getByRole("option", { name: /Record meeting/ }).textContent,
    ).toContain("Ctrl+N");
    expect(
      screen.getByRole("option", { name: /Blank note/ }).textContent,
    ).toContain("Ctrl+Shift+N");
    expect(screen.queryByText(/⌘/)).toBeNull();

    fireEvent.change(screen.getByPlaceholderText("Search notes and settings"), {
      target: { value: "calendar" },
    });
    expect(screen.queryByRole("option", { name: /Calendar/ })).toBeNull();
  });

  // Fork: WCAG 2.2 SC 2.4.7, the selected row is easy to see.
  it("marks the selected row with the selected gray and foreground text", () => {
    render(<OpenNoteDialog open onOpenChange={mocks.onOpenChange} />);
    const row = screen.getByRole("option", { name: "Home" });
    expect(row.className).toContain("data-[selected=true]:bg-sidebar-accent ");
    expect(row.className).toContain("data-[selected=true]:text-foreground");
    expect(row.className).not.toContain("bg-accent/60");
  });

  // Fork: journey-after P3 "⌘K search": flat surface, 24 px close.
  it("uses a flat popover surface and a 24 px close button", () => {
    render(<OpenNoteDialog open onOpenChange={mocks.onOpenChange} />);
    // The dialog primitive has its own hidden Close button too.
    const close = screen
      .getAllByRole("button", { name: "Close" })
      .find((button) => button.className.includes("size-6"))!;
    expect(close.className).toContain("size-6");
    const panel = close.closest(".bg-popover");
    expect(panel).toBeTruthy();
    expect(panel?.className).not.toContain("shadow");
  });

  it("opens a matching page from the global navigator", () => {
    render(<OpenNoteDialog open onOpenChange={mocks.onOpenChange} />);

    fireEvent.change(screen.getByPlaceholderText("Search notes and settings"), {
      target: { value: "calendar" },
    });
    fireEvent.click(
      screen.getByRole("option", { name: "Calendar month view" }),
    );

    expect(mocks.onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.openNew).toHaveBeenCalledWith({ type: "calendar" });
  });

  it("opens a matching settings sub-page", () => {
    render(<OpenNoteDialog open onOpenChange={mocks.onOpenChange} />);

    fireEvent.change(screen.getByPlaceholderText("Search notes and settings"), {
      target: { value: "transcription" },
    });
    fireEvent.click(screen.getByRole("option", { name: /Transcription/ }));

    expect(mocks.openNew).toHaveBeenCalledWith({
      type: "settings",
      state: { tab: "transcription" },
    });
  });

  it("says it is searching, then that no notes match", async () => {
    render(<OpenNoteDialog open onOpenChange={mocks.onOpenChange} />);

    fireEvent.change(screen.getByPlaceholderText("Search notes and settings"), {
      target: { value: "zzzz" },
    });

    expect(screen.getByText("Searching notes…")).toBeTruthy();
    expect(
      await screen.findByText("No notes match “zzzz”. Try fewer words."),
    ).toBeTruthy();
  });

  it("finds notes by their content and keeps title matches first", async () => {
    mocks.sessions = [
      {
        id: "title-match",
        title: "Pricing review",
        created_at: "2026-07-16T09:00:00.000Z",
      },
      {
        id: "content-match",
        title: "Weekly sync",
        created_at: "2026-07-15T09:00:00.000Z",
      },
    ];
    mocks.search.mockResolvedValue([
      {
        score: 2,
        document: {
          id: "title-match",
          type: "session",
          title: "Pricing review",
          content: "Pricing notes",
          created_at: 0,
        },
      },
      {
        score: 1,
        document: {
          id: "content-match",
          type: "session",
          title: "Weekly sync",
          content: "We agreed the new pricing starts in November.",
          created_at: 0,
        },
      },
      {
        score: 0.5,
        document: {
          id: "person-1",
          type: "human",
          title: "Pat",
          content: "pricing",
          created_at: 0,
        },
      },
    ]);

    render(<OpenNoteDialog open onOpenChange={mocks.onOpenChange} />);

    fireEvent.change(screen.getByPlaceholderText("Search notes and settings"), {
      target: { value: "pricing" },
    });

    await waitFor(() => expect(screen.getByText("In notes")).toBeTruthy());
    expect(mocks.search).toHaveBeenCalledWith("pricing");
    // The typed word is marked in each result (NN/g: highlight query terms).
    expect(
      screen
        .getAllByText(/^pricing$/i)
        .some((element) => element.className.includes("font-semibold")),
    ).toBe(true);

    const options = screen.getAllByRole("option");
    const titleIndex = options.findIndex((o) =>
      o.textContent?.includes("Pricing review"),
    );
    const contentIndex = options.findIndex((o) =>
      o.textContent?.includes("Weekly sync"),
    );
    expect(titleIndex).toBeGreaterThanOrEqual(0);
    expect(contentIndex).toBeGreaterThan(titleIndex);
    expect(
      options.filter((o) => o.textContent?.includes("Pricing review")),
    ).toHaveLength(1);
    expect(screen.queryByText("Pat")).toBeNull();
    expect(screen.getByTestId("content-snippet").textContent).toBe(
      "We agreed the new pricing starts in November.",
    );

    fireEvent.click(options[contentIndex]!);
    expect(mocks.openCurrent).toHaveBeenCalledWith({
      type: "sessions",
      id: "content-match",
    });
  });

  // Fork test: live task test, Oct 10 (Home stayed selected over the first
  // recent note, which loads a moment later).
  it("selects the first recent note once it loads", () => {
    mocks.recentIds = ["recent-1"];
    mocks.sessions = [];
    const { rerender } = render(
      <OpenNoteDialog open onOpenChange={mocks.onOpenChange} />,
    );

    mocks.sessions = [
      {
        id: "recent-1",
        title: "Budget review",
        created_at: "2026-10-09T09:00:00.000Z",
      },
    ];
    rerender(<OpenNoteDialog open onOpenChange={mocks.onOpenChange} />);

    const selected = screen
      .getAllByRole("option")
      .find((option) => option.getAttribute("aria-selected") === "true");
    expect(selected?.textContent).toContain("Budget review");
    mocks.recentIds = [];
  });

  it("selects the first result after the note-text matches arrive", async () => {
    mocks.sessions = [
      {
        id: "content-match",
        title: "Weekly sync",
        created_at: "2026-07-15T09:00:00.000Z",
      },
    ];
    mocks.search.mockResolvedValue([
      {
        score: 1,
        document: {
          id: "content-match",
          type: "session",
          title: "Weekly sync",
          content: "We will chat about pricing.",
          created_at: 0,
        },
      },
    ]);

    render(<OpenNoteDialog open onOpenChange={mocks.onOpenChange} />);
    const input = screen.getByPlaceholderText("Search notes and settings");
    for (const value of ["c", "ch", "cha", "chat"]) {
      fireEvent.change(input, { target: { value } });
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    await waitFor(() => expect(screen.getByText("In notes")).toBeTruthy());
    await new Promise((resolve) => setTimeout(resolve, 50));

    const options = screen.getAllByRole("option");
    const selected = options.filter(
      (option) => option.getAttribute("aria-selected") === "true",
    );
    expect(options[0]?.textContent).toContain("Chat");
    expect(selected).toEqual([options[0]]);
  });

  // Fork test: task test, Oct 8 (the arrowed-to row jumped back to the
  // top when note-text matches arrived, so Return opened another note).
  it("keeps the arrowed-to row when note-text matches arrive", async () => {
    mocks.sessions = [
      {
        id: "pricing-review",
        title: "Pricing review",
        created_at: "2026-07-16T09:00:00.000Z",
      },
      {
        id: "pricing-plan",
        title: "Pricing plan",
        created_at: "2026-07-15T09:00:00.000Z",
      },
      {
        id: "weekly-sync",
        title: "Weekly sync",
        created_at: "2026-07-14T09:00:00.000Z",
      },
    ];
    mocks.search.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve([
                {
                  score: 1,
                  document: {
                    id: "weekly-sync",
                    type: "session",
                    title: "Weekly sync",
                    content: "We talked about pricing.",
                    created_at: 0,
                  },
                },
              ]),
            150,
          ),
        ),
    );

    render(<OpenNoteDialog open onOpenChange={mocks.onOpenChange} />);
    const input = screen.getByPlaceholderText("Search notes and settings");
    fireEvent.change(input, { target: { value: "pricing" } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const selectedText = () =>
      screen
        .getAllByRole("option")
        .find((option) => option.getAttribute("aria-selected") === "true")
        ?.textContent ?? "";
    const before = selectedText();

    await waitFor(() => expect(screen.getByText("In notes")).toBeTruthy());
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(before).not.toBe("");
    expect(selectedText()).toBe(before);
  });

  // Fork test: task test, Oct 8.
  it("says the search failed instead of that nothing matched", async () => {
    mocks.sessions = [];
    mocks.search.mockRejectedValue(new Error("index unavailable"));

    render(<OpenNoteDialog open onOpenChange={mocks.onOpenChange} />);
    fireEvent.change(screen.getByPlaceholderText("Search notes and settings"), {
      target: { value: "pricing" },
    });

    await waitFor(() =>
      expect(
        screen.getByText("Couldn't search your notes. Try again."),
      ).toBeTruthy(),
    );
    expect(screen.queryByText(/No notes match/)).toBeNull();
  });

  it("does not run content search for short or empty queries", async () => {
    render(<OpenNoteDialog open onOpenChange={mocks.onOpenChange} />);

    fireEvent.change(screen.getByPlaceholderText("Search notes and settings"), {
      target: { value: "p" },
    });
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(mocks.search).not.toHaveBeenCalled();
  });

  it("builds a short snippet around the first match", () => {
    const long = `${"a ".repeat(100)}the budget is final ${"b ".repeat(100)}`;
    const snippet = buildSnippet(long, "budget");

    expect(snippet.startsWith("…")).toBe(true);
    expect(snippet.endsWith("…")).toBe(true);
    expect(snippet).toContain("the budget is final");
    expect(snippet.length).toBeLessThanOrEqual(122);
  });
});
