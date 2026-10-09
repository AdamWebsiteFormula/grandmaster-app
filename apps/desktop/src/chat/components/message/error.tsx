import { Trans, useLingui } from "@lingui/react/macro";

import { ArrowCounterClockwise } from "@anlg/ui/components/icons";
import { cn } from "@anlg/utils";

import { MessageBubble, MessageContainer } from "./shared";

import { isNetworkError } from "~/shared/network-error";
import { openUpshotSignIn } from "~/upshot-plan";
import { isSignInRequiredError, useUpshotAccount } from "~/upshot-plan/session";

// `useChat().error` is typed as Error but holds whatever the transport threw.
export function getChatErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === "string" ? error : String(error);
}

function toError(error: unknown): Error | undefined {
  if (error instanceof Error) return error;
  return typeof error === "string" ? new Error(error) : undefined;
}

export function isContextLengthError(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return (
    (lowerMessage.includes("n_keep") && lowerMessage.includes("n_ctx")) ||
    (lowerMessage.includes("context") && lowerMessage.includes("exceeds")) ||
    lowerMessage.includes("context length") ||
    lowerMessage.includes("context size")
  );
}

export function ErrorMessage({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const { t } = useLingui();
  const raw = getChatErrorText(error);
  // Fork: no "Learn how to fix this" link (it opened upstream docs on
  // localhost); a context-length error says what to do instead (ux-audit-oct3
  // D, NN/g #10).
  // Fork: network and server failures showed the raw text ("Failed to
  // fetch", JSON). Say it plainly, with the raw text kept small below, as
  // the summary error card does (task test, Oct 8; NN/g #9).
  const isSignInMessage = isSignInRequiredError(raw);
  const isNetwork = !isSignInMessage && isNetworkError(toError(error));
  const message = isContextLengthError(raw)
    ? t`This chat is too long. Start a new chat and try again.`
    : isSignInMessage
      ? raw
      : isNetwork
        ? t`Upshot can't reach the internet. Check your connection, then try again.`
        : t`Upshot couldn't answer. Try again.`;
  const detail =
    !isContextLengthError(raw) && !isSignInMessage && !isNetwork && raw
      ? raw
      : null;
  // Fork: Upshot AI needs a free account (Adam, Oct 5); the way in sits
  // next to the message (NN/g, error-message guidelines).
  const signedIn = useUpshotAccount((state) => !!state.session);
  const needsSignIn = !signedIn && isSignInRequiredError(raw);
  const buttonClass = cn([
    "mt-1 mb-0.5 -ml-1.5 inline-flex min-h-6 items-center gap-1 rounded-md px-1.5 py-1",
    "text-destructive text-xs font-medium",
    "hover:bg-destructive/15",
    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
  ]);

  return (
    <MessageContainer align="start">
      <MessageBubble variant="error">
        <p className="text-sm">{message}</p>
        {detail ? (
          <p className="mt-0.5 text-xs break-words opacity-80">{detail}</p>
        ) : null}
        {needsSignIn ? (
          <button
            type="button"
            onClick={() => openUpshotSignIn("hosted")}
            className={buttonClass}
          >
            <Trans>Sign in</Trans>
          </button>
        ) : onRetry ? (
          // Fork: a visible text button, not a hover-only 20px icon (ux-audit-oct3 D,
          // WCAG 2.4.7, 2.5.8).
          <button type="button" onClick={onRetry} className={buttonClass}>
            <ArrowCounterClockwise className="h-3 w-3" aria-hidden />
            <Trans>Retry</Trans>
          </button>
        ) : null}
      </MessageBubble>
    </MessageContainer>
  );
}
