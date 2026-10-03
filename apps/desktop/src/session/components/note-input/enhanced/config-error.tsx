import { Trans } from "@lingui/react/macro";

import { Button } from "@anlg/ui/components/ui/button";

import { showModelNotReadyToast } from "./model-not-ready";

import { useAITask } from "~/ai/contexts";
import { useLanguageModel } from "~/ai/hooks";
import { useEnhancedNote } from "~/session/queries";
import { createTaskId } from "~/store/zustand/ai-task/task-configs";

// Fork: Granola has no AI settings page or own keys; Upshot AI is always the
// model, so this only shows while it is not reachable
// (docs.granola.ai/help-center/getting-more-from-your-notes/understanding-model-selection-in-granola-chat).
// An empty state is a status, not an alert, and offers Try again
// (ux-audit-oct3 C, NN/g #9).
export function ConfigError({
  sessionId,
  enhancedNoteId,
}: {
  sessionId: string;
  enhancedNoteId: string;
}) {
  const model = useLanguageModel("enhance");
  const generate = useAITask((state) => state.generate);
  const templateId = useEnhancedNote(enhancedNoteId)?.templateId || undefined;

  const handleGenerate = () => {
    if (!model) {
      showModelNotReadyToast();
      return;
    }
    void generate(createTaskId(enhancedNoteId, "enhance"), {
      model,
      taskType: "enhance",
      args: { sessionId, enhancedNoteId, templateId },
    });
  };

  return (
    <div
      role="status"
      className="flex h-full min-h-[400px] flex-col items-center justify-center px-6"
    >
      <div className="mb-6 flex max-w-md flex-col gap-2 text-center">
        <p className="text-base font-medium">
          <Trans>Upshot AI is getting ready</Trans>
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          <Trans>
            Try again in a minute to turn this transcript into a summary.
          </Trans>
        </p>
      </div>
      <Button onClick={handleGenerate} size="sm" variant="secondary">
        <Trans>Try again</Trans>
      </Button>
    </div>
  );
}
