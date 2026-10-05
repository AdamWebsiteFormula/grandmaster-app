// Fork: "Continue with Google" and "Continue with Microsoft", the only ways
// to sign in, as in Granola ("Granola only supports Google and Microsoft
// single sign on": docs.granola.ai/help-center/getting-started/setting-up-
// granola-for-the-first-time). The browser does the sign-in (RFC 8252 §4.1,
// no embedded web view); the app waits and says so (NN/g #1).
//
// Button text: "Continue with Google" and "Continue with Microsoft", each
// with its brand's logo, as Fireflies labels them (guide.fireflies.ai,
// "Log in to Fireflies using Google or Microsoft SSO").
import { Trans } from "@lingui/react/macro";
import { create } from "zustand";

import { commands as deeplink2Commands } from "@anlg/plugin-deeplink2";
import { commands as openerCommands } from "@anlg/plugin-opener2";
import { Button } from "@anlg/ui/components/ui/button";

import {
  cancelUpshotOAuth,
  completeUpshotOAuth,
  startUpshotOAuth,
  UpshotRequestError,
  type UpshotOAuthProvider,
} from "./session";

type SignInState = {
  waitingFor: UpshotOAuthProvider | null;
  error: string | null;
};

export const useUpshotSignIn = create<SignInState>(() => ({
  waitingFor: null,
  error: null,
}));

const NOT_FINISHED = "Sign-in didn't finish. Try again.";

export async function beginUpshotSignIn(
  provider: UpshotOAuthProvider,
): Promise<void> {
  useUpshotSignIn.setState({ waitingFor: provider, error: null });
  try {
    await startUpshotOAuth(provider, {
      startCallbackServer: async () => {
        const result = await deeplink2Commands.startCallbackServer(
          "upshot",
          null,
        );
        if (result.status === "error") {
          throw new UpshotRequestError(NOT_FINISHED, 0);
        }
        return result.data;
      },
      openUrl: async (url) => {
        const result = await openerCommands.openUrl(url, null);
        if (result.status === "error") {
          throw new UpshotRequestError("Could not open your browser.", 0);
        }
      },
    });
  } catch (cause) {
    cancelUpshotOAuth();
    useUpshotSignIn.setState({
      waitingFor: null,
      error: cause instanceof Error ? cause.message : NOT_FINISHED,
    });
  }
}

export function stopWaitingForSignIn(): void {
  cancelUpshotOAuth();
  void deeplink2Commands.stopCallbackServer().catch(() => {});
  useUpshotSignIn.setState({ waitingFor: null, error: null });
}

/**
 * The browser came back to /auth/callback. A code finishes the sign-in;
 * no code means the person canceled at Google or Microsoft.
 */
export async function finishUpshotSignIn(code: string | null | undefined) {
  if (!useUpshotSignIn.getState().waitingFor) return;
  if (!code) {
    cancelUpshotOAuth();
    useUpshotSignIn.setState({ waitingFor: null, error: NOT_FINISHED });
    return;
  }
  try {
    if (await completeUpshotOAuth(code)) {
      useUpshotSignIn.setState({ waitingFor: null, error: null });
    }
  } catch (cause) {
    useUpshotSignIn.setState({
      waitingFor: null,
      error: cause instanceof Error ? cause.message : NOT_FINISHED,
    });
  }
}

function GoogleLogo() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 48 48">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function MicrosoftLogo() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 21 21">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

/** Continue with Google / Microsoft, the waiting line and any error. */
export function UpshotSignInChoices() {
  const { waitingFor, error } = useUpshotSignIn();

  if (waitingFor) {
    return (
      <div className="flex flex-col gap-3" role="status">
        <p className="text-foreground text-sm">
          {waitingFor === "google" ? (
            <Trans>Finish signing in with Google in your browser.</Trans>
          ) : (
            <Trans>Finish signing in with Microsoft in your browser.</Trans>
          )}
        </p>
        <Button
          type="button"
          variant="outline"
          className="h-8 text-xs"
          onClick={stopWaitingForSignIn}
        >
          <Trans>Cancel</Trans>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-9 gap-2 text-sm"
        onClick={() => void beginUpshotSignIn("google")}
      >
        <GoogleLogo />
        <Trans>Continue with Google</Trans>
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-9 gap-2 text-sm"
        onClick={() => void beginUpshotSignIn("azure")}
      >
        <MicrosoftLogo />
        <Trans>Continue with Microsoft</Trans>
      </Button>
      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
