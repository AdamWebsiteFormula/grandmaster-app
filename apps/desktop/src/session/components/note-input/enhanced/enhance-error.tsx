import { Trans } from "@lingui/react/macro";

import { ArrowsClockwise, WarningCircle } from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";

import { getEnhanceErrorKind, showModelNotReadyToast } from "./model-not-ready";

import { useAITask } from "~/ai/contexts";
import { useLanguageModel } from "~/ai/hooks";
import { useEnhancedNote } from "~/session/queries";
import { isNetworkError } from "~/shared/network-error";
import { createTaskId } from "~/store/zustand/ai-task/task-configs";
import { openUpshotSignIn } from "~/upshot-plan";
import { isSignInRequiredError, useUpshotAccount } from "~/upshot-plan/session";

export { isNetworkError } from "~/shared/network-error";

export function EnhanceError({
  sessionId,
  enhancedNoteId,
  error,
  isUnauthenticated,
  inline = false,
}: {
  sessionId: string;
  enhancedNoteId: string;
  error: Error | undefined;
  isUnauthenticated: boolean;
  /** A banner above the summary that is still saved, not a full card. */
  inline?: boolean;
}) {
  const model = useLanguageModel("enhance");
  const generate = useAITask((state) => state.generate);
  const templateId = useEnhancedNote(enhancedNoteId)?.templateId || undefined;
  const signedIn = useUpshotAccount((state) => !!state.session);

  // Fork: Upshot AI needs a free account (Adam, Oct 5). Once signed in,
  // the same card says so and offers Try again (NN/g #1).
  const askedToSignIn = isUnauthenticated || isSignInRequiredError(error);
  const needsSignIn = askedToSignIn && !signedIn;
  const signedInSince = askedToSignIn && signedIn;
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

  const message = needsSignIn ? (
    <Trans>Upshot AI needs a free account. Sign in, then try again.</Trans>
  ) : signedInSince ? (
    <Trans>Try again to write this summary.</Trans>
  ) : errorKind === "too_long" ? (
    // Fork: Retry can't fix a 413, so say what can
    // (journey-meeting P3; NN/g #9).
    <Trans>
      This meeting is too long for one summary. Try a shorter template, or ask
      in chat.
    </Trans>
  ) : errorKind === "out_of_credit" ? (
    <Trans>Upshot AI is paused for now. Try again later.</Trans>
  ) : isNetworkError(error) ? (
    // Fork: plain-language errors with the raw text kept small below (ux-audit-oct3 C, NN/g #9).
    // Both messages and the button say "try again", as the
    // not-ready state does (NN/g heuristic #4; Apple HIG, Alerts).
    <Trans>
      Upshot can't reach the internet. Check your connection, then try again.
    </Trans>
  ) : (
    <Trans>Upshot couldn't write this summary. Try again.</Trans>
  );

  const action =
    errorKind === "too_long" && !askedToSignIn ? null : needsSignIn ? (
      <Button
        onClick={() => openUpshotSignIn("hosted")}
        size="sm"
        variant="default"
        className="shrink-0"
      >
        <Trans>Sign in</Trans>
      </Button>
    ) : (
      <Button
        onClick={handleRetry}
        size="sm"
        className="shrink-0 gap-2"
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
    );

  // Fork: when a new summary fails, the last one stays on screen under a
  // banner, the same as the Generate summary banner, so nothing the user
  // had disappears (task test, Oct 8; NN/g #9; Granola keeps the old notes
  // until a regenerate succeeds).
  if (inline) {
    return (
      <div
        role="alert"
        className="bg-muted/60 flex items-center justify-between gap-4 rounded-xl px-4 py-3"
      >
        <p className="text-muted-foreground text-sm text-pretty">
          {message} <Trans>Your last summary is below.</Trans>
        </p>
        {action}
      </div>
    );
  }

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
          {needsSignIn ? (
            <Trans>Sign in to write this summary</Trans>
          ) : signedInSince ? (
            <Trans>You're signed in</Trans>
          ) : (
            <Trans>Summary generation failed</Trans>
          )}
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {message}
        </p>
        {!askedToSignIn && errorKind === "other" && error?.message ? (
          <p className="text-muted-foreground text-xs break-words">
            {error.message}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
