import { Trans } from "@lingui/react/macro";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { platform } from "@tauri-apps/plugin-os";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@anlg/utils";

import { LoginSection } from "./account";
import { CalendarSection } from "./calendar";
import {
  getInitialStep,
  getNextStep,
  getPrevStep,
  getStepProgress,
  getStepStatus,
  type OnboardingStep,
  type OnboardingStepOptions,
} from "./config";
import { FinalDescription, FinalSection, finishOnboarding } from "./final";
import { ImportSection } from "./imports";
import { PermissionsSection } from "./permissions";
import { OnboardingSection } from "./shared";
import { TranscriptionSetupSection } from "./transcription";

import { trackAnalyticsEvent } from "~/analytics";
import { detectImportSources } from "~/imports/detection";
import { StandaloneWindowShell } from "~/shared/window-shell";
import { type Tab, useTabs } from "~/store/zustand/tabs";

export function TabContentOnboarding({
  tab: _tab,
}: {
  tab: Extract<Tab, { type: "onboarding" }>;
}) {
  const openCurrent = useTabs((state) => state.openCurrent);

  // Fork: land on Home, where New note and both seeded notes are (Granola
  // Setup guide: after setup you land on Home; journey-first-run P1).
  const handleFinish = useCallback(
    (_sessionId: string) => {
      openCurrent({ type: "empty" });
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
  const [currentStep, setCurrentStep] = useState(getInitialStep);
  const [didSkipImports, setDidSkipImports] = useState(false);
  const [didSkipCalendar, setDidSkipCalendar] = useState(false);
  const [didTranscriptionFail, setDidTranscriptionFail] = useState(false);
  const [isTranscriptionDownloading, setIsTranscriptionDownloading] =
    useState(false);
  const [didSetUpPermissionsLater, setDidSetUpPermissionsLater] =
    useState(false);
  const permissionsContinuedRef = useRef(false);
  const currentPlatform = platform();
  // Fork: detect meeting apps up front so the step count is right from the
  // start (journey-first-run P3). Same query the import step uses.
  const importSources = useQuery({
    queryKey: ["meeting-import-sources"],
    queryFn: detectImportSources,
  });
  const hideImports =
    importSources.data?.length === 0 && currentStep !== "imports";
  const stepOptions: OnboardingStepOptions = { hideImports };

  const goNext = useCallback(() => {
    trackAnalyticsEvent("onboarding_step_completed", {
      step: currentStep,
      platform: currentPlatform,
    });
    const next = getNextStep(currentStep, { hideImports });
    if (next) setCurrentStep(next);
  }, [currentPlatform, currentStep, hideImports]);

  const skipCurrentStep = useCallback(() => {
    trackAnalyticsEvent("onboarding_step_skipped", {
      step: currentStep,
      platform: currentPlatform,
    });
    const next = getNextStep(currentStep, { hideImports });
    if (next) setCurrentStep(next);
  }, [currentPlatform, currentStep, hideImports]);

  const continueImports = useCallback(() => {
    setDidSkipImports(false);
    goNext();
  }, [goNext]);

  const skipImports = useCallback(() => {
    setDidSkipImports(true);
    skipCurrentStep();
  }, [skipCurrentStep]);

  const goBack = useCallback(() => {
    const prev = getPrevStep(currentStep, { hideImports });
    if (prev) setCurrentStep(prev);
  }, [currentStep, hideImports]);

  // Fork: say "skipped" when the engine failed to set up, not "ready"
  // (UX audit Oct 3, A: NN/g #1).
  const continueTranscription = useCallback(
    (failed?: boolean, downloading?: boolean) => {
      setDidTranscriptionFail(failed === true);
      setIsTranscriptionDownloading(downloading === true);
      goNext();
    },
    [goNext],
  );

  // Back is shown on every step but the first.
  const backFor = (step: OnboardingStep) =>
    getPrevStep(step, stepOptions) ? goBack : undefined;

  // Fork: honest step titles. Continuing with no calendar on is a skip,
  // and Set up later is not "granted" (NN/g #1).
  const continueCalendar = useCallback(
    (connected?: boolean) => {
      setDidSkipCalendar(connected === false);
      goNext();
    },
    [goNext],
  );

  const continuePermissions = useCallback(
    (setUpLater?: boolean) => {
      setDidSetUpPermissionsLater(setUpLater === true);
      goNext();
    },
    [goNext],
  );

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
      {/* Fork: no decorative moving bars (owner, Oct 3): they looked like a live
          meter and looped with no way to stop them (WCAG 2.2 SC 2.2.2). */}
      <div
        data-tauri-drag-region={headerDragRegion || undefined}
        className="relative z-30 flex h-12 shrink-0 items-center justify-end pr-3 pl-12"
      >
        {/* Fork: no background music or music toggle. Upshot makes no sounds
            except playback of your own recordings (owner decision, Oct 3;
            Granola's Mac app is silent). The bar stays as the drag region. */}
      </div>

      <div
        data-tauri-drag-region={headerDragRegion || undefined}
        className={cn([
          "relative z-10 flex shrink-0 flex-col items-start gap-2",
          headerClassName,
        ])}
      >
        {/* Fork: big titles use the display face (design-system.md Type). */}
        <h1 className="text-foreground font-display text-2xl leading-tight font-semibold tracking-[-0.01em]">
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
        {/* Fork: one column width for every step, about 80 characters a
            line (Butterick, Practical Typography, "Line length"). */}
        <div className="flex max-w-2xl flex-col gap-4 px-12 pb-16">
          <OnboardingSection
            title={<Trans>Sign in to Upshot</Trans>}
            description={
              <Trans>
                A free account turns on Upshot AI and Upshot transcription.
                Your notes stay on this computer.
              </Trans>
            }
            completedTitle={<Trans>Signed in</Trans>}
            status={getStepStatus("login", currentStep, stepOptions)}
            progress={getStepProgress("login", stepOptions)}
            skippable={false}
            onBack={backFor("login")}
            onNext={goNext}
          >
            <LoginSection onContinue={goNext} />
          </OnboardingSection>

          <OnboardingSection
            title={<Trans>Start with permissions</Trans>}
            completedTitle={
              didSetUpPermissionsLater ? (
                <Trans>Permissions: set up later</Trans>
              ) : (
                <Trans>Permissions granted</Trans>
              )
            }
            description={
              currentPlatform === "macos" ? (
                <Trans>
                  Upshot needs your microphone and your Mac's sound to
                  transcribe meetings. Accessibility is optional: it lets Upshot
                  see which meeting app you're in and when the call ends.
                </Trans>
              ) : (
                <Trans>
                  Upshot needs access to your microphone and system audio to
                  record and transcribe your meetings
                </Trans>
              )
            }
            status={getStepStatus("permissions", currentStep, stepOptions)}
            progress={getStepProgress("permissions", stepOptions)}
            skippable={false}
            onBack={backFor("permissions")}
            onNext={goNext}
          >
            <PermissionsSection
              onContinue={continuePermissions}
              continuedRef={permissionsContinuedRef}
            />
          </OnboardingSection>

          <OnboardingSection
            title={<Trans>Set up transcription</Trans>}
            description={
              // Fork: cloud by default on every computer (owner, Oct 3).
              <Trans>Upshot transcribes your meetings. No API key needed.</Trans>
            }
            completedTitle={
              didTranscriptionFail ? (
                <Trans>Transcription skipped</Trans>
              ) : isTranscriptionDownloading ? (
                <Trans>Transcription downloading</Trans>
              ) : (
                <Trans>Transcription set up</Trans>
              )
            }
            status={getStepStatus("transcription", currentStep, stepOptions)}
            progress={getStepProgress("transcription", stepOptions)}
            skippable={false}
            onBack={backFor("transcription")}
            onNext={goNext}
          >
            <TranscriptionSetupSection onContinue={continueTranscription} />
          </OnboardingSection>


          <OnboardingSection
            title={<Trans>Connect calendar</Trans>}
            description={
              // Fork: every calendar account on the Mac counts, not only
              // Apple's (support.apple.com/guide/calendar/icl4308d6701/mac).
              <Trans>
                Upshot reads the calendars on this Mac to remind you before
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
            status={getStepStatus("calendar", currentStep, stepOptions)}
            progress={getStepProgress("calendar", stepOptions)}
            onBack={backFor("calendar")}
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
            status={getStepStatus("imports", currentStep, stepOptions)}
            progress={getStepProgress("imports", stepOptions)}
            onBack={backFor("imports")}
            onNext={continueImports}
            onSkip={skipImports}
            // Fork: "Skip for now" sits under the list; one Skip (NN/g #8).
            skippable={false}
          >
            <ImportSection onContinue={continueImports} onSkip={skipImports} />
          </OnboardingSection>

          <OnboardingSection
            title={<Trans>Ready to go</Trans>}
            description={<FinalDescription />}
            status={getStepStatus("final", currentStep, stepOptions)}
            progress={getStepProgress("final", stepOptions)}
            skippable={false}
            onBack={backFor("final")}
            onNext={() => void finishOnboarding(handleFinish)}
          >
            <FinalSection
              onContinue={handleFinish}
              showAutoStart={!didSkipCalendar}
            />
          </OnboardingSection>
        </div>
      </div>
    </div>
  );
}
