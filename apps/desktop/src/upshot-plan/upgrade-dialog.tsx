// Fork: the in-app account dialog for Upshot Pro. Sign up or sign in with
// email and password, then Stripe Checkout opens in the browser, as in
// Granola ("Complete checkout in the Stripe tab that opens":
// docs.granola.ai/help-center/managing-your-account/subscriptions-and-billing).
// Free features never ask for an account.
//
// Form: visible labels, not placeholders (NN/g, "Placeholders in form
// fields are harmful"), the password rule shown up front (NN/g, password
// creation), a Show password option (NN/g, "Stop password masking"), and a
// visible Cancel, as HIG sheets have a dismiss button
// (developer.apple.com/design/human-interface-guidelines/sheets).
import { Trans } from "@lingui/react/macro";
import { useId, useState } from "react";

import { Button } from "@anlg/ui/components/ui/button";
import { Checkbox } from "@anlg/ui/components/ui/checkbox";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@anlg/ui/components/ui/dialog";
import { Input } from "@anlg/ui/components/ui/input";

import {
  type AccountMode,
  closeUpgradeDialog,
  signInUpshot,
  startCheckout,
  useUpgradeDialog,
  useUpshotAccount,
  useUpshotPro,
} from "./index";
import { UpshotRequestError } from "./session";

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
  const {
    open,
    mode: openMode,
    interval,
    checkout,
    error,
  } = useUpgradeDialog();
  const signedIn = useUpshotAccount((state) => !!state.session);
  const [mode, setMode] = useState<AccountMode>(openMode);
  const [step, setStep] = useState<"form" | "browser">("form");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [syncedOpen, setSyncedOpen] = useState(open);
  if (syncedOpen !== open) {
    setSyncedOpen(open);
    if (open) {
      // Fork: "Sign in" opens on sign-in, Upgrade on sign-up (ux-audit-oct3 D,
      // NN/g #2, #4).
      setMode(openMode);
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
      // Fork: an existing email switches the form to sign-in (ux-audit-oct3 D).
      if (
        cause instanceof UpshotRequestError &&
        cause.code === "account_exists"
      ) {
        setMode("signin");
      }
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
              <div className="flex gap-2">
                <GlassDialogCancelButton
                  disabled={busy}
                  onClick={() => closeUpgradeDialog()}
                >
                  <Trans>Cancel</Trans>
                </GlassDialogCancelButton>
                <Button type="submit" className="h-8 flex-1" disabled={busy}>
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
              </div>
              {!signedIn ? (
                <button
                  type="button"
                  disabled={busy}
                  // Fork: a 24px target (ux-audit-oct3 D, WCAG 2.5.8).
                  className="text-muted-foreground hover:text-foreground min-h-6 py-1 text-xs transition-colors"
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
  const id = useId();
  const [showPassword, setShowPassword] = useState(false);
  const label = "text-foreground text-sm font-medium";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-email`} className={label}>
          <Trans>Email</Trans>
        </label>
        <Input
          id={`${id}-email`}
          autoFocus
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          value={email}
          disabled={busy}
          onChange={(event) => onEmail(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-password`} className={label}>
          <Trans>Password</Trans>
        </label>
        <Input
          id={`${id}-password`}
          type={showPassword ? "text" : "password"}
          required
          minLength={8}
          maxLength={72}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          aria-describedby={mode === "signup" ? `${id}-hint` : undefined}
          value={password}
          disabled={busy}
          onChange={(event) => onPassword(event.target.value)}
        />
        {mode === "signup" ? (
          <p id={`${id}-hint`} className="text-muted-foreground text-xs">
            <Trans>8 or more characters</Trans>
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${id}-show`}
          checked={showPassword}
          disabled={busy}
          onCheckedChange={(value) => setShowPassword(value === true)}
          // Neutral, never the accent (design-system.md).
          className="border-muted-foreground data-[state=checked]:border-foreground data-[state=checked]:bg-foreground data-[state=checked]:text-background size-4 cursor-pointer rounded shadow-none [&_svg]:size-3"
        />
        <label htmlFor={`${id}-show`} className="text-sm">
          <Trans>Show password</Trans>
        </label>
      </div>
    </div>
  );
}

// Fork: once the webhook lands, this step says so (NN/g heuristic 1,
// visibility of system status: nngroup.com/articles/ten-usability-heuristics).
function BrowserStep() {
  const pro = useUpshotPro();
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
