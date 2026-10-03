import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { platform } from "@tauri-apps/plugin-os";
import { useRef, useState } from "react";

import { commands as analyticsCommands } from "@anlg/plugin-analytics";
import { commands as openerCommands } from "@anlg/plugin-opener2";
import { commands as sfxCommands } from "@anlg/plugin-sfx";
import { CircleNotch, GithubLogo } from "@anlg/ui/components/icons";

import { OnboardingButton } from "./shared";
import {
  getOrCreateWelcomeSession,
  setPendingWelcomeSession,
} from "./welcome-note";

import { createSession } from "~/session/queries";
import { setSettingValues } from "~/settings/queries";
import { SettingSwitchRow } from "~/settings/setting-row";
import { useConfigValue } from "~/shared/config";
import { flushAutomaticRelaunch } from "~/shared/relaunch";
import { MEETING_DISCLOSURE_MESSAGE } from "~/stt/meeting-disclosure";
import { commands } from "~/types/tauri.gen";

// Fork: upstream's Discord and X channels are not ours; only the repo stays.
const SOCIALS = [
  {
    label: "GitHub",
    icon: GithubLogo,
    url: "https://github.com/AdamWebsiteFormula/grandmaster-app",
  },
] as const;

const SOCIAL_ICON_SIZE = 18;

export function FinalDescription() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span>
        <Trans>Join our community and stay updated:</Trans>
      </span>
      <div className="flex items-center gap-2">
        {SOCIALS.map((social) => {
          const SocialIcon = social.icon;

          return (
            <button
              key={social.label}
              onClick={() => void openerCommands.openUrl(social.url, null)}
              className="text-muted-foreground hover:text-muted-foreground inline-flex size-5 items-center justify-center rounded-md transition-colors duration-150"
              aria-label={social.label}
            >
              <SocialIcon size={SOCIAL_ICON_SIZE} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Fork: a first-run recording notice. Granola calls telling participants
// best practice (docs.granola.ai/help-center/consent-security-privacy/getting-consent)
// and offers an automated chat message (.../transparency-solutions/introduction);
// Fathom's setup confirms consent responsibilities and offers a Recording
// Notice switch (help.fathom.video/en/articles/11577345, 6150977).
export function RecordingNotice() {
  const autoPost = useConfigValue("consent_auto_send_chat");
  // Same platforms as the Settings switch: posting uses Accessibility.
  const canAutoPost = platform() === "macos" || platform() === "linux";

  return (
    <div className="flex max-w-xl flex-col gap-3">
      <p className="text-foreground text-sm">
        <Trans>
          Tell people when you record them. It's best practice, and the law in
          some places.
        </Trans>
      </p>
      {canAutoPost && (
        <SettingSwitchRow
        title={<Trans>Post a short notice in the meeting chat</Trans>}
        description={
          <Trans>
            When Upshot starts, it sends: “{MEETING_DISCLOSURE_MESSAGE}”
          </Trans>
        }
        checked={autoPost}
        onChange={(checked) =>
          void setSettingValues({ consent_auto_send_chat: checked }).catch(
            (error) => console.error("Failed to save recording notice", error),
          )
        }
      />
      )}
    </div>
  );
}

export function FinalSection({
  onContinue,
}: {
  onContinue: (sessionId: string) => void;
}) {
  const { i18n } = useLingui();
  const translate = i18n._.bind(i18n);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const finishPromiseRef = useRef<Promise<void> | null>(null);
  const welcomeSessionRef = useRef<string | null>(null);

  const handleContinue = async () => {
    if (finishPromiseRef.current) return;

    setStatus("loading");
    const finishPromise = finishOnboarding(onContinue, welcomeSessionRef);
    finishPromiseRef.current = finishPromise;
    try {
      await finishPromise;
    } catch (error) {
      console.error("Failed to finish onboarding", error);
      setStatus("error");
    } finally {
      finishPromiseRef.current = null;
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <RecordingNotice />
      <OnboardingButton
        className="mt-4 px-6 py-2 text-sm disabled:cursor-wait disabled:opacity-70"
        disabled={status === "loading"}
        onClick={() => void handleContinue()}
      >
        {status === "loading" ? (
          <span className="flex items-center gap-2">
            <CircleNotch className="size-4 animate-spin" />
            <Trans>Open Upshot</Trans>
          </span>
        ) : (
          <Trans>Open Upshot</Trans>
        )}
      </OnboardingButton>
      {status === "error" && (
        <p className="text-destructive text-sm" role="alert">
          {translate({
            id: "onboarding.finish-error",
            message: "Couldn't open Upshot. Please try again.",
          })}
        </p>
      )}
    </div>
  );
}

export async function finishOnboarding(
  onContinue?: (sessionId: string) => void,
  welcomeSessionRef?: { current: string | null },
) {
  await sfxCommands.stop("BGM").catch(console.error);
  const welcomeSessionId =
    welcomeSessionRef?.current ??
    (await getOrCreateWelcomeSession().catch((error) => {
      console.error("Failed to create welcome note", error);
      return createSession();
    }));
  if (welcomeSessionRef) {
    welcomeSessionRef.current = welcomeSessionId;
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
  const result = await commands.setOnboardingNeeded(false);
  if (result.status === "error") {
    throw new Error(result.error);
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
  void analyticsCommands
    .event({ event: "onboarding_completed" })
    .catch(console.error);
  setPendingWelcomeSession(welcomeSessionId);
  if (await flushAutomaticRelaunch()) {
    return;
  }
  setPendingWelcomeSession(null);
  onContinue?.(welcomeSessionId);
}
