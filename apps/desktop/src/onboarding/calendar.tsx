import { Trans } from "@lingui/react/macro";
import { platform } from "@tauri-apps/plugin-os";
import { useEffect, useState } from "react";

import { Check } from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";
import { useMountEffect } from "@anlg/ui/hooks/use-mount-effect";

import { OnboardingButton } from "./shared";

import { useAppleCalendarSelection } from "~/calendar/components/apple/calendar-selection";
import { NoCalendarsYet } from "~/calendar/components/apple/permission";
import {
  type CalendarGroup,
  CalendarSelection,
} from "~/calendar/components/calendar-selection";
import {
  CloudCalendarList,
  CloudCalendarName,
  useCloudCalendar,
} from "~/calendar/components/cloud-connect";
import { SyncProvider, useSync } from "~/calendar/components/context";
import { PROVIDERS } from "~/calendar/components/shared";
import { useTurnOnCalendarsByDefault } from "~/calendar/default-calendars";
import { useEnabledCalendars } from "~/calendar/hooks";
import { usePermission } from "~/shared/hooks/usePermissions";

function getCalendarSelectionKey(groups: CalendarGroup[]) {
  return groups.length === 0
    ? "empty"
    : groups
        .map((group) => `${group.sourceName}:${group.calendars.length}`)
        .join("|");
}

function AppleCalendarList() {
  const { scheduleSync } = useSync();
  const { groups, handleRefresh, handleToggle, isLoading } =
    useAppleCalendarSelection();
  const calendarCount = useTurnOnCalendarsByDefault(isLoading, {
    turnOnNewCalendars: true,
  });

  useMountEffect(() => {
    scheduleSync();
  });

  // Fork: calendars added in System Settings show up when the user comes
  // back, with no Refresh click (journey-first-run P2, NN/g #1).
  useEffect(() => {
    const onFocus = () => handleRefresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [handleRefresh]);

  return (
    <div className="flex flex-col gap-2">
      {calendarCount > 0 && (
        <p className="text-muted-foreground text-sm">
          <Trans>Turn off any calendar you don't meet from.</Trans>
        </p>
      )}
      <CalendarSelection
        key={getCalendarSelectionKey(groups)}
        groups={groups}
        onToggle={handleToggle}
        onRefresh={handleRefresh}
        isLoading={isLoading}
        disableHoverTone
        className="border-border bg-card rounded-xl border p-4"
        emptyState={
          // Fork: access is on but Apple Calendar has no accounts yet: say
          // how to add Google or Outlook to the Mac (Apple support
          // icl4308d6701), with Refresh.
          <NoCalendarsYet onRefresh={handleRefresh} isLoading={isLoading} />
        }
      />
    </div>
  );
}

// Fork: one neutral step with each calendar as an equal row, its own name
// and logo and a Connect button, as Notion Calendar ("Add calendar account":
// Google, iCloud, Microsoft Outlook) and Calendly ("Connect" next to each
// calendar type) list them (Adam, Oct 6). Apple Calendar is a peer, not a
// fallback. Until the Worker turns the account's Google Calendar or Outlook
// calendar on (grandmaster/sops/calendar-from-sign-in.md), its row says
// "Coming soon" with no Connect, so no one meets an unverified-app screen
// before Google and Microsoft approve Upshot (Adam, Oct 6).
function CalendarStep({
  onContinue,
}: {
  onContinue: (connected?: boolean) => void;
}) {
  const cloud = useCloudCalendar();
  const calendar = usePermission("calendar");
  const [askedApple, setAskedApple] = useState(false);
  const enabledCalendars = useEnabledCalendars();
  const hasConnectedCalendar = enabledCalendars.length > 0;
  const onMac = platform() === "macos";
  const appleConnected = onMac && calendar.status === "authorized";
  const appleDenied = askedApple && calendar.status === "denied";
  const cloudConfig = cloud.provider
    ? PROVIDERS.find((item) => item.id === cloud.provider)
    : undefined;
  const appleConfig = PROVIDERS.find((item) => item.id === "apple")!;

  return (
    <div className="flex flex-col gap-4">
      <div className="border-border bg-card divide-border flex flex-col divide-y rounded-xl border">
        {cloud.provider && (
          <CalendarAccountRow
            icon={cloudConfig?.icon}
            name={<CloudCalendarName provider={cloud.provider} />}
            connected={cloud.connected}
            comingSoon={!cloud.available}
            waiting={cloud.waiting}
            error={cloud.error}
            onConnect={cloud.connect}
            onCancel={cloud.cancel}
          />
        )}
        {onMac && (
          <CalendarAccountRow
            icon={appleConfig.icon}
            name={<Trans>Apple Calendar</Trans>}
            connected={appleConnected}
            waiting={calendar.isPending}
            error={
              appleDenied ? (
                <Trans>
                  Turn on Upshot in System Settings › Privacy &amp; Security ›
                  Calendars.
                </Trans>
              ) : null
            }
            connectLabel={
              appleDenied ? <Trans>Open System Settings</Trans> : undefined
            }
            onConnect={() => {
              setAskedApple(true);
              if (calendar.status === "denied") {
                void calendar.open();
              } else {
                calendar.request();
              }
            }}
          />
        )}
      </div>

      {cloud.provider && cloud.connected && (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">
            <Trans>Turn off any calendar you don't meet from.</Trans>
          </p>
          <CloudCalendarList
            provider={cloud.provider}
            className="border-border bg-card rounded-xl border p-4"
          />
        </div>
      )}
      {appleConnected && <AppleCalendarList />}

      {/* Fork: Continue shows once any calendar is connected, so the step
          never dead-ends on a list of switches (journey-first-run P1). It
          reports whether any calendar is on, so the step says "Calendar
          skipped" instead of "connected" (NN/g #1). */}
      {(cloud.connected || appleConnected || hasConnectedCalendar) && (
        <OnboardingButton onClick={() => onContinue(hasConnectedCalendar)}>
          <Trans>Continue</Trans>
        </OnboardingButton>
      )}
    </div>
  );
}

function CalendarAccountRow({
  icon,
  name,
  connected,
  comingSoon = false,
  waiting,
  error,
  connectLabel,
  onConnect,
  onCancel,
}: {
  icon: React.ReactNode;
  name: React.ReactNode;
  connected: boolean;
  comingSoon?: boolean;
  waiting: boolean;
  error: React.ReactNode;
  connectLabel?: React.ReactNode;
  onConnect: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center">
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {name}
        </span>
        {connected ? (
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <Check className="size-3.5" aria-hidden />
            <Trans>Connected</Trans>
          </span>
        ) : comingSoon ? (
          <span className="text-muted-foreground text-xs">
            <Trans>Coming soon</Trans>
          </span>
        ) : (
          <span className="flex items-center gap-2">
            {waiting && onCancel && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-sm"
                onClick={onCancel}
              >
                <Trans>Cancel</Trans>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-sm"
              disabled={waiting}
              onClick={onConnect}
            >
              {waiting && onCancel ? (
                <Trans>Finish in your browser…</Trans>
              ) : (
                (connectLabel ?? <Trans>Connect</Trans>)
              )}
            </Button>
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="text-destructive pl-9 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

export function CalendarSection({
  onContinue,
}: {
  onContinue: (connected?: boolean) => void;
}) {
  return (
    <SyncProvider>
      <CalendarStep onContinue={onContinue} />
    </SyncProvider>
  );
}
