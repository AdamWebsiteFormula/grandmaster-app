// Fork: the first onboarding step is a free Upshot account, as Granola
// signs in at first launch (docs.granola.ai/help-center/getting-started/
// setting-up-granola-for-the-first-time). Google or Microsoft only; no
// skip, because Upshot AI and Upshot transcription need it (Adam, Oct 5).
import { Trans } from "@lingui/react/macro";
import { useEffect, useRef } from "react";

import { Button } from "@anlg/ui/components/ui/button";

import { useUpshotAccount } from "~/upshot-plan/session";
import { UpshotSignInChoices } from "~/upshot-plan/sign-in";
import { PrivacyPolicyLink } from "~/upshot-plan/upgrade-dialog";

export function LoginSection({ onContinue }: { onContinue: () => void }) {
  const email = useUpshotAccount((state) => state.session?.email ?? null);
  const signedIn = useUpshotAccount((state) => !!state.session);

  // Go on by itself once the browser hands the session back.
  const wasSignedIn = useRef(signedIn);
  useEffect(() => {
    if (signedIn && !wasSignedIn.current) onContinue();
    wasSignedIn.current = signedIn;
  }, [signedIn, onContinue]);

  if (signedIn) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm">
          {email ? (
            <Trans>Signed in as {email}</Trans>
          ) : (
            <Trans>Signed in</Trans>
          )}
        </p>
        <Button size="sm" onClick={onContinue}>
          <Trans>Continue</Trans>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex max-w-xs flex-col gap-3">
      <UpshotSignInChoices />
      <p className="text-muted-foreground text-xs">
        <Trans>By continuing you agree to the</Trans>{" "}
        <PrivacyPolicyLink>
          <Trans>privacy policy</Trans>
        </PrivacyPolicyLink>
        .
      </p>
    </div>
  );
}
