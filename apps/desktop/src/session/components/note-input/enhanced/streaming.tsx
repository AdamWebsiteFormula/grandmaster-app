import { Trans } from "@lingui/react/macro";
import { Streamdown } from "streamdown";

import { streamdownIcons } from "@anlg/ui/components/streamdown-icons";
import { Button } from "@anlg/ui/components/ui/button";
import { cn } from "@anlg/utils";

import { streamdownComponents } from "../../streamdown";

import { useAITaskTask, useLLMConnection } from "~/ai/hooks";
import { createTaskId } from "~/store/zustand/ai-task/task-configs";
import { getPersistableGeneratedTitle } from "~/store/zustand/ai-task/task-configs/title-success";
import { isLocalModelProviderId } from "~/store/zustand/ai-task/tasks";

function SummaryTitleSpace({ title }: { title: string }) {
  return (
    <div
      data-testid="summary-title-space"
      data-note-title-anchor
      // Fork: same metrics as the editor title, so the meta chip row sits in
      // the same place while the summary streams (granola-compare-oct3 §1).
      className="pointer-events-none mb-[var(--note-meta-chips-space,1rem)] flex min-h-9 items-start"
    >
      {title ? (
        // Fork: on the type scale, not an arbitrary size (ux-audit-oct3 C, design-system).
        <h1 className="text-foreground font-display text-2xl font-semibold tracking-[-0.01em]">
          {title}
        </h1>
      ) : (
        <span
          aria-hidden="true"
          className="text-muted-foreground font-display animate-pulse text-2xl font-semibold tracking-[-0.01em]"
        >
          <Trans>Generating title…</Trans>
        </span>
      )}
    </div>
  );
}

export function StreamingView({
  sessionId,
  sessionTitle,
  enhancedNoteId,
}: {
  sessionId: string;
  sessionTitle: string;
  enhancedNoteId: string;
}) {
  const taskId = createTaskId(enhancedNoteId, "enhance");
  const { streamedText, isGenerating, currentStep, cancel } = useAITaskTask(
    taskId,
    "enhance",
  );
  const { conn } = useLLMConnection();
  const isLocalModel = !!conn && isLocalModelProviderId(conn.providerId);
  const isReasoning = currentStep?.type === "reasoning";
  const titleTaskId = createTaskId(sessionId, "title");
  const { streamedText: streamedTitle, isGenerating: isGeneratingTitle } =
    useAITaskTask(titleTaskId, "title");
  const title = sessionTitle.trim();
  const generatedTitle = isGeneratingTitle
    ? ""
    : getPersistableGeneratedTitle(streamedTitle);
  const visibleTitle = title || generatedTitle;

  // Fork: a running summary can be stopped (ux-audit-oct3 C, NN/g #3).
  const stopButton = isGenerating ? (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 shrink-0 px-2 text-xs"
      onClick={cancel}
    >
      <Trans>Stop</Trans>
    </Button>
  ) : null;

  if (streamedText.trim().length === 0) {
    return (
      <div className="flex items-start justify-between gap-3 pb-2">
        <div
          role="status"
          aria-live="polite"
          className="text-muted-foreground flex flex-col gap-0.5 text-sm"
        >
          {/* Fork: plain words, no filler tip (ux-audit-oct3 C, NN/g #2, #8). */}
          <p className="animate-pulse leading-5">
            {isReasoning ? (
              <Trans>Thinking it through…</Trans>
            ) : (
              <Trans>Writing your summary…</Trans>
            )}
          </p>
          <p className="flex items-start gap-1.5 pl-4 text-xs leading-5">
            <span
              aria-hidden="true"
              className="border-muted-foreground/60 mt-[5px] h-2 w-2 shrink-0 rounded-bl-[2px] border-b border-l"
            />
            <span>
              {isReasoning ? (
                <Trans>
                  Reasoning models think through the transcript before writing.
                </Trans>
              ) : isLocalModel ? (
                <Trans>
                  On-device models can take a few minutes to warm up before text
                  appears.
                </Trans>
              ) : (
                <Trans>Your summary appears here as it's written.</Trans>
              )}
            </span>
          </p>
        </div>
        {stopButton}
      </div>
    );
  }

  return (
    <div className="pb-2">
      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <SummaryTitleSpace title={visibleTitle} />
          {stopButton}
        </div>
        <Streamdown
          icons={streamdownIcons}
          components={streamdownComponents}
          className={cn([
            "note-typography",
            "enhanced-summary-stream",
            "flex flex-col",
          ])}
          caret="block"
          isAnimating={isGenerating}
        >
          {streamedText}
        </Streamdown>
      </div>
    </div>
  );
}
