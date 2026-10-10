import type { EditorView } from "prosemirror-view";
import { forwardRef } from "react";

import type { NoteEditorRef } from "@anlg/editor/note";

import { ConfigError } from "./config-error";
import { EnhancedEditor } from "./editor";
import { EnhanceError } from "./enhance-error";
import { GenerateSummaryOffer } from "../generate-summary-offer";
import { StreamingView, SummaryTitleSpace } from "./streaming";

import { useAITaskTask } from "~/ai/hooks";
import { useLLMConnectionStatus } from "~/ai/hooks";
import { hasStoredNoteContent } from "~/session/components/shared";
import { shouldShowEmptySummaryConfigError } from "~/session/enhance-config";
import { useEnhancedNote } from "~/session/queries";
import { createTaskId } from "~/store/zustand/ai-task/task-configs";

export const Enhanced = forwardRef<
  NoteEditorRef,
  {
    sessionId: string;
    sessionTitle: string;
    enhancedNoteId: string;
    onNavigateToTitle?: (pixelWidth?: number) => void;
    onViewReady?: (view: EditorView) => void;
    onViewDisposed?: (view: EditorView) => void;
  }
>(
  (
    {
      sessionId,
      sessionTitle,
      enhancedNoteId,
      onNavigateToTitle,
      onViewReady,
      onViewDisposed,
    },
    ref,
  ) => {
    const taskId = createTaskId(enhancedNoteId, "enhance");
    const llmStatus = useLLMConnectionStatus();
    const { status, error, streamedText } = useAITaskTask(taskId, "enhance");
    const enhancedNote = useEnhancedNote(enhancedNoteId);
    const content = enhancedNote?.content;

    const hasContent = hasStoredNoteContent(content);
    const isAwaitingPersistedContent =
      status === "success" && streamedText.trim().length > 0 && !hasContent;
    const showStreaming = status === "generating" || isAwaitingPersistedContent;

    // Fork: the error and sign-in views keep the note's title, and with it
    // the date and folder chips' place under it, as the streaming view does
    // (live task test, Oct 9: the title vanished; Granola keeps it).
    const titleSpace = (
      <SummaryTitleSpace title={sessionTitle.trim()} pending={false} />
    );

    if (status === "error" && !hasContent) {
      return (
        <div className="flex flex-col">
          {titleSpace}
          <EnhanceError
            sessionId={sessionId}
            enhancedNoteId={enhancedNoteId}
            error={error}
            isUnauthenticated={
              llmStatus.status === "error" &&
              llmStatus.reason === "unauthenticated"
            }
          />
        </div>
      );
    }

    if (!enhancedNote) {
      return showStreaming ? (
        <StreamingView
          sessionId={sessionId}
          sessionTitle={sessionTitle}
          enhancedNoteId={enhancedNoteId}
        />
      ) : null;
    }

    const isConfigError = shouldShowEmptySummaryConfigError(llmStatus);

    if (status === "idle" && isConfigError && !hasContent) {
      return (
        <div className="flex flex-col">
          {titleSpace}
          <ConfigError sessionId={sessionId} enhancedNoteId={enhancedNoteId} />
        </div>
      );
    }

    if (showStreaming) {
      return (
        <StreamingView
          sessionId={sessionId}
          sessionTitle={sessionTitle}
          enhancedNoteId={enhancedNoteId}
        />
      );
    }

    const editor = (
      <EnhancedEditor
        ref={ref}
        sessionId={sessionId}
        sessionTitle={sessionTitle}
        enhancedNoteId={enhancedNoteId}
        content={enhancedNote.content}
        onNavigateToTitle={onNavigateToTitle}
        onViewReady={onViewReady}
        onViewDisposed={onViewDisposed}
      />
    );

    if (status === "error") {
      return (
        <div className="flex flex-col gap-3">
          <EnhanceError
            sessionId={sessionId}
            enhancedNoteId={enhancedNoteId}
            error={error}
            isUnauthenticated={
              llmStatus.status === "error" &&
              llmStatus.reason === "unauthenticated"
            }
            inline
          />
          {editor}
        </div>
      );
    }

    // Fork: an empty, idle summary keeps the editor and offers to generate.
    // The offer sits under the title and chips, and is the My notes card
    // with its wording ("your notes" without a recording), not a second
    // copy above the title (live task test, Oct 9; NN/g #4).
    if (status === "idle" && !hasContent) {
      return (
        <div className="flex flex-col">
          {editor}
          <GenerateSummaryOffer sessionId={sessionId} />
        </div>
      );
    }

    return editor;
  },
);
