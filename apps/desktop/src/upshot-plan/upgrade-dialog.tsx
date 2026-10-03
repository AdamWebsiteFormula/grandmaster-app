// Fork: the in-app account dialog for Upshot Pro. Sign up or sign in with
// email and password, then Stripe Checkout opens in the browser, as in
// Granola ("Complete checkout in the Stripe tab that opens":
// docs.granola.ai/help-center/managing-your-account/subscriptions-and-billing).
// Free features never ask for an account.
import { Trans, useLingui } from "@lingui/react/macro";
import { useState } from "react";

import { Button } from "@anlg/ui/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@anlg/ui/components/ui/dialog";
import { Input } from "@anlg/ui/components/ui/input";

import {
  closeUpgradeDialog,
  signInUpshot,
  startCheckout,
  useUpgradeDialog,
  useUpshotAccount,
} from "./index";

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

export function UpshotUpgradeDialog() {
  const { open, interval, checkout, error } = useUpgradeDialog();
  const signedIn = useUpshotAccount((state) => !!state.session);
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [step, setStep] = useState<"form" | "browser">("form");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [syncedOpen, setSyncedOpen] = useState(open);
  if (syncedOpen !== open) {
    setSyncedOpen(open);
    if (open) {
      setStep("form");
      setBusy(false);
      setMessage(error);
      setPassword("");
    }
  }

  const goToCheckout = async () => {
    await startCheckout(interval);
    setStep("browser");
  };

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (!signedIn) {
        await signInUpshot(mode, email.trim(), password);
        setPassword("");
      }
      if (checkout) {
        await goToCheckout();
      } else {
        closeUpgradeDialog();
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? null : closeUpgradeDialog())}
    >
      <GlassDialogContent className="max-w-[360px]">
        {step === "browser" ? (
          <BrowserStep />
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <DialogHeader className="gap-1 text-left">
              <DialogTitle className="text-foreground text-base font-semibold">
                {signedIn ? (
                  <Trans>Upgrade to Pro</Trans>
                ) : mode === "signup" ? (
                  <Trans>Create your Upshot account</Trans>
                ) : (
                  <Trans>Sign in to Upshot</Trans>
                )}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                {signedIn ? (
                  <Trans>Checkout opens in your browser.</Trans>
                ) : (
                  <Trans>
                    Pro needs an account so your plan follows you. Everything
                    else stays free, with no account.
                  </Trans>
                )}
              </DialogDescription>
            </DialogHeader>

            {!signedIn ? (
              <AccountFields
                mode={mode}
                email={email}
                password={password}
                busy={busy}
                onEmail={setEmail}
                onPassword={setPassword}
              />
            ) : null}

            {message ? (
              <p role="alert" className="text-destructive text-xs">
                {message}
              </p>
            ) : null}

            <DialogFooter className="flex flex-col gap-2 sm:flex-col sm:justify-normal sm:space-x-0">
              <Button type="submit" className="h-8 w-full" disabled={busy}>
                {signedIn ? (
                  <Trans>Continue to checkout</Trans>
                ) : mode === "signup" ? (
                  checkout ? (
                    <Trans>Create account and continue</Trans>
                  ) : (
                    <Trans>Create account</Trans>
                  )
                ) : checkout ? (
                  <Trans>Sign in and continue</Trans>
                ) : (
                  <Trans>Sign in</Trans>
                )}
              </Button>
              {!signedIn ? (
                <button
                  type="button"
                  disabled={busy}
                  className="text-muted-foreground hover:text-foreground text-xs transition-colors"
                  onClick={() => {
                    setMode(mode === "signup" ? "signin" : "signup");
                    setMessage(null);
                  }}
                >
                  {mode === "signup" ? (
                    <Trans>Already have an account? Sign in</Trans>
                  ) : (
                    <Trans>New to Upshot? Create an account</Trans>
                  )}
                </button>
              ) : null}
            </DialogFooter>
          </form>
        )}
      </GlassDialogContent>
    </Dialog>
  );
}

function AccountFields({
  mode,
  email,
  password,
  busy,
  onEmail,
  onPassword,
}: {
  mode: "signup" | "signin";
  email: string;
  password: string;
  busy: boolean;
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
}) {
  const { t } = useLingui();
  return (
    <div className="flex flex-col gap-2">
      <Input
        autoFocus
        type="email"
        required
        maxLength={254}
        autoComplete="email"
        aria-label={t`Email`}
        placeholder={t`Email`}
        value={email}
        disabled={busy}
        onChange={(event) => onEmail(event.target.value)}
      />
      <Input
        type="password"
        required
        minLength={8}
        maxLength={72}
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        aria-label={t`Password`}
        placeholder={
          mode === "signup" ? t`Password (8 or more characters)` : t`Password`
        }
        value={password}
        disabled={busy}
        onChange={(event) => onPassword(event.target.value)}
      />
    </div>
  );
}

function BrowserStep() {
  return (
    <div className="flex flex-col gap-4">
      <DialogHeader className="gap-1 text-left">
        <DialogTitle className="text-foreground text-base font-semibold">
          <Trans>Finish checkout in your browser</Trans>
        </DialogTitle>
        <DialogDescription className="text-muted-foreground text-sm">
          <Trans>Pro turns on here as soon as payment goes through.</Trans>
        </DialogDescription>
      </DialogHeader>
      <TestCardNote />
      <DialogFooter className="sm:justify-end">
        <GlassDialogCancelButton onClick={() => closeUpgradeDialog()}>
          <Trans>Done</Trans>
        </GlassDialogCancelButton>
      </DialogFooter>
    </div>
  );
}
