import { Trans, useLingui } from "@lingui/react/macro";
import { platform } from "@tauri-apps/plugin-os";

import type { PermissionStatus } from "@anlg/plugin-permissions";
import {
  CalendarDots,
  Check,
  Cursor,
  type Icon,
  Microphone,
  SpeakerHigh,
  WarningCircle,
} from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";
import { useMountEffect } from "@anlg/ui/hooks/use-mount-effect";
import { cn } from "@anlg/utils";

import { SettingIconTile, SettingsCard } from "~/settings/setting-row";
import {
  trackPermissionRequested,
  usePermissionAnalytics,
} from "~/shared/hooks/usePermissionAnalytics";
import {
  closePermissionAssistant,
  usePermission,
  usePermissionGuidance,
} from "~/shared/hooks/usePermissions";

function PermissionRow({
  icon,
  title,
  description,
  status,
  isPending,
  error,
  permission,
  onRequest,
  onOpen,
  assisted = false,
  runtimeCapability = false,
}: {
  icon: Icon;
  title: string;
  description: string;
  status: PermissionStatus | undefined;
  isPending: boolean;
  error?: string | null;
  permission: string;
  onRequest: () => void;
  onOpen: () => void;
  assisted?: boolean;
  runtimeCapability?: boolean;
}) {
  const { t } = useLingui();
  const isAuthorized = status === "authorized";
  const isDenied = status === "denied";

  const handleButtonClick = () => {
    if (runtimeCapability) {
      if (!isAuthorized) {
        trackPermissionRequested(permission, status, "settings", "request");
        onRequest();
      }
      return;
    }

    if (assisted || isAuthorized || isDenied) {
      trackPermissionRequested(permission, status, "settings", "open_settings");
      onOpen();
    } else {
      trackPermissionRequested(permission, status, "settings", "request");
      onRequest();
    }
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <SettingIconTile icon={icon} />
      <div className="min-w-0 flex-1">
        <div
          className={cn([
            "mb-0.5 flex items-center gap-2",
            !isAuthorized && "text-destructive",
          ])}
        >
          {!isAuthorized && <WarningCircle className="size-4" />}
          <h3 className="text-sm font-medium">{title}</h3>
        </div>
        <p className="text-muted-foreground text-xs">{description}</p>
        {error && (
          <p role="alert" className="text-destructive mt-1 text-xs">
            {error}
          </p>
        )}
      </div>
      {/* Fork: text buttons say what happens, and a granted permission is a
          quiet "Allowed" (ux-audit-oct3 E, HIG buttons). */}
      {isAuthorized ? (
        <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
          <Check className="size-3.5" aria-hidden />
          <Trans>Allowed</Trans>
        </span>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={handleButtonClick}
          disabled={isPending}
          className="shrink-0"
          aria-label={
            runtimeCapability
              ? isDenied
                ? `${t`Try again`}: ${title}`
                : t`Allow ${title}`
              : assisted || isDenied
                ? t`Open System Settings for ${title}`
                : t`Allow ${title}`
          }
        >
          {runtimeCapability ? (
            isDenied ? (
              <Trans>Try again</Trans>
            ) : (
              <Trans>Allow</Trans>
            )
          ) : assisted || isDenied ? (
            <Trans>Open System Settings</Trans>
          ) : (
            <Trans>Allow</Trans>
          )}
        </Button>
      )}
    </div>
  );
}

export function Permissions() {
  if (platform() === "macos") {
    return <MacOSPermissions />;
  }

  return (
    <SettingsCard>
      <AudioPermissions runtimeCapabilities />
    </SettingsCard>
  );
}

function AudioPermissions({
  runtimeCapabilities = false,
}: {
  runtimeCapabilities?: boolean;
}) {
  const { t } = useLingui();
  const mic = usePermission("microphone");
  const systemAudio = usePermission("systemAudio");
  usePermissionAnalytics("microphone", mic.confirmedStatus, "settings");
  usePermissionAnalytics(
    "system_audio",
    systemAudio.confirmedStatus,
    "settings",
  );

  return (
    <>
      <PermissionRow
        permission="microphone"
        icon={Microphone}
        title={t`Microphone`}
        description={t`Record your voice in meetings and calls.`}
        status={mic.status}
        isPending={mic.isPending}
        error={mic.error}
        onRequest={mic.request}
        onOpen={mic.open}
        runtimeCapability={runtimeCapabilities}
      />
      <PermissionRow
        permission="system_audio"
        icon={SpeakerHigh}
        title={t`System audio`}
        description={t`Record other participants in meetings.`}
        status={systemAudio.status}
        isPending={systemAudio.isPending}
        error={systemAudio.error}
        onRequest={systemAudio.request}
        onOpen={systemAudio.open}
        runtimeCapability={runtimeCapabilities}
      />
    </>
  );
}

function MacOSPermissions() {
  const { t } = useLingui();
  const calendar = usePermission("calendar");
  const accessibility = usePermission("accessibility");
  const accessibilityGuidance = usePermissionGuidance("accessibility");
  usePermissionAnalytics("calendar", calendar.confirmedStatus, "settings");
  usePermissionAnalytics(
    "accessibility",
    accessibility.confirmedStatus,
    "settings",
  );

  // Leaving settings while the assistant is up would strand its overlay on top
  // of System Settings with nothing left to dismiss it.
  useMountEffect(() => () => void closePermissionAssistant());

  return (
    // Fork: one list, no eyebrow group labels, in the order a meeting needs
    // them (ux-audit-oct3 E, design-system).
    <SettingsCard>
      <AudioPermissions />

      <PermissionRow
        permission="accessibility"
        icon={Cursor}
        title={t`Accessibility`}
        description={
          accessibilityGuidance
            ? t`Opens System Settings and guides you to add Upshot to the ${accessibilityGuidance.paneTitle ?? "Privacy"} list.`
            : t`Read meeting controls and visible chat.`
        }
        status={accessibility.status}
        isPending={accessibility.isPending}
        onRequest={accessibility.request}
        onOpen={accessibility.open}
        assisted={Boolean(accessibilityGuidance)}
      />

      <PermissionRow
        permission="calendar"
        icon={CalendarDots}
        title={t`Calendar`}
        description={t`Show your Google, Outlook and iCloud events in Upshot.`}
        status={calendar.status}
        isPending={calendar.isPending}
        onRequest={calendar.request}
        onOpen={calendar.open}
      />
    </SettingsCard>
  );
}
