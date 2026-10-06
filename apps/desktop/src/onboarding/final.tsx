import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { platform } from "@tauri-apps/plugin-os";
import { useRef, useState } from "react";

import { commands as analyticsCommands } from "@anlg/plugin-analytics";
import { CircleNotch } from "@anlg/ui/components/icons";

import { seedExampleSessionOnce } from "./example-note";
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
import { shortcutLabel } from "~/shared/shortcut-label";
import { MEETING_DISCLOSURE_MESSAGE } from "~/stt/meeting-disclosure";
import { commands } from "~/types/tauri.gen";

// Fork: no community links (none exists, and the repo has Issues off); the
// last step says how to record instead (UX audit Oct 3, A: NN/g #2, WCAG 2.5.8).
// It names this step's real button, Open Upshot, and the New note button on
// Home, with ⌘N or Ctrl+N (Microsoft Writing Style Guide, Keys and keyboard
// shortcuts).
export function FinalDescription() {
  const newNoteShortcut = shortcutLabel(["mod", "N"]);

  return (
    <Trans>
      After you open Upshot, click Record meeting or press {newNoteShortcut} to
      record your first meeting.
    </Trans>
  );
}

// Fork: a first-run recording notice. Granola calls telling participants
// best practice (docs.granola.ai/help-center/consent-security-privacy/getting-consent)
// and offers an automated chat message (.../transparency-solutions/introduction);
// Fathom's setup confirms consent responsibilities and offers a Recording
// Notice switch (help.fathom.video/en/articles/11577345, 6150977).
export function RecordingNotice({
  showAutoStart = true,
}: { showAutoStart?: boolean } = {}) {
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
              (error) =>
                console.error("Failed to save recording notice", error),
            )
          }
        />
      )}
      {/* Fork: auto start needs calendar meetings, which Upshot reads from
          the Mac's Calendar only, so it shows on a Mac only, and not after
          the calendar step was skipped (NN/g heuristic #5, error
          prevention). */}
      {platform() === "macos" && showAutoStart && <AutoStartSwitch />}
    </div>
  );
}

// Fork: auto start is off by default and offered here, next to the notice,
// so recording never starts without the user knowing (Granola, How
// transcription works; Apple HIG Privacy: ask in context). Same key as
// Settings › Meetings "Start when meeting begins". Journey-first-run P1.
function AutoStartSwitch() {
  const autoStart = useConfigValue("auto_start_scheduled_meetings");

  return (
    <SettingSwitchRow
      title={<Trans>Start recording when a scheduled meeting begins</Trans>}
      description={
        <Trans>
          Upshot starts taking notes when a calendar meeting with a call link
          begins. Off: click the reminder instead.
        </Trans>
      }
      checked={autoStart}
      onChange={(checked) =>
        void setSettingValues({ auto_start_scheduled_meetings: checked }).catch(
          (error) => console.error("Failed to save auto start", error),
        )
      }
    />
  );
}

export function FinalSection({
  onContinue,
  showAutoStart = true,
}: {
  onContinue: (sessionId: string) => void;
  // Fork: false after the calendar step was skipped (NN/g #5).
  showAutoStart?: boolean;
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
      <RecordingNotice showAutoStart={showAutoStart} />
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
  // Seed the example first so the welcome note stays on top of the list.
  // Never blocks finishing.
  await seedExampleSessionOnce().catch((error) => {
    console.error("Failed to create example meeting", error);
  });
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
