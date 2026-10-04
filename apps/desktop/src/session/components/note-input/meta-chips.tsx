import { useLingui } from "@lingui/react/macro";
import {
  type CSSProperties,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { CalendarBlank, TextAlignLeft, Users } from "@anlg/ui/components/icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@anlg/ui/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@anlg/ui/components/ui/tooltip";
import { cn, parseEventInstant, safeFormat } from "@anlg/utils";

import { HeaderViewEnhanced } from "./header-enhanced";
import { noteChipClassName } from "./header-shared";

import { FolderPicker } from "~/session/components/folder-picker";
import { MetadataPanelContent } from "~/session/components/outer-header/metadata";
import { useSessionEvent } from "~/session/hooks/useSessionEvent";
import {
  deleteEnhancedNote,
  useSession,
  useSessionParticipants,
} from "~/session/queries";
import type { EditorView } from "~/store/zustand/tabs/schema";

// Fork: Granola sets one row of small outlined chips right under the note
// title: notes view toggle, template pill, date with attendee count, and
// "Add to folder" (granola-compare-oct3 §1, P1). They replace the calendar and
// folder icons that used to hide in the header.

const TITLE_ANCHOR_SELECTOR =
  ".note-title-editor > h1:first-child, [data-note-title-anchor]";
// 8 px between title and chips, 16 px between chips and the body.
const GAP_ABOVE_PX = 8;
const GAP_BELOW_PX = 16;

/**
 * Places the chip row in the gap the title leaves for it. The title is the
 * editor's first line, so the row cannot sit in the document flow; it is
 * drawn over a reserved margin instead (`--note-meta-chips-space`, read by
 * note-typography.css), measured so a wrapped title or row never overlaps.
 */
export function NoteMetaChipsLayer({ children }: { children: ReactNode }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState<number | null>(null);

  // The host is the column this layer is rendered in (its parent element).
  useLayoutEffect(() => {
    const row = rowRef.current;
    const host = row?.parentElement;
    if (!host || !row) {
      return;
    }

    const measure = () => {
      const space = row.offsetHeight + GAP_ABOVE_PX + GAP_BELOW_PX;
      host.style.setProperty("--note-meta-chips-space", `${space}px`);
      const title = host.querySelector<HTMLElement>(TITLE_ANCHOR_SELECTOR);
      if (!title) {
        setTop(null);
        return;
      }
      const next =
        title.getBoundingClientRect().bottom -
        host.getBoundingClientRect().top +
        GAP_ABOVE_PX;
      setTop((previous) => (previous === next ? previous : next));
    };

    measure();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    observer.observe(row);
    return () => {
      observer.disconnect();
      host.style.removeProperty("--note-meta-chips-space");
    };
  }, []);

  const style: CSSProperties | undefined = top === null ? undefined : { top };

  return (
    <div
      ref={rowRef}
      data-note-meta-chips-layer
      style={style}
      className={cn([
        "z-10",
        top === null ? "relative mb-4" : "absolute inset-x-0",
      ])}
    >
      {children}
    </div>
  );
}

export function NoteMetaChips({
  sessionId,
  editorTabs,
  currentTab,
  onSelectView,
}: {
  sessionId: string;
  editorTabs: EditorView[];
  currentTab: EditorView;
  onSelectView: (view: EditorView) => void;
}) {
  const { t } = useLingui();
  const enhancedTabs = editorTabs.filter(
    (view): view is Extract<EditorView, { type: "enhanced" }> =>
      view.type === "enhanced",
  );
  const rawTab = editorTabs.find((view) => view.type === "raw");
  const primaryEnhancedId = enhancedTabs[0]?.id;
  const lastEnhancedRef = useRef<EditorView | null>(null);
  if (currentTab.type === "enhanced") {
    lastEnhancedRef.current = currentTab;
  }

  const rawActive = currentTab.type === "raw";
  const showNotesToggle = Boolean(rawTab) && enhancedTabs.length > 0;
  const handleNotesToggle = () => {
    if (rawActive) {
      const previous = lastEnhancedRef.current;
      const target =
        previous &&
        enhancedTabs.some(
          (view) => previous.type === "enhanced" && view.id === previous.id,
        )
          ? previous
          : enhancedTabs[0];
      if (target) {
        onSelectView(target);
      }
      return;
    }
    if (rawTab) {
      onSelectView(rawTab);
    }
  };

  return (
    <div
      role="group"
      aria-label={t`Note details`}
      data-note-meta-chips
      className="flex flex-wrap items-center gap-1.5"
    >
      {showNotesToggle ? (
        // Fork: a tooltip naming what the chip does next, as Granola's
        // notes toggle shows (redline2-oct3, R2). The chip says "My notes"
        // in words beside the icon, like its neighbors (NN/g "Icon
        // Usability": labels beat icon-only).
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={t`My notes`}
                aria-pressed={rawActive}
                onClick={handleNotesToggle}
                className={noteChipClassName(rawActive)}
              >
                <TextAlignLeft aria-hidden />
                <span className="min-w-0 truncate">{t`My notes`}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {rawActive ? t`Show summary` : t`Show my notes`}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
      {enhancedTabs.map((view, index) => {
        const isActive =
          currentTab.type === "enhanced" && currentTab.id === view.id;
        const canRemove = view.id !== primaryEnhancedId;
        return (
          <HeaderViewEnhanced
            key={`enhanced-${view.id}`}
            variant="chip"
            sessionId={sessionId}
            enhancedNoteId={view.id}
            isActive={isActive}
            canRemove={canRemove}
            onRemove={
              canRemove
                ? () => {
                    const previousView = enhancedTabs[index - 1];
                    if (isActive && previousView) {
                      onSelectView(previousView);
                    }
                    void deleteEnhancedNote(view.id).catch((error) => {
                      console.error(
                        "[note-meta-chips] failed to remove summary",
                        error,
                      );
                    });
                  }
                : undefined
            }
            onSelectNote={(enhancedNoteId) =>
              onSelectView({ type: "enhanced", id: enhancedNoteId })
            }
            onClick={() => onSelectView(view)}
          />
        );
      })}
      <DateAttendeesChip sessionId={sessionId} />
      <FolderPicker sessionId={sessionId} variant="chip" />
    </div>
  );
}

export function useNoteChipDate(sessionId: string) {
  const session = useSession(sessionId);
  const event = useSessionEvent(sessionId);
  const date =
    parseEventInstant(event?.started_at) ??
    parseEventInstant(session?.created_at);
  if (!date) {
    return "";
  }
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return safeFormat(date, sameYear ? "MMM d" : "MMM d, yyyy");
}

function DateAttendeesChip({ sessionId }: { sessionId: string }) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const dateLabel = useNoteChipDate(sessionId);
  const attendeeCount = useSessionParticipants(sessionId).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={t`Date and attendees`}
          className={noteChipClassName(open, "gap-1.5")}
        >
          <span className="inline-flex items-center gap-1">
            <CalendarBlank aria-hidden />
            <span>{dateLabel || t`Date`}</span>
          </span>
          {attendeeCount > 0 ? " " : null}
          {attendeeCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Users aria-hidden />
              <span className="tabular-nums">{attendeeCount}</span>
              <span className="sr-only">
                {" "}
                {attendeeCount === 1 ? t`attendee` : t`attendees`}
              </span>
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        variant="app"
        align="start"
        className="w-72 overflow-hidden"
      >
        <MetadataPanelContent sessionId={sessionId} />
      </PopoverContent>
    </Popover>
  );
}
