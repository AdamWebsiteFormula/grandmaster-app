import { Trans } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";

import { ArrowsClockwise, WarningCircle } from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";

import { getEnhanceErrorKind, showModelNotReadyToast } from "./model-not-ready";

import { useAITask } from "~/ai/contexts";
import { useLanguageModel } from "~/ai/hooks";
import { useAuth } from "~/auth";
import { useEnhancedNote } from "~/session/queries";
import { createTaskId } from "~/store/zustand/ai-task/task-configs";

const NETWORK_ERROR_PATTERN =
  /failed to fetch|load failed|network|offline|internet|ENOTFOUND|ECONNREFUSED|ECONNRESET|EAI_AGAIN|could not connect|couldn't connect|unable to connect|dns/i;

export function isNetworkError(error: Error | undefined): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }

  return Boolean(error && NETWORK_ERROR_PATTERN.test(error.message));
}

export function EnhanceError({
  sessionId,
  enhancedNoteId,
  error,
  isUnauthenticated,
}: {
  sessionId: string;
  enhancedNoteId: string;
  error: Error | undefined;
  isUnauthenticated: boolean;
}) {
  const auth = useAuth();
  const model = useLanguageModel("enhance");
  const generate = useAITask((state) => state.generate);
  const templateId = useEnhancedNote(enhancedNoteId)?.templateId || undefined;
  const signInMutation = useMutation({ mutationFn: () => auth.signIn() });

  const errorKind = getEnhanceErrorKind(error);
  const handleRetry = () => {
    if (!model) {
      showModelNotReadyToast();
      return;
    }

    const taskId = createTaskId(enhancedNoteId, "enhance");
    void generate(taskId, {
      model,
      taskType: "enhance",
      args: { sessionId, enhancedNoteId, templateId },
    });
  };

  return (
    <div
      role="alert"
      className="flex h-full min-h-[400px] flex-col items-center justify-center px-6 text-center"
    >
      <WarningCircle
        aria-hidden
        className="text-muted-foreground mb-5 size-9 stroke-[1.5]"
      />
      <div className="mb-6 flex max-w-md flex-col gap-2">
        <p className="text-base font-medium">
          {isUnauthenticated ? (
            <Trans>Sign in to generate this summary</Trans>
          ) : (
            <Trans>Summary generation failed</Trans>
          )}
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {isUnauthenticated ? (
            <Trans>
              Upshot could not generate this summary because you were not signed
              in. Sign in, then try again.
            </Trans>
          ) : errorKind === "too_long" ? (
            // Fork: Retry can't fix a 413, so say what can
            // (journey-meeting P3; NN/g #9).
            <Trans>
              This meeting is too long for one summary. Try a shorter template,
              or ask in chat.
            </Trans>
          ) : errorKind === "out_of_credit" ? (
            <Trans>Upshot AI is paused for now. Try again later.</Trans>
          ) : isNetworkError(error) ? (
            // Fork: plain-language errors with the raw text kept small below (ux-audit-oct3 C, NN/g #9).
            // Both messages and the button say "try again", as the
            // not-ready state does (NN/g heuristic #4; Apple HIG, Alerts).
            <Trans>
              Upshot can't reach the internet. Check your connection, then try
              again.
            </Trans>
          ) : (
            <Trans>Upshot couldn't write this summary. Try again.</Trans>
          )}
        </p>
        {!isUnauthenticated && errorKind === "other" && error?.message ? (
          <p className="text-muted-foreground text-xs break-words">
            {error.message}
          </p>
        ) : null}
      </div>
      {errorKind === "too_long" &&
      !isUnauthenticated ? null : isUnauthenticated ? (
        <Button
          onClick={() => signInMutation.mutate()}
          disabled={signInMutation.isPending}
          size="sm"
          variant="default"
        >
          {signInMutation.isPending ? (
            <Trans>Opening…</Trans>
          ) : (
            <Trans>Sign in</Trans>
          )}
        </Button>
      ) : (
        <Button
          onClick={handleRetry}
          size="sm"
          className="gap-2"
          // Fork: one orange accent per screen (ux-audit-oct3 C, design-system).
          variant="secondary"
        >
          <ArrowsClockwise size={16} />
          {/* Fork: "Try again", as config-error.tsx and Apple HIG Alerts
              (NN/g heuristic #4, one word for one thing). */}
          <span>
            <Trans>Try again</Trans>
          </span>
        </Button>
      )}
    </div>
  );
}
