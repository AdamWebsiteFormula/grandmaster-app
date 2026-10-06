import { Trans } from "@lingui/react/macro";
import { platform } from "@tauri-apps/plugin-os";
import { useEffect, useState } from "react";

import { Check } from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";
import { useMountEffect } from "@anlg/ui/hooks/use-mount-effect";

import { OnboardingButton } from "./shared";

import { useAppleCalendarSelection } from "~/calendar/components/apple/calendar-selection";
import {
  NoCalendarsYet,
  openInternetAccounts,
  TroubleShootingLink,
} from "~/calendar/components/apple/permission";
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
import { useCalendarRows } from "~/calendar/queries";
import { usePermission } from "~/shared/hooks/usePermissions";

// Fork: calendars from this Mac only, no upstream cloud sign-in. Google,
// Outlook, iCloud and any other account added to macOS all show up here
// (support.apple.com/guide/calendar/icl4308d6701; owner, Oct 3).

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
          // The main button below is Add account, so it isn't repeated here.
          <NoCalendarsYet
            onRefresh={handleRefresh}
            isLoading={isLoading}
            showAddAccount={false}
          />
        }
      />
    </div>
  );
}

function AppleCalendarProvider({
  isAuthorized,
  isPending,
  onRequest,
  onTroubleshoot,
}: {
  isAuthorized: boolean;
  isPending: boolean;
  onRequest: () => void;
  onTroubleshoot: () => void;
}) {
  return (
    <>
      {isAuthorized && (
        <div className="order-1 w-full basis-full">
          <AppleCalendarList />
        </div>
      )}

      {/* Fork: Connect calendar is the step's one orange action, sized to
          its label like every other step's button (design-system.md: one
          accent per screen; NN/g #4). */}
      <div className="order-2 flex">
        <OnboardingButton
          variant={isAuthorized ? "secondary" : "primary"}
          onClick={() => {
            if (isAuthorized) {
              void openInternetAccounts();
              return;
            }

            onTroubleshoot();
            onRequest();
          }}
          disabled={isPending}
          className="flex items-center gap-3 px-6"
        >
          <img
            src="/assets/apple-calendar.png"
            alt=""
            aria-hidden="true"
            className="size-6 rounded-[4px] object-cover"
          />
          {/* Fork: once access is on, the next useful step is adding a Google
              or Outlook account (Apple support icl4308d6701; journey-first-run
              P2). The Privacy pane would show Upshot already on. */}
          {isAuthorized ? (
            <Trans>Add account</Trans>
          ) : (
            <Trans>Connect calendar</Trans>
          )}
        </OnboardingButton>
      </div>
    </>
  );
}

function CalendarSectionContent({
  onContinue,
}: {
  onContinue: (connected?: boolean) => void;
}) {
  const calendar = usePermission("calendar");
  const isAuthorized = calendar.status === "authorized";
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const enabledCalendars = useEnabledCalendars();
  const hasConnectedCalendar = enabledCalendars.length > 0;
  // Fork: when access is on and the list is empty, the empty state already
  // explains Internet Accounts and the main button says Add account, so
  // skip the repeat.
  const appleCalendarCount = useCalendarRows("apple").length;
  const showAccountsHint = !isAuthorized || appleCalendarCount > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-stretch gap-3">
        <AppleCalendarProvider
          isAuthorized={isAuthorized}
          isPending={calendar.isPending}
          onRequest={calendar.request}
          onTroubleshoot={() => setShowTroubleshooting(true)}
        />
      </div>

      {showAccountsHint && (
        <div className="flex flex-col items-start gap-2">
          {/* Fork: say up front that Google, Outlook and iCloud all work, so
              no one reads "Apple only" (owner, Oct 3; Granola names Google
              and Outlook, docs.granola.ai syncing-your-calendars). The
              serial comma follows the Apple Style Guide (NN/g #4). */}
          <p className="text-muted-foreground text-sm">
            <Trans>
              Works with Google, Outlook, and iCloud calendars. Add an account
              in System Settings › Internet Accounts.
            </Trans>
          </p>
          {/* Fork: Apple's way to add Google or Outlook to Calendar
              (support.apple.com/guide/calendar/icl4308d6701). With access on,
              the main button already says Add account. */}
          {!isAuthorized && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3"
              onClick={() => void openInternetAccounts()}
            >
              <Trans>Add account</Trans>
            </Button>
          )}
        </div>
      )}

      {/* Fork: Continue always shows once access is on, so the step never
          dead-ends on a list of switches (journey-first-run P1, NN/g #3).
          It reports whether any calendar is on, so the step says "Calendar
          skipped" instead of "connected" (NN/g #1). */}
      {(isAuthorized || hasConnectedCalendar) && (
        <OnboardingButton onClick={() => onContinue(hasConnectedCalendar)}>
          <Trans>Continue</Trans>
        </OnboardingButton>
      )}

      {showTroubleshooting && !isAuthorized && (
        <TroubleShootingLink
          onRequest={calendar.request}
          onReset={calendar.reset}
          onOpen={calendar.open}
          isPending={calendar.isPending}
          className="text-muted-foreground text-sm"
        />
      )}
    </div>
  );
}

