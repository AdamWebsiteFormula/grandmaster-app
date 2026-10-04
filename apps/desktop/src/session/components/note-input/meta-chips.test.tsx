import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NoteMetaChips, NoteMetaChipsLayer } from "./meta-chips";

import type { EditorView } from "~/store/zustand/tabs/schema";

const mocks = vi.hoisted(() => ({
  folderId: "",
  participants: [] as Array<{ id: string }>,
  event: null as { started_at?: string } | null,
  createdAt: "2026-10-01T15:00:00.000Z",
}));

vi.mock("./header-enhanced", () => ({
  HeaderViewEnhanced: ({
    enhancedNoteId,
    isActive,
    variant,
    onClick,
  }: {
    enhancedNoteId: string;
    isActive: boolean;
    variant?: string;
    onClick?: () => void;
  }) => (
    <button
      type="button"
      data-variant={variant}
      aria-current={isActive ? "page" : undefined}
      onClick={onClick}
    >
      {`Template ${enhancedNoteId}`}
    </button>
  ),
}));

vi.mock("~/session/components/outer-header/metadata", () => ({
  MetadataPanelContent: () => <div data-testid="meeting-details" />,
}));

vi.mock("~/session/hooks/useSessionEvent", () => ({
  useSessionEvent: () => mocks.event,
}));

vi.mock("~/folders/selection", () => ({
  useFolderSelection: (selector: (state: unknown) => unknown) =>
    selector({ setSelectedPath: vi.fn() }),
}));

vi.mock("~/store/zustand/tabs", () => ({
  useTabs: (selector: (state: unknown) => unknown) =>
    selector({ openNew: vi.fn() }),
}));

vi.mock("~/session/folder-catalog", () => ({
  createNamedFolder: vi.fn(),
}));

vi.mock("~/session/queries", () => ({
  deleteEnhancedNote: vi.fn(() => Promise.resolve()),
  useFolderIcons: () => ({}),
  useFolderPaths: () => [],
  useSession: () => ({
    folder_id: mocks.folderId,
    created_at: mocks.createdAt,
  }),
  useSessionParticipants: () => mocks.participants,
  useUpdateSession: () => vi.fn(),
}));

const ENHANCED: EditorView = { type: "enhanced", id: "summary-1" };
const RAW: EditorView = { type: "raw" };
const TRANSCRIPT: EditorView = { type: "transcript" };

function renderChips({
  currentTab = ENHANCED,
  editorTabs = [ENHANCED, RAW, TRANSCRIPT],
  onSelectView = vi.fn(),
}: {
  currentTab?: EditorView;
  editorTabs?: EditorView[];
  onSelectView?: (view: EditorView) => void;
} = {}) {
  render(
    <NoteMetaChips
      sessionId="session-1"
      editorTabs={editorTabs}
      currentTab={currentTab}
      onSelectView={onSelectView}
    />,
  );
  return { onSelectView };
}

function chipLabels() {
  const row = document.querySelector("[data-note-meta-chips]")!;
  return Array.from(row.querySelectorAll(":scope > button")).map(
    (button) =>
      button.getAttribute("aria-label") ??
      (button.textContent ?? "").replace(/\s+/g, " ").trim(),
  );
}

describe("NoteMetaChips", () => {
  beforeEach(() => {
    mocks.folderId = "";
    mocks.participants = [];
    mocks.event = null;
    mocks.createdAt = "2026-10-01T15:00:00.000Z";
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-03T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("shows notes toggle, template, date with attendees, and Add to folder", () => {
    mocks.participants = [{ id: "a" }, { id: "b" }, { id: "c" }];
    renderChips();

    expect(chipLabels()).toEqual([
      "My notes",
      "Template summary-1",
      "Oct 1 3 attendees",
      "Add to folder",
    ]);
    expect(
      screen.getByRole("button", { name: "Template summary-1" }).dataset
        .variant,
    ).toBe("chip");
  });

  it("uses the meeting start for the date and drops a zero attendee count", () => {
    mocks.event = { started_at: "2026-09-25T16:00:00.000Z" };
    renderChips();

    expect(chipLabels()).toContain("Sep 25");
  });

  it("shows the folder name once the note is filed", () => {
    mocks.folderId = "Clients";
    renderChips();

    expect(
      screen.getByRole("combobox", { name: "Folder: Clients" }),
    ).not.toBeNull();
    expect(screen.queryByText("Add to folder")).toBeNull();
  });

  it("toggles between the summary and My notes", () => {
    const first = renderChips();
    const toggle = screen.getByRole("button", { name: "My notes" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);
    expect(first.onSelectView).toHaveBeenLastCalledWith(RAW);
    cleanup();

    const second = renderChips({ currentTab: RAW });
    const pressed = screen.getByRole("button", { name: "My notes" });
    expect(pressed.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(pressed);
    expect(second.onSelectView).toHaveBeenLastCalledWith(ENHANCED);
  });

  // NN/g "Icon Usability": the notes toggle says "My notes" in words.
  it("labels the notes toggle in words beside its icon", () => {
    renderChips();

    const toggle = screen.getByRole("button", { name: "My notes" });
    expect(toggle.textContent).toBe("My notes");
    expect(toggle.className).not.toContain("px-1.5");
  });

  // redline2-oct3 R2: the bars chip says what it does next.
  it("names the notes toggle's action in a tooltip", async () => {
    renderChips();
    fireEvent.focus(screen.getByRole("button", { name: "My notes" }));
    expect(
      (await screen.findAllByText("Show my notes")).length,
    ).toBeGreaterThan(0);
    cleanup();

    renderChips({ currentTab: RAW });
    fireEvent.focus(screen.getByRole("button", { name: "My notes" }));
    expect((await screen.findAllByText("Show summary")).length).toBeGreaterThan(
      0,
    );
  });

  it("hides the notes toggle when there is no summary yet", () => {
    renderChips({ currentTab: RAW, editorTabs: [RAW] });

    expect(screen.queryByRole("button", { name: "My notes" })).toBeNull();
    expect(chipLabels()).toEqual(["Oct 1", "Add to folder"]);
  });

  it("opens meeting details from the date chip", () => {
    renderChips();

    fireEvent.click(screen.getByTitle("Date and attendees"));

    expect(screen.getByTestId("meeting-details")).not.toBeNull();
  });
});

describe("NoteMetaChipsLayer", () => {
  afterEach(() => {
    cleanup();
  });

  function Host({ withTitle }: { withTitle: boolean }) {
    return (
      <div data-testid="host" className="note-meta-chips-host">
        <NoteMetaChipsLayer>
          <span>chips</span>
        </NoteMetaChipsLayer>
        {withTitle ? (
          <div className="note-title-editor">
            <h1>Title</h1>
          </div>
        ) : null}
      </div>
    );
  }

  it("sits under the title and reserves its space", () => {
    render(<Host withTitle />);

    const layer = document.querySelector<HTMLElement>(
      "[data-note-meta-chips-layer]",
    )!;
    expect(layer.className).toContain("absolute");
    expect(layer.style.top).toBe("8px");
    expect(
      screen
        .getByTestId("host")
        .style.getPropertyValue("--note-meta-chips-space"),
    ).toBe("24px");
  });

  it("falls back to the top of the column when there is no title", () => {
    render(<Host withTitle={false} />);

    const layer = document.querySelector<HTMLElement>(
      "[data-note-meta-chips-layer]",
    )!;
    expect(layer.className).toContain("mb-4");
    expect(layer.className).not.toContain("absolute");
  });
});
