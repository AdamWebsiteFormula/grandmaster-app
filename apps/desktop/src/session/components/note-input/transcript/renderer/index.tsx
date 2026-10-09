import { t } from "@lingui/core/macro";
import {
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { useHotkeys } from "react-hotkeys-hook";

import { toast } from "@anlg/ui/components/ui/toast";
import { ArrowDown, ArrowUp } from "@anlg/ui/components/icons";
import { cn } from "@anlg/utils";

import {
  focusTranscriptSelection,
  getTranscriptContextSelection,
  getTranscriptMergeTarget,
  getTranscriptSectionKeyFromElement,
  getTranscriptSectionSelection,
  mergeTranscriptSelections,
  type TranscriptWordSelection,
} from "./selection";
import {
  TranscriptSelectionProvider,
  useTranscriptSelectionSources,
} from "./selection-context";
import { MultiSelectionBar, SelectionMenu } from "./selection-menu";
import type { TranscriptContextMenuRequest } from "./selection-menu";
import { TranscriptSeparator } from "./separator";
import { RenderTranscript } from "./transcript";
import {
  preserveScrollPosition,
  useAutoScroll,
  usePlaybackAutoScroll,
  useScrollDetection,
} from "./viewport-hooks";

import { trackAnalyticsEvent } from "~/analytics";
import { useAudioPlayer } from "~/audio-player";
import { useAudioTime } from "~/audio-player/provider";
import type { Segment } from "~/stt/live-segment";
import { copyTextToClipboard } from "~/session/components/note-input/header-shared";
import {
  assignTranscriptSpeaker,
  getTranscriptRecord,
  mergeTranscriptSegments,
  updateTranscriptSegmentText,
} from "~/stt/queries";

const LIVE_TRANSCRIPT_PLACEHOLDER_ID = "__live-transcript__";

export function TranscriptViewer({
  transcriptIds,
  liveSegments,
  currentActive,
  captureGeneration = 0,
  scrollRef,
  editMode = false,
  onEditModeChange,
  footer,
}: {
  footer?: ReactNode;
  transcriptIds: string[];
  liveSegments: Segment[];
  currentActive: boolean;
  captureGeneration?: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  editMode?: boolean;
  onEditModeChange?: (editMode: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );
  const [contextRequest, setContextRequest] =
    useState<TranscriptContextMenuRequest | null>(null);
  const [selectedEntries, setSelectedEntries] = useState<
    Map<string, TranscriptWordSelection>
  >(() => new Map());
  const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null);
  const [selectionForEditMode, setSelectionForEditMode] = useState(editMode);
  if (selectionForEditMode !== editMode) {
    setSelectionForEditMode(editMode);
    if (!editMode) {
      setSelectedEntries(new Map());
      setSelectionAnchor(null);
    }
  }
  const selectMode = editMode;
  const selectedKeys = useMemo(
    () => new Set(selectedEntries.keys()),
    [selectedEntries],
  );
  const { registerSource, collectEntries } = useTranscriptSelectionSources();
  const multiSelection = useMemo(
    () => mergeTranscriptSelections([...selectedEntries.values()]),
    [selectedEntries],
  );
  const handleContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      setScrollElement(node);
      scrollRef.current = node;
    },
    [scrollRef],
  );

  const {
    isAtTop,
    isAtBottom,
    isNearBottom,
    canScroll,
    autoScrollEnabled,
    scrollToTop,
    scrollToBottom,
  } = useScrollDetection(containerRef, currentActive);

  const {
    state: playerState,
    pause,
    resume,
    start,
    seek,
    audioExists,
  } = useAudioPlayer();
  const time = useAudioTime();
  const deferredCurrentMs = useDeferredValue(time.current * 1000);
  const isPlaying = playerState === "playing";
  useHotkeys(
    "space",
    (e) => {
      e.preventDefault();
      if (playerState === "playing") {
        pause();
      } else if (playerState === "paused") {
        resume();
      } else if (playerState === "stopped") {
        start();
      }
    },
    { enableOnFormTags: false, enabled: !editMode },
  );

  usePlaybackAutoScroll(containerRef, deferredCurrentMs, isPlaying);
  const shouldAutoScroll = currentActive && autoScrollEnabled;
  const shouldScrollLastTranscriptToEnd = currentActive && isNearBottom;
  useAutoScroll(
    containerRef,
    [transcriptIds, liveSegments, shouldAutoScroll],
    shouldAutoScroll,
  );
  const visibleTranscriptIds =
    transcriptIds.length > 0
      ? transcriptIds
      : liveSegments.length > 0
        ? [LIVE_TRANSCRIPT_PLACEHOLDER_ID]
        : [];
  const visibleTranscriptIdsRef = useRef(visibleTranscriptIds);
  visibleTranscriptIdsRef.current = visibleTranscriptIds;

  const handleSelectionAction = useCallback(
    (action: "copy" | "play", selection: TranscriptWordSelection) => {
      if (action === "copy") {
        // Fork: say it copied, or that it didn't, as the toolbar's Copy
        // transcript does (task test, Oct 9; NN/g #1, #4).
        void copyTextToClipboard(selection.text, {
          success: t`Copied to clipboard`,
          error: t`Couldn't copy. Try again.`,
        });
        return;
      }

      if (audioExists) {
        seek(selection.startMs / 1000);
        start();
      }
    },
    [audioExists, seek, start],
  );
  const handleAssignSpeaker = useCallback(
    async (
      selection: TranscriptWordSelection,
      humanId: string,
      extendToAdjacent?: boolean,
    ) => {
      await preserveScrollPosition(containerRef.current, () =>
        Promise.all(
          selection.groups.map((group) =>
            assignTranscriptSpeaker({
              transcriptId: group.transcriptId,
              segmentKey: group.segmentKey,
              humanId,
              anchorWordId: group.wordIds[0]!,
              mode: "segment",
              wordIds: group.wordIds,
              extendToAdjacent,
            }),
          ),
        ),
      );
      trackAnalyticsEvent("participant_assigned", {
        assignment_scope: "selection",
        word_count: selection.groups.reduce(
          (count, group) => count + group.wordIds.length,
          0,
        ),
      });
    },
    [],
  );
  const handleEditSelection = useCallback(
    (selection: TranscriptWordSelection) => {
      flushSync(() => onEditModeChange?.(true));
      if (containerRef.current) {
        focusTranscriptSelection(selection, containerRef.current);
      }
    },
    [onEditModeChange],
  );
  const handleChangeSpeakerSelection = useCallback(
    (selection: TranscriptWordSelection) => {
      flushSync(() => onEditModeChange?.(true));
      const container = containerRef.current;
      if (!container) return;
      const editor = focusTranscriptSelection(selection, container);
      if (!editor) return;
      window.getSelection()?.collapseToStart();
      editor.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    [onEditModeChange],
  );
  const handleMergeSegments = useCallback(async () => {
    const { order, entries } = collectEntries(visibleTranscriptIdsRef.current);
    const target = getTranscriptMergeTarget(
      new Set(selectedEntries.keys()),
      order,
      entries,
    );
    const targetGroup = target?.groups[0];
    const selection = mergeTranscriptSelections([...selectedEntries.values()]);
    if (!targetGroup || !selection) {
      return;
    }

    const groups = selection.groups.filter(
      (group) => group.transcriptId === targetGroup.transcriptId,
    );
    // Fork: a failed merge says so instead of failing in silence (task
    // test, Oct 9; NN/g #9).
    try {
      await preserveScrollPosition(containerRef.current, () =>
        Promise.all(
          groups.map((group) =>
            mergeTranscriptSegments({
              transcriptId: group.transcriptId,
              segmentKey: targetGroup.segmentKey,
              wordIds: group.wordIds,
            }),
          ),
        ),
      );
    } catch (error) {
      console.error("[transcript] failed to merge lines", error);
      toast.error(t`Couldn't merge these lines. Try again.`);
      return;
    }
    trackAnalyticsEvent("participant_assigned", {
      assignment_scope: "merge",
      word_count: groups.reduce(
        (count, group) => count + group.wordIds.length,
        0,
      ),
    });
  }, [collectEntries, selectedEntries]);
  const handleDeleteSelection = useCallback(
    async (selection: TranscriptWordSelection) => {
      const wordsByTranscript = new Map<string, Set<string>>();
      for (const group of selection.groups) {
        const wordIds =
          wordsByTranscript.get(group.transcriptId) ?? new Set<string>();
        group.wordIds.forEach((wordId) => wordIds.add(wordId));
        wordsByTranscript.set(group.transcriptId, wordIds);
      }
      // Fork: remember the deleted words so the toast can undo (ux-audit-oct3 C, NN/g #5).
      const originals: {
        transcriptId: string;
        wordId: string;
        text: string;
      }[] = [];
      for (const [transcriptId, wordIds] of wordsByTranscript) {
        const record = await getTranscriptRecord(transcriptId);
        for (const word of record?.words ?? []) {
          if (wordIds.has(word.id) && word.text) {
            originals.push({ transcriptId, wordId: word.id, text: word.text });
          }
        }
      }
      await preserveScrollPosition(containerRef.current, () =>
        Promise.all(
          [...wordsByTranscript].map(([transcriptId, wordIds]) =>
            updateTranscriptSegmentText({
              transcriptId,
              wordIds: [...wordIds],
              text: "",
            }),
          ),
        ),
      );

      return async () => {
        for (const original of originals) {
          await updateTranscriptSegmentText({
            transcriptId: original.transcriptId,
            wordIds: [original.wordId],
            text: original.text,
          });
        }
      };
    },
    [],
  );
  const canMergeSelection = useMemo(() => {
    if (selectedEntries.size < 2) {
      return false;
    }
    const { order, entries } = collectEntries(visibleTranscriptIds);
    return getTranscriptMergeTarget(selectedKeys, order, entries) != null;
  }, [
    collectEntries,
    selectedEntries.size,
    selectedKeys,
    visibleTranscriptIds,
  ]);
  const handleContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (selectMode) {
        return;
      }
      const nativeSelection = window.getSelection();
      const activeRange =
        nativeSelection && nativeSelection.rangeCount > 0
          ? nativeSelection.getRangeAt(0)
          : undefined;
      const request = getTranscriptContextSelection({
        target: event.target,
        container: event.currentTarget,
        activeRange,
      });
      if (!request) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setContextRequest({
        id: crypto.randomUUID(),
        range: request.range,
        selection: request.selection,
        x: event.clientX,
        y: event.clientY,
      });
    },
    [selectMode],
  );
  const handleContextClose = useCallback(() => {
    setContextRequest(null);
  }, []);
  const clearSelectedEntries = useCallback(() => {
    setSelectedEntries(new Map());
    setSelectionAnchor(null);
  }, []);

  useHotkeys(
    "esc",
    (event) => {
      event.preventDefault();
      clearSelectedEntries();
    },
    { enabled: editMode && selectedEntries.size > 0 },
  );

  useHotkeys(
    "mod+shift+up, mod+shift+down",
    (event) => {
      if (
        event.target instanceof Element &&
        event.target.closest("[data-transcript-editor], [contenteditable=true]")
      ) {
        return;
      }
      const { order, entries } = collectEntries(
        visibleTranscriptIdsRef.current,
      );
      const anchorIndex = selectionAnchor ? order.indexOf(selectionAnchor) : -1;
      if (anchorIndex === -1) {
        return;
      }

      event.preventDefault();
      window.getSelection()?.removeAllRanges();
      const keys =
        event.key === "ArrowUp"
          ? order.slice(0, anchorIndex + 1)
          : order.slice(anchorIndex);
      setSelectedEntries(new Map(keys.map((key) => [key, entries.get(key)!])));
    },
    {
      enabled: selectedEntries.size > 0,
      enableOnFormTags: false,
      enableOnContentEditable: false,
    },
  );

  const handleSegmentSelection = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const target = event.target;
      const section =
        target instanceof Element
          ? target.closest<HTMLElement>("section[data-transcript-segment-id]")
          : null;
      if (!section || !event.currentTarget.contains(section)) {
        return;
      }
      if (
        target instanceof Element &&
        target.closest(
          "button, a, input, textarea, [data-transcript-speaker-assign], [data-transcript-editor]",
        )
      ) {
        return;
      }

      const hasSelectionModifier =
        event.metaKey || event.ctrlKey || event.shiftKey;
      if (!selectMode && !hasSelectionModifier) {
        if (selectedEntries.size > 0) {
          clearSelectedEntries();
        }
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      window.getSelection()?.removeAllRanges();
      const container = event.currentTarget;
      const targetKey = getTranscriptSectionKeyFromElement(section);
      if (!targetKey) {
        return;
      }
      const { order, entries } = collectEntries(
        visibleTranscriptIdsRef.current,
      );

      setSelectedEntries((current) => {
        const next = new Map(current);
        if (event.shiftKey && selectionAnchor) {
          const anchorIndex = order.indexOf(selectionAnchor);
          const targetIndex = order.indexOf(targetKey);
          if (anchorIndex !== -1 && targetIndex !== -1) {
            const start = Math.min(anchorIndex, targetIndex);
            const end = Math.max(anchorIndex, targetIndex);
            for (const key of order.slice(start, end + 1)) {
              const selection = entries.get(key);
              if (selection) {
                next.set(key, selection);
              }
            }
            return next;
          }
        }

        if (next.has(targetKey)) {
          next.delete(targetKey);
        } else {
          const selection =
            entries.get(targetKey) ??
            getTranscriptSectionSelection(section, container);
          if (selection) {
            next.set(targetKey, selection);
          }
        }
        return next;
      });
      setSelectionAnchor(targetKey);
    },
    [
      clearSelectedEntries,
      collectEntries,
      selectMode,
      selectedEntries.size,
      selectionAnchor,
    ],
  );

  return (
    <TranscriptSelectionProvider
      selectMode={selectMode}
      selectedKeys={selectedKeys}
      registerSource={registerSource}
    >
      <div className="relative flex h-full flex-col">
        <div
          ref={handleContainerRef}
          data-transcript-container
          data-transcript-select-mode={selectMode ? "true" : undefined}
          onClickCapture={handleSegmentSelection}
          onContextMenu={handleContextMenu}
          className={cn([
            "flex min-h-0 min-w-0 flex-1 flex-col gap-8 overflow-x-clip overflow-y-auto",
            // Fork: the same centered 576 px column as the notes, while the
            // whole pane still scrolls (granola-compare-oct3 §1-2).
            "px-[max(0px,calc((100%_-_576px)/2))]",
            "scrollbar-hide",
            "scroll-pb-[calc(8rem+env(safe-area-inset-bottom))]",
            // Fork: the newest line rests above the floating bar and its fade
            // (56 px + 24 px) with 16 px of air, so live text never looks
            // washed out (Apple HIG, Scroll views: content insets).
            "pb-[calc(6rem+env(safe-area-inset-bottom))]",
          ])}
        >
          {visibleTranscriptIds.map((transcriptId, index) => {
            const isLastTranscript = index === visibleTranscriptIds.length - 1;
            const isActiveTranscript = currentActive && isLastTranscript;

            return (
              <div key={transcriptId} className="flex flex-col gap-8">
                <RenderTranscript
                  scrollElement={scrollElement}
                  isLastTranscript={isLastTranscript}
                  shouldScrollToEnd={shouldScrollLastTranscriptToEnd}
                  transcriptId={transcriptId}
                  currentActive={isActiveTranscript}
                  captureGeneration={isActiveTranscript ? captureGeneration : 0}
                  liveSegments={isActiveTranscript ? liveSegments : []}
                  currentMs={deferredCurrentMs}
                  seek={seek}
                  startPlayback={start}
                  audioExists={audioExists}
                  editMode={editMode}
                />
                {!isLastTranscript && <TranscriptSeparator />}
              </div>
            );
          })}

          {footer}

          <SelectionMenu
            containerRef={containerRef}
            contextRequest={contextRequest}
            audioExists={audioExists}
            onContextClose={handleContextClose}
            onAction={handleSelectionAction}
            onEdit={onEditModeChange ? handleEditSelection : undefined}
            onChangeSpeaker={
              onEditModeChange ? handleChangeSpeakerSelection : undefined
            }
          />
        </div>

        {multiSelection && (
          <MultiSelectionBar
            selection={multiSelection}
            entryCount={selectedEntries.size}
            canMerge={canMergeSelection}
            onClear={clearSelectedEntries}
            onAssignSpeaker={handleAssignSpeaker}
            onMerge={handleMergeSegments}
            onDelete={
              editMode && !currentActive ? handleDeleteSelection : undefined
            }
          />
        )}

        {canScroll && (
          <div
            data-transcript-scroll-controls
            className={cn([
              "group/scroll-controls absolute top-1/2 right-1 z-40 flex -translate-y-1/2 flex-col overflow-hidden",
              "text-muted-foreground rounded-full border border-transparent bg-transparent",
              "transition-[background-color,border-color,color,box-shadow,backdrop-filter] duration-150",
              "hover:border-border/50 hover:bg-background/65 hover:text-foreground hover:shadow-sm hover:backdrop-blur-md",
              "focus-within:border-border/50 focus-within:bg-background/65 focus-within:text-foreground focus-within:shadow-sm focus-within:backdrop-blur-md",
            ])}
          >
            <button
              type="button"
              aria-label={t`Scroll to top`}
              onClick={scrollToTop}
              disabled={isAtTop}
              className={cn([
                "flex size-8 items-center justify-center",
                "hover:bg-muted/55 active:bg-muted/70 focus-visible:bg-muted/55 focus-visible:outline-none",
                "disabled:pointer-events-none disabled:opacity-30",
              ])}
            >
              <ArrowUp aria-hidden="true" className="size-3.5" />
            </button>
            <div className="bg-border/20 group-hover/scroll-controls:bg-border/60 group-focus-within/scroll-controls:bg-border/60 h-px w-full transition-colors" />
            <button
              type="button"
              aria-label={t`Scroll to bottom`}
              onClick={scrollToBottom}
              disabled={isAtBottom}
              className={cn([
                "flex size-8 items-center justify-center",
                "hover:bg-muted/55 active:bg-muted/70 focus-visible:bg-muted/55 focus-visible:outline-none",
                "disabled:pointer-events-none disabled:opacity-30",
              ])}
            >
              <ArrowDown aria-hidden="true" className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </TranscriptSelectionProvider>
  );
}
