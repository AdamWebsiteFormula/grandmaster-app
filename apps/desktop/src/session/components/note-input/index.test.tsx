import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NoteInput } from ".";

import type { EditorView } from "~/store/zustand/tabs/schema";

const hoisted = vi.hoisted(() => ({
  editorTabs: [{ type: "raw" }, { type: "transcript" }] as EditorView[],
  hotkeys: [] as Array<{ keys: string; callback: () => void }>,
  enhancedHasProseMirror: true,
  enhancedEditorProps: [] as Record<string, unknown>[],
  focusAtTrailingEmptyLine: vi.fn(),
  focusTitle: vi.fn(),
  flushPendingChanges: vi.fn(),
  onBeforeTabChange: vi.fn(),
  rawEditorProps: [] as Record<string, unknown>[],
  registerCanonicalSessionEditor: vi.fn(),
  searchVisible: false,
  sessionMode: "inactive",
  unregisterCanonicalSessionEditor: vi.fn(),
  updateSessionTabState: vi.fn(),
}));

vi.mock("./enhanced", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    Enhanced: React.forwardRef((props: Record<string, unknown>, ref) => {
      hoisted.enhancedEditorProps.push(props);
      React.useImperativeHandle(ref, () => createEditorRef());
      return React.createElement(
        "div",
        { "data-testid": "enhanced-editor" },
        React.createElement("button", { type: "button" }, "Retry summary"),
        hoisted.enhancedHasProseMirror
          ? React.createElement("div", { className: "ProseMirror" })
          : null,
      );
    }),
  };
});

vi.mock("./header", () => ({
  Header: () => <div data-testid="folder-header" />,
  SessionViewSwitcher: ({
    currentTab,
    editorTabs,
    handleTabChange,
    isTranscribing,
  }: {
    currentTab: EditorView;
    editorTabs: EditorView[];
    handleTabChange: (view: EditorView) => void;
    isTranscribing?: boolean;
  }) => (
    <div>
      <div data-testid="current-tab">{formatEditorView(currentTab)}</div>
      <div data-testid="is-transcribing">{String(isTranscribing)}</div>
      {editorTabs.map((editorTab) => (
        <button
          key={formatEditorView(editorTab)}
          type="button"
          onClick={() => handleTabChange(editorTab)}
        >
          {formatEditorView(editorTab)}
        </button>
      ))}
    </div>
  ),
  useEditorTabs: () => hoisted.editorTabs,
}));

vi.mock("./raw", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    RawEditor: React.forwardRef((props: Record<string, unknown>, ref) => {
      hoisted.rawEditorProps.push(props);
      React.useImperativeHandle(ref, () => createEditorRef());
      return React.createElement(
        "div",
        { "data-testid": "raw-editor" },
        React.createElement("div", {
          className: "ProseMirror",
          "data-testid": "mock-prosemirror",
        }),
      );
    }),
  };
});

vi.mock("./meta-chips", () => ({
  NoteMetaChipsLayer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="meta-chips-layer">{children}</div>
  ),
  NoteMetaChips: () => <div data-testid="meta-chips">chips</div>,
}));

vi.mock("./generate-summary-offer", () => ({
  GenerateSummaryOffer: () => <div data-testid="generate-summary-offer" />,
}));

vi.mock("~/session/components/title-input", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    TitleInput: React.forwardRef(
      (props: { variant?: string }, ref: React.Ref<unknown>) => {
        React.useImperativeHandle(ref, () => ({
          focus: hoisted.focusTitle,
          focusAtEnd: hoisted.focusTitle,
          focusAtPixelWidth: hoisted.focusTitle,
        }));
        return (
          <input
            aria-label="Note title"
            placeholder="Untitled"
            data-variant={props.variant}
          />
        );
      },
    ),
  };
});

vi.mock("./transcript-toolbar", () => ({
  TranscriptToolbar: () => <div data-testid="transcript-toolbar" />,
}));

vi.mock("./search/bar", () => ({
  SearchBar: () => <div data-testid="search-bar" />,
}));

vi.mock("./search/context", () => ({
  useSearch: () =>
    hoisted.searchVisible
      ? {
          isVisible: true,
          close: vi.fn(),
        }
      : null,
}));