// Fork: signed in, the account's Google or Outlook calendar comes first, on
// every platform; calendars on this Mac are the second choice
// (grandmaster/sops/calendar-from-sign-in.md; Adam, Oct 5).
function CalendarStep({
  onContinue,
}: {
  onContinue: (connected?: boolean) => void;
}) {
  const cloud = useCloudCalendar();
  if (cloud.provider === null) {
    return <CalendarSectionContent onContinue={onContinue} />;
  }
  return (
    <CloudCalendarStep
      cloud={{ ...cloud, provider: cloud.provider }}
      onContinue={onContinue}
    />
  );
}

type CloudCalendar = ReturnType<typeof useCloudCalendar>;

// Fork: one neutral step with each calendar as an equal row, its own name
// and logo and a Connect button, as Notion Calendar ("Add calendar account":
// Google, iCloud, Microsoft Outlook) and Calendly ("Connect" next to each
// calendar type) list them (Adam, Oct 6). Apple Calendar is a peer, not a
// fallback.
function CloudCalendarStep({
  cloud,
  onContinue,
}: {
  cloud: CloudCalendar & { provider: NonNullable<CloudCalendar["provider"]> };
  onContinue: (connected?: boolean) => void;
}) {
  const calendar = usePermission("calendar");
  const [askedApple, setAskedApple] = useState(false);
  const enabledCalendars = useEnabledCalendars();
  const hasConnectedCalendar = enabledCalendars.length > 0;
  const onMac = platform() === "macos";
  const appleConnected = onMac && calendar.status === "authorized";
  const appleDenied = askedApple && calendar.status === "denied";
  const cloudConfig = PROVIDERS.find((item) => item.id === cloud.provider)!;
  const appleConfig = PROVIDERS.find((item) => item.id === "apple")!;

  return (
    <div className="flex flex-col gap-4">
      <div className="border-border bg-card divide-border flex flex-col divide-y rounded-xl border">
        <CalendarAccountRow
          icon={cloudConfig.icon}
          name={<CloudCalendarName provider={cloud.provider} />}
          connected={cloud.connected}
          waiting={cloud.waiting}
          error={cloud.error}
          onConnect={cloud.connect}
          onCancel={cloud.cancel}
        />
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

      {(cloud.connected || appleConnected) && (
        <p className="text-muted-foreground text-sm">
          <Trans>Turn off any calendar you don't meet from.</Trans>
        </p>
      )}
      {cloud.connected && (
        <CloudCalendarList
          provider={cloud.provider}
          className="border-border bg-card rounded-xl border p-4"
        />
      )}
      {appleConnected && <AppleCalendarList />}

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
  waiting,
  error,
  connectLabel,
  onConnect,
  onCancel,
}: {
  icon: React.ReactNode;
  name: React.ReactNode;
  connected: boolean;
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
              {waiting ? (
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
