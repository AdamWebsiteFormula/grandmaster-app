// Fork: the in-app account dialog. Sign in with Google or Microsoft (as
// Granola), then, for Pro, Stripe Checkout opens in the browser, as in
// Granola ("Complete checkout in the Stripe tab that opens":
// docs.granola.ai/help-center/managing-your-account/subscriptions-and-billing).
// Upshot AI and Upshot transcription need the free account (Adam, Oct 5).
// A visible Cancel, as HIG sheets have a dismiss button
// (developer.apple.com/design/human-interface-guidelines/sheets).
import { Trans } from "@lingui/react/macro";
import { type ReactNode, useState } from "react";

import { Button } from "@anlg/ui/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@anlg/ui/components/ui/dialog";

import {
  closeUpgradeDialog,
  isAlreadyPro,
  openPrivacyPolicy,
  refreshUpshotPlan,
  startCheckout,
  useUpgradeDialog,
  useUpshotAccount,
  useUpshotPro,
} from "./index";
import {
  stopWaitingForSignIn,
  UpshotSignInChoices,
  useUpshotSignIn,
} from "./sign-in";

import {
  GlassDialogCancelButton,
  GlassDialogContent,
} from "~/shared/ui/glass-dialog";

export function TestCardNote() {
  return (
    <p className="text-muted-foreground text-xs">
      <Trans>
        Test mode: use card 4242 4242 4242 4242, any future date, any CVC. No
        real money is charged.
      </Trans>
    </p>
  );
}

// Fork: a text link to the privacy policy, opened in the browser
// (CalOPPA §22577(b): a text link that includes the word "privacy").
// Its own muted color: 5.27:1 or more on the panel and cards in both
// themes (grandmaster/sops/contrast-audit.md, redline5-oct3).
export function PrivacyPolicyLink({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="text-muted-foreground hover:text-foreground cursor-pointer underline underline-offset-2 transition-colors"
      onClick={() => void openPrivacyPolicy()}
    >
      {children}
    </button>
  );
}

export function UpshotUpgradeDialog() {
  const {
    open,
    interval,
    checkout,
    error,
    alreadyPro: openedAlreadyPro,
    reason,
  } = useUpgradeDialog();
  const signedIn = useUpshotAccount((state) => !!state.session);
  // Fork: while the browser sign-in runs, its own Cancel is the only one
  // (in-app test, Oct 9: two Cancel buttons that did different things;
  // NN/g heuristic #4, consistency).
  const waitingForSignIn = useUpshotSignIn((state) => state.waitingFor !== null);
  const [step, setStep] = useState<"form" | "browser">("form");
  const [alreadyPro, setAlreadyPro] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [syncedOpen, setSyncedOpen] = useState(open);
  if (syncedOpen !== open) {
    setSyncedOpen(open);
    if (open) {
      setStep(openedAlreadyPro ? "browser" : "form");
      setAlreadyPro(openedAlreadyPro);
      setBusy(false);
      setMessage(error);
    }
  }

  // Fork: a plain "Sign in" closes itself once Google or Microsoft hands
  // the session back (NN/g #1: the change is the confirmation).
  const [syncedSignedIn, setSyncedSignedIn] = useState(signedIn);
  if (syncedSignedIn !== signedIn) {
    setSyncedSignedIn(signedIn);
    if (signedIn && open && !checkout) closeUpgradeDialog();
  }

  const close = () => {
    stopWaitingForSignIn();
    closeUpgradeDialog();
  };

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await startCheckout(interval);
      setStep("browser");
    } catch (cause) {
      // Fork: already Pro after signing in (a second Mac) is a success:
      // show "You're on Upshot Pro", not a red error (journey-account-settings
      // P2; NN/g #5, #9).
      if (isAlreadyPro(cause)) {
        await refreshUpshotPlan(true);
        setAlreadyPro(true);
        setStep("browser");
        return;
      }
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Fork: Esc or a click outside can't close the dialog mid checkout
        // call (journey-account-settings P3; NN/g #3).
        if (!next && !busy) close();
      }}
    >
      <GlassDialogContent className="max-w-[360px]">
        {step === "browser" ? (
          <BrowserStep alreadyPro={alreadyPro} />
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (signedIn) void submit();
            }}
          >
            <DialogHeader className="gap-1 text-left">
              <DialogTitle className="text-foreground text-base font-semibold">
                {signedIn ? (
                  <Trans>Upgrade to Pro</Trans>
                ) : (
                  <Trans>Sign in to Upshot</Trans>
                )}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                {signedIn ? (
                  <Trans>Checkout opens in your browser.</Trans>
                ) : checkout ? (
                  <Trans>Pro needs an account so your plan follows you.</Trans>
                ) : reason === "hosted" ? (
                  <Trans>
                    Upshot AI and Upshot transcription need a free account.
                    Your notes stay on this computer.
                  </Trans>
                ) : (
                  <Trans>
                    A free account turns on Upshot AI and Upshot
                    transcription. Your notes stay on this computer.
                  </Trans>
                )}
              </DialogDescription>
            </DialogHeader>

            {!signedIn ? <UpshotSignInChoices /> : null}

            {message ? (
              <p role="alert" className="text-destructive text-xs">
                {message}
              </p>
            ) : null}

            {!signedIn ? (
              <p className="text-muted-foreground text-xs">
                {/* Two messages: the test Trans mock drops nested elements. */}
                <Trans>By continuing you agree to the</Trans>{" "}
                <PrivacyPolicyLink>
                  <Trans>privacy policy</Trans>
                </PrivacyPolicyLink>
                .
              </p>
            ) : null}

            <DialogFooter className="flex gap-2 sm:justify-normal sm:space-x-0">
              {waitingForSignIn && !signedIn ? null : (
                <GlassDialogCancelButton disabled={busy} onClick={close}>
                  <Trans>Cancel</Trans>
                </GlassDialogCancelButton>
              )}
              {signedIn ? (
                <Button
                  type="submit"
                  // Fork: the same text size as Cancel beside it, as the other
                  // glass dialogs pair them (NN/g #4 consistency).
                  className="h-8 flex-1 text-xs"
                  disabled={busy}
                >
                  <Trans>Continue to checkout</Trans>
                </Button>
              ) : null}
            </DialogFooter>
          </form>
        )}
      </GlassDialogContent>
    </Dialog>
  );
}

// Fork: once the webhook lands, this step says so (NN/g heuristic 1,
// visibility of system status: nngroup.com/articles/ten-usability-heuristics).
function BrowserStep({ alreadyPro }: { alreadyPro: boolean }) {
  const pro = useUpshotPro() || alreadyPro;
  return (
    <div className="flex flex-col gap-4">
      <DialogHeader className="gap-1 text-left">
        <DialogTitle className="text-foreground text-base font-semibold">
          {pro ? (
            <Trans>You're on Upshot Pro</Trans>
          ) : (
            <Trans>Finish checkout in your browser</Trans>
          )}
        </DialogTitle>
        <DialogDescription className="text-muted-foreground text-sm">
          {pro ? (
            <Trans>Pick a model from the Auto menu in the Ask box.</Trans>
          ) : (
            <Trans>Pro turns on here as soon as payment goes through.</Trans>
          )}
        </DialogDescription>
      </DialogHeader>
      {pro ? null : <TestCardNote />}
      <DialogFooter className="sm:justify-end">
        <GlassDialogCancelButton onClick={() => closeUpgradeDialog()}>
          <Trans>Done</Trans>
        </GlassDialogCancelButton>
      </DialogFooter>
    </div>
  );
}
