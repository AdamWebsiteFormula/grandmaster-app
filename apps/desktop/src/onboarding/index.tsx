import { Trans } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { platform } from "@tauri-apps/plugin-os";
import { useCallback, useEffect, useState } from "react";

import { commands as sfxCommands } from "@anlg/plugin-sfx";
import { SpeakerHigh, SpeakerX } from "@anlg/ui/components/icons";
import { DancingSticks } from "@anlg/ui/components/ui/dancing-sticks";
import { useMountEffect } from "@anlg/ui/hooks/use-mount-effect";
import { cn } from "@anlg/utils";

import { LoginSection } from "./account";
import { CalendarSection } from "./calendar";
import {
  getInitialStep,
  getNextStep,
  getPrevStep,
  getStepStatus,
} from "./config";
import { FinalDescription, FinalSection, finishOnboarding } from "./final";
import { ImportSection } from "./imports";
import { PermissionsSection } from "./permissions";
import { OnboardingSection } from "./shared";
import { TranscriptionSetupSection } from "./transcription";

import { trackAnalyticsEvent } from "~/analytics";
import { useAuth } from "~/auth";
import { StandaloneWindowShell } from "~/shared/window-shell";
import { type Tab, useTabs } from "~/store/zustand/tabs";

export function TabContentOnboarding({
  tab: _tab,
}: {
  tab: Extract<Tab, { type: "onboarding" }>;
}) {
  const openCurrent = useTabs((state) => state.openCurrent);

  const handleFinish = useCallback(
    (sessionId: string) => {
      openCurrent({ type: "sessions", id: sessionId });
    },
    [openCurrent],
  );

  return <OnboardingScreen onFinish={handleFinish} />;
}

function OnboardingScreen({
  onFinish,
}: {
  onFinish: (sessionId: string) => void;
}) {
  return (
    <OnboardingScreenContent
      onFinish={onFinish}
      headerClassName="px-12 pt-4 pb-8"
      headerDragRegion
    />
  );
}

export function StandaloneOnboardingScreen({
  onFinish,
}: {
  onFinish: (sessionId: string) => void;
}) {
  return (
    <StandaloneWindowShell>
      <OnboardingScreenContent
        onFinish={onFinish}
        headerClassName="px-12 pt-4 pb-8"
        headerDragRegion
      />
    </StandaloneWindowShell>
  );
}