vi.mock("./transcript", () => ({
  Transcript: ({ editMode }: { editMode?: boolean }) => (
    <div data-testid="transcript" data-edit-mode={String(editMode ?? false)} />
  ),
}));

vi.mock("~/session/components/shared", () => ({
  useCurrentNoteTab: () => ({ type: "raw" }),
}));

vi.mock("~/session-sharing/editor-activity", () => ({
  registerCanonicalSessionEditor: hoisted.registerCanonicalSessionEditor,
  unregisterCanonicalSessionEditor: hoisted.unregisterCanonicalSessionEditor,
}));

vi.mock("~/shared/hooks/useScrollPreservation", () => ({
  useScrollPreservation: () => ({
    onBeforeTabChange: hoisted.onBeforeTabChange,
    scrollRef: { current: null },
  }),
}));

vi.mock("~/store/zustand/tabs", () => ({
  useTabs: vi.fn((selector: (state: unknown) => unknown) =>
    selector({
      updateSessionTabState: hoisted.updateSessionTabState,
    }),
  ),
}));

vi.mock("~/stt/contexts", () => ({
  useListener: (
    selector: (state: {
      getSessionMode: (sessionId: string) => string;
    }) => unknown,
  ) =>
    selector({
      getSessionMode: () => hoisted.sessionMode,
    }),
}));

vi.mock("~/stt/saved-capture-audio", () => ({
  SavedCaptureAudioPrompt: () => null,
}));

vi.mock("react-hotkeys-hook", () => ({
  useHotkeys: (keys: string, callback: () => void) => {
    hoisted.hotkeys.push({ keys, callback });
  },
}));

function formatEditorView(view: EditorView) {
  return view.type === "enhanced" ? `enhanced:${view.id}` : view.type;
}

function createEditorRef() {
  return {
    view: null,
    flushPendingChanges: hoisted.flushPendingChanges,
    commands: {
      focus: () => {},
      focusAtStart: () => {},
      focusAtTrailingEmptyLine: hoisted.focusAtTrailingEmptyLine,
      focusAtPixelWidth: () => {},
      insertAtStartAndFocus: () => {},
      replaceContent: () => {},
      setSearch: () => {},
      replace: () => {},
    },
  };
}

function renderNoteInput({
  currentTab = { type: "raw" },
  handleTabChange = vi.fn(),
  transcriptEditMode = false,
  eventTitle,
  eventDescription,
  showMetaChips = false,
}: {
  currentTab?: EditorView;
  handleTabChange?: (view: EditorView) => void;
  transcriptEditMode?: boolean;
  eventTitle?: string;
  eventDescription?: string;
  showMetaChips?: boolean;
} = {}) {
  return {
    handleTabChange,
    ...render(
      <NoteInput
        tab={{
          active: true,
          id: "session-1",
          pinned: false,
          slotId: "slot-1",
          state: { autoStart: null, view: currentTab },
          type: "sessions",
        }}
        rawMd="stored memo"
        sessionTitle="Stored title"
        eventTitle={eventTitle}
        eventDescription={eventDescription}
        editorTabs={hoisted.editorTabs}
        currentTab={currentTab}
        handleTabChange={handleTabChange}
        transcriptEditMode={transcriptEditMode}
        showMetaChips={showMetaChips}
      />,
    ),
  };
}

