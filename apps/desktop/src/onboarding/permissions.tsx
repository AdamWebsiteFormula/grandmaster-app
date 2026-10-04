import { useLingui } from "@lingui/react/macro";
import { platform } from "@tauri-apps/plugin-os";
import { relaunch } from "@tauri-apps/plugin-process";
import { useEffect, useRef, useState } from "react";

import { type PermissionStatus } from "@anlg/plugin-permissions";
import {
  ArrowClockwise,
  ArrowRight,
  Check,
  Cursor,
  type Icon,
  Microphone,
  SpeakerHigh,
} from "@anlg/ui/components/icons";
import { toast } from "@anlg/ui/components/ui/toast";
import { useMountEffect } from "@anlg/ui/hooks/use-mount-effect";
import { cn } from "@anlg/utils";

import { OnboardingButton } from "./shared";

import { useLatestRef } from "~/shared/hooks/useLatestRef";
import {
  trackPermissionRequested,
  usePermissionAnalytics,
} from "~/shared/hooks/usePermissionAnalytics";
import {
  closePermissionAssistant,
  usePermission,
  usePermissionGuidance,
} from "~/shared/hooks/usePermissions";

function PermissionBlock({
  enabledLabel,
  enableLabel,
  enabledBody,
  enableBody,
  Icon,
  permissionName,
  status,
  isPending,
  error,
  onAction,
  actionLabel,
  deniedTitle,
  opensSettingsWhenDenied = true,
  isNext = false,
}: {
  enabledLabel: string;
  enableLabel: string;
  enabledBody: string;
  enableBody: string;
  Icon: Icon;
  permissionName: string;
  status: PermissionStatus | undefined;
  isPending: boolean;
  error?: string | null;
  onAction: () => void;
  actionLabel?: string;
  deniedTitle?: string;
  opensSettingsWhenDenied?: boolean;
  isNext?: boolean;
}) {
  const { t } = useLingui();
  const isAuthorized = status === "authorized";
  // Fork: a denied permission says where to fix it, and the visible title is
  // the accessible name (UX audit Oct 3, A: NN/g #9, WCAG 2.5.3).
  const isDeniedInSettings = opensSettingsWhenDenied && status === "denied";
  const title = isAuthorized
    ? enabledLabel
    : isDeniedInSettings
      ? (deniedTitle ??
        t`Turn on ${permissionName.toLowerCase()} in System Settings`)
      : (actionLabel ?? enableLabel);
  const body = isAuthorized ? enabledBody : enableBody;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onAction}
        disabled={isPending || isAuthorized}
        title={body}
        className={cn([
          "group flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all",
          isAuthorized
            ? "border-border bg-card border"
            : "border-border bg-card hover:bg-accent border active:scale-[0.98]",
          (isPending || isAuthorized) && "cursor-default",
          isPending && "opacity-50",
        ])}
      >
        <div
          className={cn([
            "flex size-6 shrink-0 items-center justify-center rounded-md",
            isAuthorized
              ? "text-muted-foreground"
              : isNext
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground",
          ])}
        >
          {isAuthorized ? (
            <Check className="size-3.5" />
          ) : (
            <Icon className="size-3.5" />
          )}
        </div>
        <span
          className={cn([
            "min-w-0 flex-1 truncate text-sm font-medium",
            isAuthorized ? "text-muted-foreground" : "text-foreground",
          ])}
        >
          {title}
        </span>
        {!isAuthorized && (
          <ArrowRight
            className={cn([
              "size-4 shrink-0 transition-transform group-hover:translate-x-0.5",
              isNext ? "text-primary" : "text-muted-foreground",
            ])}
            data-testid="permission-action-arrow"
          />
        )}
      </button>
      {/* Fork: errors show as text, not only in the tooltip (WCAG 3.3.1). */}
      {!isAuthorized && error && (
        <p className="text-destructive px-3 text-xs">{error}</p>
      )}
    </div>
  );
}

function ContinueWhenComplete({
  onContinue,
  hasContinuedRef,
}: {
  onContinue?: () => void;
  hasContinuedRef: { current: boolean };
}) {
  useMountEffect(() => {
    if (hasContinuedRef.current) return;
    hasContinuedRef.current = true;
    onContinue?.();
  });

  return null;
}

// macOS can keep reporting an Accessibility grant made in System Settings as
// missing until the app restarts, so offer a restart once the user is back.
const RESTART_HINT_DELAY_MS = 10_000;

