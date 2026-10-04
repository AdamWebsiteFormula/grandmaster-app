import { Trans } from "@lingui/react/macro";
import { useEffect, useState } from "react";

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
import { SyncProvider, useSync } from "~/calendar/components/context";
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

export function CalendarSection({
  onContinue,
}: {
  onContinue: (connected?: boolean) => void;
}) {
  return (
    <SyncProvider>
      <CalendarSectionContent onContinue={onContinue} />
    </SyncProvider>
  );
}