describe("NoteInput tab selection", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    hoisted.editorTabs = [{ type: "raw" }, { type: "transcript" }];
    hoisted.hotkeys = [];
    hoisted.enhancedHasProseMirror = true;
    hoisted.enhancedEditorProps = [];
    hoisted.focusAtTrailingEmptyLine.mockClear();
    hoisted.focusTitle.mockClear();
    hoisted.flushPendingChanges.mockClear();
    hoisted.onBeforeTabChange.mockClear();
    hoisted.rawEditorProps = [];
    hoisted.registerCanonicalSessionEditor.mockClear();
    hoisted.searchVisible = false;
    hoisted.sessionMode = "inactive";
    hoisted.unregisterCanonicalSessionEditor.mockClear();
    hoisted.updateSessionTabState.mockClear();
  });

  it("does not move the header ahead of the parent tab state", () => {
    const { handleTabChange } = renderNoteInput();

    fireEvent.click(screen.getByRole("button", { name: "transcript" }));

    expect(handleTabChange).toHaveBeenCalledWith({ type: "transcript" });
    expect(screen.getByTestId("current-tab").textContent).toBe("raw");
  });

  it.each([
    ["mod+alt+right", { type: "transcript" }],
    ["mod+alt+left", { type: "enhanced", id: "summary-1" }],
  ])("switches note views with %s", (keys, expected) => {
    hoisted.editorTabs = [
      { type: "enhanced", id: "summary-1" },
      { type: "raw" },
      { type: "transcript" },
    ];
    const { handleTabChange } = renderNoteInput();

    hoisted.hotkeys.find((hotkey) => hotkey.keys === keys)?.callback();

    expect(handleTabChange).toHaveBeenCalledWith(expected);
    expect(hoisted.onBeforeTabChange).toHaveBeenCalledOnce();
  });

  it("reflects the parent-selected tab in the header", () => {
    const { rerender, handleTabChange } = renderNoteInput();
    const currentTab = { type: "transcript" } satisfies EditorView;

    rerender(
      <NoteInput
        tab={{
          active: true,
          id: "session-1",
          pinned: false,
          slotId: "slot-1",
          state: { autoStart: null, view: currentTab },
          type: "sessions",
        }}
        rawMd="stored memo"
        sessionTitle="Stored title"
        editorTabs={hoisted.editorTabs}
        currentTab={currentTab}
        handleTabChange={handleTabChange}
      />,
    );

    expect(screen.getByTestId("current-tab").textContent).toBe("transcript");
  });

  it.each([
    ["active", "false"],
    ["finalizing", "true"],
    ["running_batch", "true"],
  ])("reports transcription progress while %s", (mode, expected) => {
    hoisted.sessionMode = mode;

    renderNoteInput();

    expect(screen.getByTestId("is-transcribing").textContent).toBe(expected);
  });

  it("passes hydrated session content to the memo editor", () => {
    renderNoteInput({
      eventTitle: "Customer discovery",
      eventDescription: "Learn about the prospect's workflow",
    });

    expect(
      hoisted.rawEditorProps[hoisted.rawEditorProps.length - 1],
    ).toMatchObject({
      rawMd: "stored memo",
      sessionTitle: "Stored title",
      eventTitle: "Customer discovery",
      eventDescription: "Learn about the prospect's workflow",
    });
  });

  it("tracks the mounted memo editor until its view is disposed", () => {
    renderNoteInput();
    const props = hoisted.rawEditorProps[hoisted.rawEditorProps.length - 1] as {
      onViewReady?: (view: unknown) => void;
      onViewDisposed?: (view: unknown) => void;
    };
    const view = { hasFocus: () => true };

    props.onViewReady?.(view);
    expect(hoisted.registerCanonicalSessionEditor).toHaveBeenCalledWith(
      "session-1",
      view,
      expect.any(Function),
    );

    props.onViewDisposed?.(view);
    expect(hoisted.unregisterCanonicalSessionEditor).toHaveBeenCalledWith(
      "session-1",
      view,
    );
  });

  it("tracks the mounted summary editor because it can update the session title", () => {
    hoisted.editorTabs = [
      { type: "enhanced", id: "summary-1" },
      { type: "raw" },
    ];
    renderNoteInput({
      currentTab: { type: "enhanced", id: "summary-1" },
    });
    const props = hoisted.enhancedEditorProps[
      hoisted.enhancedEditorProps.length - 1
    ] as { onViewReady?: (view: unknown) => void };
    const view = { hasFocus: () => true };

    props.onViewReady?.(view);

    expect(hoisted.registerCanonicalSessionEditor).toHaveBeenCalledWith(
      "session-1",
      view,
      expect.any(Function),
    );
  });

  it("focuses the trailing body line when blank editor space is clicked", () => {
    renderNoteInput();

    const scrollContainer = screen.getByTestId("raw-editor").parentElement;
    expect(scrollContainer).not.toBeNull();

    fireEvent.mouseDown(scrollContainer!, { button: 0 });

    expect(hoisted.focusAtTrailingEmptyLine).toHaveBeenCalledTimes(1);
  });

  it("lets ProseMirror handle clicks inside the document", () => {
    renderNoteInput();

    fireEvent.mouseDown(screen.getByTestId("mock-prosemirror"), { button: 0 });

    expect(hoisted.focusAtTrailingEmptyLine).not.toHaveBeenCalled();
  });

  it("preserves controls when the enhanced view has no editor", () => {
    hoisted.editorTabs = [
      { type: "enhanced", id: "summary-1" },
      { type: "raw" },
    ];
    hoisted.enhancedHasProseMirror = false;
    renderNoteInput({
      currentTab: { type: "enhanced", id: "summary-1" },
    });

    const wasNotCancelled = fireEvent.mouseDown(
      screen.getByRole("button", { name: "Retry summary" }),
      { button: 0 },
    );

    expect(wasNotCancelled).toBe(true);
    expect(hoisted.focusAtTrailingEmptyLine).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    "shows the transcript search bar only when find is open (%s)",
    (searchVisible) => {
      hoisted.searchVisible = searchVisible;

      renderNoteInput({ currentTab: { type: "transcript" } });

      expect(screen.queryByTestId("search-bar") !== null).toBe(searchVisible);
    },
  );

  // granola-compare-oct3 §1: centered column and the chip row under the title.
  it("sets the note in a centered 680 px column with the chip row", () => {
    renderNoteInput({ showMetaChips: true });

    const column = document.querySelector("[data-note-column]")!;
    expect(column.className).toContain("mx-auto");
    expect(column.className).toContain("max-w-[680px]");
    expect(column.className).toContain("note-meta-chips-host");
    expect(column.contains(screen.getByTestId("meta-chips"))).toBe(true);
    expect(column.contains(screen.getByTestId("raw-editor"))).toBe(true);
  });

  // Fork tests: installed-build review Oct 3 (P1: an empty note had no
  // title field; P1: no Generate summary in My notes).
  it("shows the title field with a placeholder above the chips in My notes", () => {
    renderNoteInput({ showMetaChips: true });

    const title = screen.getByRole("textbox", { name: "Note title" });
    expect(title.getAttribute("placeholder")).toBe("Untitled");
    expect(title.getAttribute("data-variant")).toBe("note");
    const anchor = title.closest("[data-note-title-anchor]") as HTMLElement;
    expect(anchor.style.marginBottom).toBe(
      "var(--note-meta-chips-space, 3rem)",
    );
    const chips = screen.getByTestId("meta-chips-layer");
    expect(
      anchor.compareDocumentPosition(chips) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("moves from the top of My notes back up to the title", () => {
    renderNoteInput({ showMetaChips: true });

    const onNavigateToTitle = hoisted.rawEditorProps[
      hoisted.rawEditorProps.length - 1
    ]?.onNavigateToTitle as (pixelWidth?: number) => void;
    onNavigateToTitle(12);
    expect(hoisted.focusTitle).toHaveBeenCalledWith(12);
  });

  it("offers Generate summary in My notes, not on the Summary", () => {
    renderNoteInput({ showMetaChips: true });
    expect(screen.getByTestId("generate-summary-offer")).not.toBeNull();
    cleanup();

    hoisted.editorTabs = [{ type: "enhanced", id: "note-1" }, { type: "raw" }];
    renderNoteInput({
      currentTab: { type: "enhanced", id: "note-1" },
      showMetaChips: true,
    });
    expect(screen.queryByTestId("generate-summary-offer")).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Note title" })).toBeNull();
  });

  it("keeps the chip row off other note surfaces", () => {
    renderNoteInput();

    expect(screen.queryByTestId("meta-chips")).toBeNull();
    expect(
      document.querySelector("[data-note-column]")?.className,
    ).not.toContain("note-meta-chips-host");
  });

  it("puts the transcript toolbar above the transcript on the note page", () => {
    renderNoteInput({
      currentTab: { type: "transcript" },
      showMetaChips: true,
    });

    expect(screen.getByTestId("transcript-toolbar")).not.toBeNull();
    expect(screen.queryByTestId("meta-chips")).toBeNull();
  });
});
