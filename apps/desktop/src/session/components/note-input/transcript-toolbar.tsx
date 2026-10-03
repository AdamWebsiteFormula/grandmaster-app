import { useLingui } from "@lingui/react/macro";

import {
  CheckCircle,
  Copy,
  MagnifyingGlass,
  PencilSimple,
} from "@anlg/ui/components/icons";
import { cn } from "@anlg/utils";

import { useCopyTranscript } from "./header-transcript";
import { useSearch } from "./search/context";

import { useHasTranscript } from "~/session/components/shared";
import type { EditorView } from "~/store/zustand/tabs/schema";
import { useListener } from "~/stt/contexts";

const toolbarButtonClassName = cn([
  "text-muted-foreground hover:bg-accent hover:text-foreground inline-flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors",
  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
  "aria-pressed:bg-accent aria-pressed:text-foreground",
]);

const segmentClassName = cn([
  "inline-flex h-7 cursor-pointer items-center rounded-full px-3 text-xs font-medium transition-colors",
  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
]);

// Fork: one h-8 row under the audio player. On the left a Summary /
// Transcript switch, so the way back to the summary is always in view; on
// the right search, edit and copy together (redline-oct3, H2; Granola's
// transcript bar keeps its tools in one slim row, granola-compare-oct3 §2).
export function TranscriptToolbar({
  sessionId,
  editMode,
  onEditModeChange,
  editorTabs = [],
  onSelectView,
}: {
  sessionId: string;
  editMode: boolean;
  onEditModeChange?: (editMode: boolean) => void;
  editorTabs?: EditorView[];
  onSelectView?: (view: EditorView) => void;
}) {
  const { t } = useLingui();
  const search = useSearch();
  const hasTranscript = useHasTranscript(sessionId);
  const sessionMode = useListener((state) => state.getSessionMode(sessionId));
  const { canCopyTranscript, copyTranscript } = useCopyTranscript(sessionId);
  const canEdit =
    sessionMode === "inactive" && hasTranscript && Boolean(onEditModeChange);
  const searchLabel = t`Search transcript`;
  const copyLabel = t`Copy transcript`;
  const editLabel = editMode ? t`Done editing` : t`Edit transcript`;
  const notesView =
    editorTabs.find((view) => view.type === "enhanced") ??
    editorTabs.find((view) => view.type !== "transcript");

  return (
    <div
      role="toolbar"
      aria-label={t`Transcript`}
      data-transcript-toolbar
      className="mx-auto mb-2 flex h-8 w-full max-w-[680px] shrink-0 items-center gap-1"
    >
      {notesView && onSelectView ? (
        <div
          role="group"
          aria-label={t`View`}
          data-transcript-view-switch
          className="bg-muted inline-flex h-8 items-center gap-0.5 rounded-full p-0.5"
        >
          <button
            type="button"
            aria-pressed={false}
            onClick={() => onSelectView(notesView)}
            className={cn([
              segmentClassName,
              "text-muted-foreground hover:text-foreground",
            ])}
          >
            {notesView.type === "enhanced" ? t`Summary` : t`Notes`}
          </button>
          <button
            type="button"
            aria-pressed
            className={cn([segmentClassName, "bg-foreground text-background"])}
          >
            {t`Transcript`}
          </button>
        </div>
      ) : null}
      <div className="flex-1" />
      {search ? (
        <button
          type="button"
          aria-label={searchLabel}
          title={`${searchLabel} (⌘F)`}
          aria-keyshortcuts="Meta+F"
          onClick={() => search.open()}
          className={toolbarButtonClassName}
        >
          <MagnifyingGlass aria-hidden className="size-4" />
        </button>
      ) : null}
      {canEdit ? (
        <button
          type="button"
          aria-label={editLabel}
          aria-pressed={editMode}
          title={editLabel}
          onClick={() => onEditModeChange?.(!editMode)}
          className={toolbarButtonClassName}
        >
          {editMode ? (
            <CheckCircle aria-hidden className="size-4" />
          ) : (
            <PencilSimple aria-hidden className="size-4" />
          )}
        </button>
      ) : null}
      {canCopyTranscript ? (
        <button
          type="button"
          aria-label={copyLabel}
          title={copyLabel}
          onClick={() => {
            void copyTranscript();
          }}
          className={toolbarButtonClassName}
        >
          <Copy aria-hidden className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