function OnboardingScreenContent({
  onFinish,
  headerClassName,
  headerDragRegion = false,
}: {
  onFinish: (sessionId: string) => void;
  headerClassName: string;
  headerDragRegion?: boolean;
}) {
  const queryClient = useQueryClient();
  const auth = useAuth();
  // Fork: start muted; the speaker button turns the music on.
  const [isMuted, setIsMuted] = useState(true);
  const [currentStep, setCurrentStep] = useState(getInitialStep);
  const [didSkipLogin, setDidSkipLogin] = useState(false);
  const [didSkipImports, setDidSkipImports] = useState(false);
  const [didSkipCalendar, setDidSkipCalendar] = useState(false);
  const currentPlatform = platform();

  const goNext = useCallback(() => {
    trackAnalyticsEvent("onboarding_step_completed", {
      step: currentStep,
      platform: currentPlatform,
    });
    const next = getNextStep(currentStep);
    if (next) setCurrentStep(next);
  }, [currentPlatform, currentStep]);

  const skipCurrentStep = useCallback(() => {
    trackAnalyticsEvent("onboarding_step_skipped", {
      step: currentStep,
      platform: currentPlatform,
    });
    const next = getNextStep(currentStep);
    if (next) setCurrentStep(next);
  }, [currentPlatform, currentStep]);

  const continueImports = useCallback(() => {
    setDidSkipImports(false);
    goNext();
  }, [goNext]);

  const skipImports = useCallback(() => {
    setDidSkipImports(true);
    skipCurrentStep();
  }, [skipCurrentStep]);

  const goBack = useCallback(() => {
    const prev = getPrevStep(currentStep);
    if (prev) setCurrentStep(prev);
  }, [currentStep]);

  const continueCalendar = useCallback(() => {
    setDidSkipCalendar(false);
    goNext();
  }, [goNext]);

  const skipCalendar = useCallback(() => {
    setDidSkipCalendar(true);
    skipCurrentStep();
  }, [skipCurrentStep]);

  useEffect(() => {
    trackAnalyticsEvent("onboarding_step_viewed", {
      step: currentStep,
      platform: currentPlatform,
    });
  }, [currentPlatform, currentStep]);

  useMountEffect(() => {
    return () => {
      sfxCommands.stop("BGM").catch(console.error);
    };
  });

  useEffect(() => {
    if (isMuted) {
      sfxCommands.stop("BGM").catch(console.error);
      return;
    }
    sfxCommands
      .play("BGM")
      .then(() => sfxCommands.setVolume("BGM", 0.2))
      .catch(console.error);
  }, [isMuted]);

  const handleFinish = useCallback(
    (sessionId: string) => {
      trackAnalyticsEvent("onboarding_step_completed", {
        step: "final",
        platform: currentPlatform,
      });
      void queryClient.invalidateQueries({ queryKey: ["onboarding-needed"] });
      onFinish(sessionId);
    },
    [currentPlatform, onFinish, queryClient],
  );

  return (
    // Fork: plain true-black background; the upstream landscape video is not shown.
    <div className="bg-background relative flex h-full min-h-0 flex-col overflow-hidden">
      {/* Fork: a quiet sign of life, soft recording bars, very dim, bottom right. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-12 bottom-12 opacity-20 motion-reduce:hidden"
      >
        <DancingSticks
          amplitude={0.6}
          color="hsl(var(--primary))"
          height={72}
          width={128}
          stickWidth={8}
          gap={6}
        />
      </div>
      <div
        data-tauri-drag-region={headerDragRegion || undefined}
        className="relative z-30 flex h-12 shrink-0 items-center justify-end pr-3 pl-12"
      >
        <button
          onClick={() => setIsMuted((prev) => !prev)}
          data-tauri-drag-region="false"
          className="hover:bg-accent rounded-full p-1.5 transition-colors"
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <SpeakerX size={16} className="text-muted-foreground" />
          ) : (
            <SpeakerHigh size={16} className="text-muted-foreground" />
          )}
        </button>
      </div>

      <div
        data-tauri-drag-region={headerDragRegion || undefined}
        className={cn([
          "relative z-10 flex shrink-0 flex-col items-start gap-2",
          headerClassName,
        ])}
      >
        <h1 className="text-foreground text-2xl leading-tight font-semibold">
          <Trans>Welcome to Upshot</Trans>
        </h1>
        {/* Fork: the value proposition in one sentence (matches the README hero). */}
        <p className="text-muted-foreground max-w-md text-base">
          <Trans>
            Record any call without a bot, and get clear notes from the newest
            AI models.
          </Trans>
        </p>
      </div>

      <div className="scroll-fade-y relative z-10 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 px-12 pb-16">
          <OnboardingSection
            title={<Trans>Start with permissions</Trans>}
            completedTitle={<Trans>Permissions granted</Trans>}
            description={
              currentPlatform === "macos" ? (
                <Trans>
                  Upshot needs your microphone and your Mac's sound to
                  transcribe meetings, and Accessibility to see which meeting
                  app you're in and when the call ends.
                </Trans>
              ) : (
                <Trans>
                  Upshot needs access to your microphone and system audio to
                  record and transcribe your meetings
                </Trans>
              )
            }
            status={getStepStatus("permissions", currentStep)}
            skippable={false}
            onBack={goBack}
            onNext={goNext}
          >
            <PermissionsSection onContinue={goNext} />
          </OnboardingSection>

          <OnboardingSection
            title={<Trans>Set up transcription</Trans>}
            description={
              <Trans>
                Upshot transcribes on your Mac. No account and no API key.
              </Trans>
            }
            completedTitle={<Trans>Transcription ready</Trans>}
            status={getStepStatus("transcription", currentStep)}
            skippable={false}
            onBack={goBack}
            onNext={goNext}
          >
            <TranscriptionSetupSection onContinue={goNext} />
          </OnboardingSection>

          <OnboardingSection
            title={<Trans>Create account</Trans>}
            description={
              <Trans>
                Sign in to unlock powerful AI models, sync across devices, and
                personalization.
              </Trans>
            }
            completedTitle={
              auth.session ? (
                <Trans>Signed in</Trans>
              ) : didSkipLogin ? (
                <Trans>Skipped</Trans>
              ) : (
                <Trans>Account</Trans>
              )
            }
            status={getStepStatus("login", currentStep)}
            onBack={goBack}
            onNext={goNext}
            onSkip={() => {
              setDidSkipLogin(true);
              trackAnalyticsEvent("onboarding_login_skipped");
              trackAnalyticsEvent("onboarding_step_skipped", {
                step: "login",
                platform: currentPlatform,
              });
              const next = getNextStep("login");
              if (next) setCurrentStep(next);
            }}
          >
            <LoginSection onContinue={goNext} />
          </OnboardingSection>

          <OnboardingSection
            title={<Trans>Connect calendar</Trans>}
            description={
              <Trans>
                Upshot reads Apple Calendar on this Mac to remind you before
                meetings and add titles and attendees to your notes.
              </Trans>
            }
            completedTitle={
              didSkipCalendar ? (
                <Trans>Calendar skipped</Trans>
              ) : (
                <Trans>Calendar connected</Trans>
              )
            }
            status={getStepStatus("calendar", currentStep)}
            onBack={goBack}
            onNext={continueCalendar}
            onSkip={skipCalendar}
          >
            <CalendarSection onContinue={continueCalendar} />
          </OnboardingSection>

          <OnboardingSection
            title={<Trans>Bring your meeting history</Trans>}
            description={
              <Trans>
                Import notes and transcripts from the meeting apps you already
                use.
              </Trans>
            }
            completedTitle={
              didSkipImports ? (
                <Trans>Meeting history skipped</Trans>
              ) : (
                <Trans>Meeting history imported</Trans>
              )
            }
            status={getStepStatus("imports", currentStep)}
            onBack={goBack}
            onNext={continueImports}
            onSkip={skipImports}
          >
            <ImportSection onContinue={continueImports} onSkip={skipImports} />
          </OnboardingSection>

          <OnboardingSection
            title={<Trans>Ready to go</Trans>}
            description={<FinalDescription />}
            status={getStepStatus("final", currentStep)}
            skippable={false}
            onBack={goBack}
            onNext={() => void finishOnboarding(handleFinish)}
          >
            <FinalSection onContinue={handleFinish} />
          </OnboardingSection>
        </div>
      </div>
    </div>
  );
}