function useAccessibilityReturnCheck(
  accessibility: ReturnType<typeof usePermission> | undefined,
) {
  const [opened, setOpened] = useState(false);
  const [showRestart, setShowRestart] = useState(false);
  const granted =
    !accessibility || accessibility.confirmedStatus === "authorized";
  const recheckRef = useLatestRef(accessibility?.recheck);

  useEffect(() => {
    if (granted) return;
    let leftWindow = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onBlur = () => {
      leftWindow = true;
      clearTimeout(timer);
    };
    const onFocus = () => {
      recheckRef.current?.();
      if (!opened || !leftWindow) return;
      clearTimeout(timer);
      timer = setTimeout(() => setShowRestart(true), RESTART_HINT_DELAY_MS);
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      clearTimeout(timer);
    };
  }, [granted, opened, recheckRef]);

  return {
    markOpened: () => setOpened(true),
    showRestart: showRestart && !granted,
  };
}

function PermissionsSectionContent({
  onContinue,
  continuedRef,
  accessibility,
  accessibilityGuidance,
  runtimeCapabilities = false,
}: {
  onContinue?: (setUpLater?: boolean) => void;
  continuedRef?: { current: boolean };
  accessibility?: ReturnType<typeof usePermission>;
  accessibilityGuidance?: ReturnType<typeof usePermissionGuidance>;
  runtimeCapabilities?: boolean;
}) {
  const { t } = useLingui();
  const mic = usePermission("microphone");
  const systemAudio = usePermission("systemAudio");
  const localContinuedRef = useRef(false);
  const hasContinuedRef = continuedRef ?? localContinuedRef;
  const accessibilityReturn = useAccessibilityReturnCheck(accessibility);
  usePermissionAnalytics("microphone", mic.confirmedStatus, "onboarding");
  usePermissionAnalytics(
    "system_audio",
    systemAudio.confirmedStatus,
    "onboarding",
  );
  usePermissionAnalytics(
    "accessibility",
    accessibility?.confirmedStatus,
    "onboarding",
  );

  // Fork: complete only on the confirmed macOS status, not the optimistic
  // "authorized" shown for a moment after a click.
  // Fork: mic + system audio are enough to record; Accessibility (meeting
  // details) is optional, as in Granola (UX audit Oct 3, A: NN/g #3,
  // docs.granola.ai/help-center/taking-notes/speaker-attribution).
  const isComplete =
    mic.confirmedStatus === "authorized" &&
    systemAudio.confirmedStatus === "authorized";
  const hasMeetingDetails =
    !accessibility || accessibility.confirmedStatus === "authorized";
  // Fork: a failed request also offers Set up later, so an error can't
  // dead-end the step in release builds (NN/g #3, #9).
  const hasDeniedRecordingPermission =
    mic.status === "denied" ||
    systemAudio.status === "denied" ||
    Boolean(mic.error || systemAudio.error);

  // Design: one accent per screen, so only the next pending row is orange.
  const nextPending = [
    ["microphone", mic.status],
    ["system_audio", systemAudio.status],
    ["accessibility", accessibility ? accessibility.status : "authorized"],
  ].find(([, status]) => status !== "authorized")?.[0];

  const handleAction = (
    permission: string,
    perm: ReturnType<typeof usePermission>,
    opensSettingsWhenDenied: boolean,
    assisted = false,
  ) => {
    // Assisted panes are granted by hand in System Settings; their request API
    // only prompts once, so every click after that would be a silent no-op.
    if (assisted || (opensSettingsWhenDenied && perm.status === "denied")) {
      trackPermissionRequested(
        permission,
        perm.status,
        "onboarding",
        "open_settings",
      );
      // Fork: say so when System Settings fails to open (NN/g #9;
      // journey-first-run P3).
      const showOpenError = () =>
        toast.error(
          t`Couldn't open System Settings. Open it from the Apple menu.`,
        );
      try {
        void Promise.resolve(perm.open()).catch(showOpenError);
      } catch {
        showOpenError();
      }
    } else {
      trackPermissionRequested(
        permission,
        perm.status,
        "onboarding",
        "request",
      );
      perm.request();
    }
  };

  return (
    <div>
      {isComplete && hasMeetingDetails && (
        <ContinueWhenComplete
          onContinue={onContinue}
          hasContinuedRef={hasContinuedRef}
        />
      )}

      <div className="flex flex-col gap-2">
        <PermissionBlock
          enabledLabel={t`Upshot can hear your voice`}
          enableLabel={t`Help Upshot listen to you`}
          enabledBody={t`Microphone access turned on`}
          enableBody={mic.error ?? t`Use your microphone to capture your voice`}
          Icon={Microphone}
          permissionName={t`Microphone`}
          status={mic.status}
          isPending={mic.isPending}
          error={mic.error}
          onAction={() => handleAction("microphone", mic, !runtimeCapabilities)}
          actionLabel={
            runtimeCapabilities && mic.status === "denied"
              ? `${t`Try again`}: ${t`Microphone`}`
              : undefined
          }
          opensSettingsWhenDenied={!runtimeCapabilities}
          isNext={nextPending === "microphone"}
        />

        <PermissionBlock
          enabledLabel={t`Upshot can hear others`}
          enableLabel={t`Help Upshot listen to others`}
          enabledBody={t`System audio enabled`}
          enableBody={
            systemAudio.error ?? t`Use system audio to capture other speakers`
          }
          Icon={SpeakerHigh}
          permissionName={t`System audio`}
          // Fork: the macOS pane's real name, so people find it (Granola
          // Setup guide; journey-first-run P3).
          deniedTitle={t`Turn on Upshot in Screen & System Audio Recording`}
          status={systemAudio.status}
          isPending={systemAudio.isPending}
          error={systemAudio.error}
          onAction={() =>
            handleAction("system_audio", systemAudio, !runtimeCapabilities)
          }
          actionLabel={
            runtimeCapabilities && systemAudio.status === "denied"
              ? `${t`Try again`}: ${t`System audio`}`
              : undefined
          }
          opensSettingsWhenDenied={!runtimeCapabilities}
          isNext={nextPending === "system_audio"}
        />

        {accessibility && (
          <PermissionBlock
            enabledLabel={t`Upshot can read meeting details`}
            enableLabel={t`Help Upshot read meeting details`}
            enabledBody={t`Meeting details access turned on`}
            enableBody={
              accessibilityGuidance
                ? t`Opens System Settings and guides you to add Upshot to the ${accessibilityGuidance.paneTitle ?? "Privacy"} list`
                : t`See which meeting app you're in and when the call ends`
            }
            Icon={Cursor}
            permissionName={t`Accessibility`}
            status={accessibility.status}
            isPending={accessibility.isPending}
            error={accessibility.error}
            onAction={() => {
              accessibilityReturn.markOpened();
              handleAction(
                "accessibility",
                accessibility,
                false,
                Boolean(accessibilityGuidance),
              );
            }}
            opensSettingsWhenDenied={false}
            isNext={nextPending === "accessibility"}
          />
        )}

        {accessibilityReturn.showRestart && (
          <button
            type="button"
            onClick={() => void relaunch()}
            className="border-border bg-card hover:bg-accent text-foreground flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all active:scale-[0.98]"
          >
            <ArrowClockwise className="size-3.5" />
            {t`Turned it on? Restart Upshot`}
          </button>
        )}
      </div>

      {/* Fork: a reflexive Don't Allow must not lock people out of the app
          (Apple HIG Privacy: respect the choice; NN/g #3; journey-first-run
          P2). Recording asks again until both are on. */}
      {!isComplete && hasDeniedRecordingPermission && (
        <div className="mt-4 flex flex-col items-start gap-1">
          <OnboardingButton
            variant="ghost"
            className="px-0"
            onClick={() => onContinue?.(true)}
          >
            {t`Set up later`}
          </OnboardingButton>
          <p className="text-muted-foreground text-xs">
            {t`Upshot can't record until both are on. You can turn them on later in Settings › General.`}
          </p>
        </div>
      )}

      {isComplete && (
        <div className="mt-4 flex flex-col items-start gap-2">
          {hasMeetingDetails ? (
            <OnboardingButton onClick={() => onContinue?.()}>
              {t`Continue`}
            </OnboardingButton>
          ) : (
            <>
              <OnboardingButton
                variant="secondary"
                onClick={() => onContinue?.()}
              >
                {t`Continue without meeting details`}
              </OnboardingButton>
              <p className="text-muted-foreground text-xs">
                {t`You can turn this on later in Settings.`}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MacOSPermissionsSection({
  onContinue,
  continuedRef,
}: {
  onContinue?: (setUpLater?: boolean) => void;
  continuedRef?: { current: boolean };
}) {
  const accessibility = usePermission("accessibility");
  const accessibilityGuidance = usePermissionGuidance("accessibility");

  // Leaving onboarding while the assistant is up would strand its overlay on
  // top of System Settings with nothing left to dismiss it.
  useMountEffect(() => () => void closePermissionAssistant());

  return (
    <PermissionsSectionContent
      onContinue={onContinue}
      continuedRef={continuedRef}
      accessibility={accessibility}
      accessibilityGuidance={accessibilityGuidance}
    />
  );
}

export function PermissionsSection({
  onContinue,
  continuedRef,
}: {
  onContinue?: (setUpLater?: boolean) => void;
  // Fork: owned by the onboarding screen, so going Back to this step shows a
  // Continue button instead of skipping forward again on its own.
  continuedRef?: { current: boolean };
}) {
  if (platform() === "macos") {
    return (
      <MacOSPermissionsSection
        onContinue={onContinue}
        continuedRef={continuedRef}
      />
    );
  }

  return (
    <PermissionsSectionContent
      onContinue={onContinue}
      continuedRef={continuedRef}
      runtimeCapabilities
    />
  );
}
