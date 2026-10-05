import type { EditorView } from "prosemirror-view";
import {
  forwardRef,
  type MouseEventHandler,
  type ReactNode,
  type UIEventHandler,
  useCallback,
  useDeferredValue,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";

import type { JSONContent, NoteEditorRef } from "@anlg/editor/note";
import { cn } from "@anlg/utils";

import { Enhanced } from "./enhanced";
import { GenerateSummaryOffer } from "./generate-summary-offer";
import { Header, SessionViewSwitcher, useEditorTabs } from "./header";
import { NoteMetaChips, NoteMetaChipsLayer } from "./meta-chips";
import { RawEditor } from "./raw";
import { SearchBar } from "./search/bar";
import { useSearch } from "./search/context";
import { Transcript } from "./transcript";
import { TranscriptToolbar } from "./transcript-toolbar";

import {
  registerCanonicalSessionEditor,
  unregisterCanonicalSessionEditor,
} from "~/session-sharing/editor-activity";
import { useCurrentNoteTab } from "~/session/components/shared";
import {
  TitleInput,
  type TitleInputHandle,
} from "~/session/components/title-input";
import { useScrollPreservation } from "~/shared/hooks/useScrollPreservation";
import type { SessionMode } from "~/store/zustand/listener/general";
import { type Tab, useTabs } from "~/store/zustand/tabs";
import { type EditorView as TabEditorView } from "~/store/zustand/tabs/schema";
import { useListener } from "~/stt/contexts";
import { SavedCaptureAudioPrompt } from "~/stt/saved-capture-audio";

export interface NoteInputHandle {
  focus: () => void;
  focusAtStart: () => void;
  focusAtPixelWidth: (pixelWidth: number) => void;
  insertAtStartAndFocus: (content: string) => void;
  replaceContent: (content: JSONContent) => void;
  flushPendingChanges: () => void;
  prepareForTabChange: () => void;
}

type NoteInputProps = {
  tab: Extract<Tab, { type: "sessions" }>;
  rawMd: string;
  sessionTitle: string;
  eventTitle?: string;
  eventDescription?: string;
  onNavigateToTitle?: (pixelWidth?: number) => void;
  onScroll?: UIEventHandler<HTMLDivElement>;
  editorTabs?: TabEditorView[];
  currentTab?: TabEditorView;
  handleTabChange?: (view: TabEditorView) => void;
  hideHeader?: boolean;
  /** Note page: chip row under the title and a centered reading column. */
  showMetaChips?: boolean;
  sessionMode?: SessionMode;
  transcriptEditMode?: boolean;
  onTranscriptEditModeChange?: (editMode: boolean) => void;
  /** Note page: the audio player, drawn under the title on the transcript. */
  transcriptAudioPlayer?: ReactNode;
};

export function shouldShowTranscriptTabSpinner(sessionMode: SessionMode) {
  return sessionMode === "finalizing" || sessionMode === "running_batch";
}

export const NoteInput = forwardRef<NoteInputHandle, NoteInputProps>(
  function NoteInput(props, ref) {
    if (
      props.editorTabs &&
      props.currentTab &&
      props.handleTabChange &&
      props.sessionMode !== undefined
    ) {
      return (
        <NoteInputContent
          {...props}
          ref={ref}
          editorTabs={props.editorTabs}
          currentTab={props.currentTab}
          commitTabChange={props.handleTabChange}
          sessionMode={props.sessionMode}
        />
      );
    }

    return <NoteInputWithDerivedState {...props} ref={ref} />;
  },
);

const NoteInputWithDerivedState = forwardRef<NoteInputHandle, NoteInputProps>(
  function NoteInputWithDerivedState(
    { tab, editorTabs, currentTab, handleTabChange, ...props },
    ref,
  ) {
    const fallbackEditorTabs = useEditorTabs({ sessionId: tab.id });
    const fallbackCurrentTab: TabEditorView = useCurrentNoteTab(tab);
    const updateSessionTabState = useTabs(
      (state) => state.updateSessionTabState,
    );
    const tabRef = useRef(tab);
    tabRef.current = tab;
    const sessionMode = useListener((state) => state.getSessionMode(tab.id));

    const commitTabChange = useCallback(
      (tabView: TabEditorView) => {
        if (handleTabChange) {
          handleTabChange(tabView);
          return;
        }

        updateSessionTabState(tabRef.current, {
          ...tabRef.current.state,
          view: tabView,
        });
      },
      [handleTabChange, updateSessionTabState],
    );

    return (
      <NoteInputContent
        {...props}
        ref={ref}
        tab={tab}
        editorTabs={editorTabs ?? fallbackEditorTabs}
        currentTab={currentTab ?? fallbackCurrentTab}
        commitTabChange={commitTabChange}
        sessionMode={props.sessionMode ?? sessionMode}
      />
    );
  },
);

const NoteInputContent = forwardRef<
  NoteInputHandle,
  Omit<NoteInputProps, "editorTabs" | "currentTab" | "handleTabChange"> & {
    editorTabs: TabEditorView[];
    currentTab: TabEditorView;
    commitTabChange: (view: TabEditorView) => void;
    sessionMode: SessionMode;
  }
>(
  (
    {
      tab,
      rawMd,
      sessionTitle,
      eventTitle,
      eventDescription,
      onNavigateToTitle,
      onScroll,
      editorTabs,
      currentTab,
      commitTabChange,
      hideHeader = false,
      showMetaChips = false,
      sessionMode,
      transcriptEditMode = false,
      onTranscriptEditModeChange,
      transcriptAudioPlayer,
    },
    ref,
  ) => {
    const internalEditorRef = useRef<NoteEditorRef>(null);
    const titleRef = useRef<TitleInputHandle>(null);
    const sessionId = tab.id;
    const deferredCurrentTab = useDeferredValue(currentTab);
    const renderedCurrentTab = editorTabs.some((editorTab) =>
      isSameEditorView(editorTab, deferredCurrentTab),
    )
      ? deferredCurrentTab
      : currentTab;

    const isMeetingInProgress =
      sessionMode === "active" ||
      sessionMode === "finalizing" ||
      sessionMode === "running_batch";
    const shouldShowTranscriptSpinner =
      shouldShowTranscriptTabSpinner(sessionMode);

    const { scrollRef, onBeforeTabChange } = useScrollPreservation(
      renderedCurrentTab.type === "enhanced"
        ? `enhanced-${renderedCurrentTab.id}`
        : renderedCurrentTab.type,
    );

    useImperativeHandle(
      ref,
      () => ({
        focus: () => internalEditorRef.current?.commands.focus(),
        focusAtStart: () => internalEditorRef.current?.commands.focusAtStart(),
        focusAtPixelWidth: (px) =>
          internalEditorRef.current?.commands.focusAtPixelWidth(px),
        insertAtStartAndFocus: (content) =>
          internalEditorRef.current?.commands.insertAtStartAndFocus(content),
        replaceContent: (content) =>
          internalEditorRef.current?.commands.replaceContent(content),
        flushPendingChanges: () =>
          internalEditorRef.current?.flushPendingChanges(),
        prepareForTabChange: onBeforeTabChange,
      }),
      [currentTab, onBeforeTabChange],
    );

    const handleTabChange = useCallback(
      (tabView: TabEditorView) => {
        if (
          isSameEditorView(tabView, currentTab) ||
          isSameEditorView(tabView, renderedCurrentTab)
        ) {
          return;
        }

        onBeforeTabChange();
        commitTabChange(tabView);
      },
      [commitTabChange, currentTab, onBeforeTabChange, renderedCurrentTab],
    );

    const handleAdjacentViewShortcut = useCallback(
      (direction: "previous" | "next") => {
        if (editorTabs.length <= 1) {
          return;
        }

        const currentIndex = editorTabs.findIndex((editorTab) =>
          isSameEditorView(editorTab, renderedCurrentTab),
        );
        if (currentIndex === -1) {
          return;
        }

        const nextIndex =
          direction === "previous"
            ? (currentIndex - 1 + editorTabs.length) % editorTabs.length
            : (currentIndex + 1) % editorTabs.length;
        const nextView = editorTabs[nextIndex];
        if (nextView) {
          handleTabChange(nextView);
        }
      },
      [editorTabs, handleTabChange, renderedCurrentTab],
    );

    useHotkeys(
      "mod+alt+left",
      () => handleAdjacentViewShortcut("previous"),
      {
        preventDefault: true,
        enableOnFormTags: true,
        enableOnContentEditable: true,
      },
      [handleAdjacentViewShortcut],
    );

    useHotkeys(
      "mod+alt+right",
      () => handleAdjacentViewShortcut("next"),
      {
        preventDefault: true,
        enableOnFormTags: true,
        enableOnContentEditable: true,
      },
      [handleAdjacentViewShortcut],
    );

    useEffect(() => {
      if (renderedCurrentTab.type === "raw" && isMeetingInProgress) {
        requestAnimationFrame(() => {
          internalEditorRef.current?.commands.focus();
        });
      }
    }, [renderedCurrentTab, isMeetingInProgress]);

    // Fork: My notes shows an editable title above the chip row, with an
    // "Untitled" placeholder when empty, as Granola sets the title above its
    // chips (granola-compare-oct3 §1, screen 04). The Summary keeps its
    // first-line title inside the editor.
    const showNoteTitle = showMetaChips && renderedCurrentTab.type === "raw";
    const handleNavigateToTitle = useCallback(
      (pixelWidth?: number) => {
        if (onNavigateToTitle) {
          onNavigateToTitle(pixelWidth);
          return;
        }
        if (pixelWidth === undefined) {
          titleRef.current?.focusAtEnd();
          return;
        }
        titleRef.current?.focusAtPixelWidth(pixelWidth);
      },
      [onNavigateToTitle],
    );

    const search = useSearch();
    const showSearchBar = search?.isVisible ?? false;
    const isEditableTab =
      renderedCurrentTab.type === "enhanced" ||
      renderedCurrentTab.type === "raw";
    const isSearchableTab =
      isEditableTab || renderedCurrentTab.type === "transcript";

    useEffect(() => {
      search?.close();
    }, [currentTab]);

    const handleContainerMouseDown: MouseEventHandler<HTMLDivElement> = (
      event,
    ) => {
      if (!isEditableTab) {
        return;
      }

      if (event.button !== 0) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (target.closest(".ProseMirror") !== null) {
        return;
      }

      if (
        target.closest(
          "button, a, input, textarea, select, [role='button'], [contenteditable='true']",
        ) !== null
      ) {
        return;
      }

      if (event.currentTarget.querySelector(".ProseMirror") === null) {
        return;
      }

      event.preventDefault();
      internalEditorRef.current?.commands.focusAtTrailingEmptyLine();
    };

    const handleSessionViewReady = useCallback(
      (view: EditorView) =>
        registerCanonicalSessionEditor(sessionId, view, () => {
          const editor = internalEditorRef.current;
          if (!editor || editor.view !== view) {
            throw new Error("Canonical session editor changed");
          }
          editor.flushPendingChanges();
        }),
      [sessionId],
    );
    const handleSessionViewDisposed = useCallback(
      (view: EditorView) => unregisterCanonicalSessionEditor(sessionId, view),
      [sessionId],
    );

    return (
      <div className="-mx-2 flex h-full flex-col">
        <SavedCaptureAudioPrompt sessionId={sessionId} />
        {!hideHeader && (
          <div className="relative px-2">
            <div className="flex items-center justify-between gap-1">
              <SessionViewSwitcher
                sessionId={sessionId}
                editorTabs={editorTabs}
                currentTab={renderedCurrentTab}
                handleTabChange={handleTabChange}
                isTranscribing={shouldShowTranscriptSpinner}
              />
              <Header sessionId={sessionId} />
            </div>
          </div>
        )}

        {showSearchBar && isSearchableTab && (
          <div className="px-3 pt-1">
            <SearchBar
              editorRef={internalEditorRef}
              allowReplace={isEditableTab}
            />
          </div>
        )}

        <div className="relative flex-1 overflow-hidden">
          <div
            ref={scrollRef}
            onMouseDown={handleContainerMouseDown}
            onScroll={onScroll}
            className={cn([
              "h-full",
              "pt-2",
              // Fork: the note column sits 32 px inside the panel, the same
              // gutter as Home's column (HOME_COLUMN_CLASS px-8; the -mx-2
              // above cancels the surface's px-2), then centers at 680 px
              // (redline4-oct3; design-system.md "nothing touches edges").
              // The gutter is here, not on the column, so the absolute chip
              // row (inset-x-0) still lines up with the title. pb-28 lets the
              // last line scroll fully clear of the floating bar and its fade
              // (bar top 56 px + fade 24 px + 32 px air; Apple HIG, Scroll
              // views: content insets for floating elements).
              renderedCurrentTab.type === "transcript"
                ? "overflow-hidden px-3 pb-0"
                : "overflow-x-hidden overflow-y-auto px-8 pb-28",
            ])}
          >
            {isEditableTab && (
              // Fork: a centered reading column, as Granola sets its notes
              // (about 620-680 px; Baymard and Butterick put comfortable lines
              // at 45-75 characters). granola-compare-oct3 §1, P1.
              <div
                data-note-column
                className={cn([
                  "relative mx-auto w-full max-w-[680px]",
                  // Fork: Bricolage Grotesque for the note title only; the
                  // summary, chips and body stay Geist (owner's pick, Oct 3).
                  // `!` wins over the editor's unlayered title rule.
                  "[&_.note-title-editor>h1:first-child]:font-display! [&_.note-title-editor>h1:first-child]:font-semibold! [&_.note-title-editor>h1:first-child]:tracking-[-0.01em]!",
                  showMetaChips && "note-meta-chips-host",
                ])}
              >
                {showNoteTitle && (
                  <div
                    data-note-title-anchor
                    // The chip row is drawn in this gap, as under the
                    // Summary's title (note-typography.css).
                    style={{
                      marginBottom: "var(--note-meta-chips-space, 3rem)",
                    }}
                  >
                    <TitleInput
                      ref={titleRef}
                      tab={tab}
                      variant="note"
                      onFocusEditorAtStart={() =>
                        internalEditorRef.current?.commands.focusAtStart()
                      }
                      onTransferContentToEditor={(content) =>
                        internalEditorRef.current?.commands.insertAtStartAndFocus(
                          content,
                        )
                      }
                      onFocusEditorAtPixelWidth={(pixelWidth) =>
                        internalEditorRef.current?.commands.focusAtPixelWidth(
                          pixelWidth,
                        )
                      }
                    />
                  </div>
                )}
                {showMetaChips && (
                  // Keyed by view so the row measures the new title line.
                  <NoteMetaChipsLayer key={renderedCurrentTab.type}>
                    <NoteMetaChips
                      sessionId={sessionId}
                      editorTabs={editorTabs}
                      currentTab={renderedCurrentTab}
                      onSelectView={handleTabChange}
                    />
                  </NoteMetaChipsLayer>
                )}
                {renderedCurrentTab.type === "enhanced" && (
                  <Enhanced
                    ref={internalEditorRef}
                    sessionId={sessionId}
                    sessionTitle={sessionTitle}
                    enhancedNoteId={renderedCurrentTab.id}
                    onNavigateToTitle={onNavigateToTitle}
                    onViewReady={handleSessionViewReady}
                    onViewDisposed={handleSessionViewDisposed}
                  />
                )}
                {showNoteTitle && (
                  <GenerateSummaryOffer sessionId={sessionId} />
                )}
                {renderedCurrentTab.type === "raw" && (
                  <RawEditor
                    ref={internalEditorRef}
                    sessionId={sessionId}
                    rawMd={rawMd}
                    sessionTitle={sessionTitle}
                    eventTitle={eventTitle}
                    eventDescription={eventDescription}
                    onNavigateToTitle={
                      showNoteTitle ? handleNavigateToTitle : onNavigateToTitle
                    }
                    onViewReady={handleSessionViewReady}
                    onViewDisposed={handleSessionViewDisposed}
                  />
                )}
              </div>
            )}
            {renderedCurrentTab.type === "transcript" && (
              <div
                className={cn([
                  "flex h-full min-h-0 flex-col",
                  // Fork: the note's 680 px column, so the title, player and
                  // transcript share one left edge. px-5 adds to the px-3
                  // above for the note's 32 px gutter.
                  showMetaChips && "mx-auto w-full max-w-[720px] px-5",
                ])}
              >
                {showMetaChips && (
                  // Fork: the title and chip row stay in the same place as
                  // on the note, so opening the transcript keeps you in the
                  // note and My notes / Summary are one click back (NN/g #1
                  // and #4; Granola keeps the note in view behind its
                  // transcript panel, Help Center "How transcription
                  // works").
                  <div className="shrink-0">
                    <div className="note-meta-chips-host relative w-full">
                      <div
                        data-note-title-anchor
                        style={{
                          marginBottom: "var(--note-meta-chips-space, 3rem)",
                        }}
                      >
                        <TitleInput tab={tab} variant="note" />
                      </div>
                      <NoteMetaChipsLayer key={renderedCurrentTab.type}>
                        <NoteMetaChips
                          sessionId={sessionId}
                          editorTabs={editorTabs}
                          currentTab={renderedCurrentTab}
                          onSelectView={handleTabChange}
                        />
                      </NoteMetaChipsLayer>
                    </div>
                  </div>
                )}
                {transcriptAudioPlayer}
                {showMetaChips && (
                  <TranscriptToolbar
                    sessionId={sessionId}
                    editMode={transcriptEditMode}
                    onEditModeChange={onTranscriptEditModeChange}
                  />
                )}
                <div className="min-h-0 flex-1">
                  <Transcript
                    sessionId={sessionId}
                    scrollRef={scrollRef}
                    editMode={transcriptEditMode}
                    onEditModeChange={onTranscriptEditModeChange}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);

function isSameEditorView(left: TabEditorView, right: TabEditorView): boolean {
  if (left.type !== right.type) {
    return false;
  }

  if (left.type === "enhanced" && right.type === "enhanced") {
    return left.id === right.id;
  }

  return true;
}
