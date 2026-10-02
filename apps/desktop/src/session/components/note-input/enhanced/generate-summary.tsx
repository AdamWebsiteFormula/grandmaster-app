import { Trans } from "@lingui/react/macro";

import { Sparkle } from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";

import { useAITask } from "~/ai/contexts";
import { useLanguageModel } from "~/ai/hooks";
import { useEnhancedNote } from "~/session/queries";
import { createTaskId } from "~/store/zustand/ai-task/task-configs";

// Fork (Granola standard: an empty notes view always offers to generate).
// Shown above the empty editor when the summary is idle and empty, for example
// after an interrupted or skipped automatic summary. Same call as Retry.
export function GenerateSummary({
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
    if (!model) return;
    void generate(createTaskId(enhancedNoteId, "enhance"), {
      model,
      taskType: "enhance",
      args: { sessionId, enhancedNoteId, templateId },
    });
  };

  return (
    <div className="bg-muted/60 flex items-center justify-between gap-4 rounded-xl px-4 py-3">
      <p className="text-muted-foreground text-sm text-pretty">
        <Trans>No summary yet. Turn this meeting into clear notes.</Trans>
      </p>
      <Button
        onClick={handleGenerate}
        disabled={!model}
        size="sm"
        className="shrink-0 gap-2"
      >
        <Sparkle size={16} />
        <span>
          <Trans>Generate summary</Trans>
        </span>
      </Button>
    </div>
  );
}
