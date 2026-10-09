import { Trans } from "@lingui/react/macro";

import { Button } from "@anlg/ui/components/ui/button";

import { showModelNotReadyToast } from "./model-not-ready";

import { useAITask } from "~/ai/contexts";
import { useLanguageModel, useLLMConnectionStatus } from "~/ai/hooks";
import { useEnhancedNote } from "~/session/queries";
import { createTaskId } from "~/store/zustand/ai-task/task-configs";
import { openUpshotSignIn } from "~/upshot-plan";
import { useUpshotAccount } from "~/upshot-plan/session";

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
  const llmStatus = useLLMConnectionStatus();
  const signedIn = useUpshotAccount((state) => !!state.session);
  // Fork: signed out, "getting ready" and Try again looped forever; waiting
  // can't fix it. Say what can, with Sign in, as the error card does (task
  // test, Oct 8; NN/g #9).
  const needsSignIn =
    llmStatus.status === "error" &&
    llmStatus.reason === "unauthenticated" &&
    !signedIn;

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
          {needsSignIn ? (
            <Trans>Sign in to write this summary</Trans>
          ) : (
            <Trans>Upshot AI is getting ready</Trans>
          )}
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {needsSignIn ? (
            <Trans>
              Upshot AI needs a free account. Sign in, then try again.
            </Trans>
          ) : (
            <Trans>
              Try again in a minute to turn this transcript into a summary.
            </Trans>
          )}
        </p>
      </div>
      {needsSignIn ? (
        <Button
          onClick={() => openUpshotSignIn("hosted")}
          size="sm"
          variant="default"
        >
          <Trans>Sign in</Trans>
        </Button>
      ) : (
        <Button onClick={handleGenerate} size="sm" variant="secondary">
          <Trans>Try again</Trans>
        </Button>
      )}
    </div>
  );
}
