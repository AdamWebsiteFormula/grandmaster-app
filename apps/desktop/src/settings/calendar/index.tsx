// Fork: Settings › Calendar, inside Settings as in Granola (Display,
// Permissions, Visible calendars with a color dot and a switch per calendar;
// granola-compare-oct3 section 8). It reuses the calendar rows from this Mac
// that the month view already reads; the month view stays one click away.
import { Trans, useLingui } from "@lingui/react/macro";
import { useEffect, useId, useRef, useState } from "react";

import {
  ArrowUpRight,
  CalendarDots,
  Check,
  Key,
  UserPlus,
} from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";
import { Switch } from "@anlg/ui/components/ui/switch";
import { toast } from "@anlg/ui/components/ui/toast";

import { useAppleCalendarSelection } from "~/calendar/components/apple/calendar-selection";
import {
  NoCalendarsYet,
  openInternetAccounts,
} from "~/calendar/components/apple/permission";
import type { CalendarItem } from "~/calendar/components/calendar-selection";
import { SyncProvider } from "~/calendar/components/context";
import { useTurnOnCalendarsByDefault } from "~/calendar/default-calendars";
import { allowReconnectedCalendarConnections } from "~/services/calendar";
import { WeekStartSelector } from "~/settings/general/week-start";
import { SettingsPageTitle } from "~/settings/page-title";
import { SettingRow, SettingsGroup } from "~/settings/setting-row";
import { usePermission } from "~/shared/hooks/usePermissions";
import { useTabs } from "~/store/zustand/tabs";

export function SettingsCalendar() {
  return (
    <SyncProvider>
      <SettingsCalendarContent />
    </SyncProvider>
  );
}

function SettingsCalendarContent() {
  const calendar = usePermission("calendar");
  const openNew = useTabs((state) => state.openNew);
  const { groups, handleRefresh, handleToggle, isLoading, scheduleSync } =
    useAppleCalendarSelection();
  const authorized = calendar.status === "authorized";
  const denied = calendar.status === "denied";
  const hasCalendars = groups.some((group) => group.calendars.length > 0);
  // Fork: the first time calendars arrive on this Mac, they start on, as in
  // onboarding (Granola setup "Select all"), so Coming up isn't empty.
  useTurnOnCalendarsByDefault(isLoading);

  // Read the calendar list once access is there and nothing is loaded yet.
  const askedForSync = useRef(false);
  useEffect(() => {
    if (!authorized || hasCalendars || askedForSync.current) return;
    askedForSync.current = true;
    scheduleSync();
  }, [authorized, hasCalendars, scheduleSync]);

  const allowAccess = () => {
    if (calendar.isPending) return;
    allowReconnectedCalendarConnections("apple");
    if (denied) {
      calendar.open();
    } else {
      calendar.request();
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <SettingsPageTitle
        title={<Trans>Calendar</Trans>}
        description={
          <Trans>Choose which calendars Upshot uses for your meetings.</Trans>
        }
      />

      {/* Fork: a neutral title. Upshot reads every calendar account on this
          Mac, not only Apple's: Google, Exchange/Outlook, iCloud, Yahoo and
          CalDAV (owner, Oct 3; support.apple.com/guide/calendar/icl4308d6701). */}
      <SettingsGroup title={<Trans>Calendar accounts</Trans>}>
        {/* Fork: one glyph per row (access, add account, month grid, week
            start), and Allow access is the page's one orange button
            (redline-oct3 Settings; design-system "The one accent"). */}
        <SettingRow
          icon={Key}
          title={<Trans>Calendar access</Trans>}
          description={
            authorized ? (
              <Trans>
                Upshot reads your Google, Outlook, iCloud and other calendars on
                this Mac.
              </Trans>
            ) : denied ? (
              <Trans>
                Turn on Upshot in System Settings › Privacy &amp; Security ›
                Calendars.
              </Trans>
            ) : (
              // Fork: say why before asking (Apple HIG, Privacy), and name
              // the accounts it covers (Granola names Google and Outlook).
              <Trans>
                Upshot needs calendar access to show meetings from your Google,
                Outlook and iCloud calendars and name your notes.
              </Trans>
            )
          }
          controlWidth="content"
        >
          {(labelProps) =>
            authorized ? (
              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                <Check className="size-3.5" aria-hidden />
                <Trans>Allowed</Trans>
              </span>
            ) : (
              <Button
                aria-describedby={labelProps["aria-describedby"]}
                variant="default"
                size="sm"
                className="h-8 px-3"
                disabled={calendar.isPending}
                onClick={allowAccess}
              >
                {denied ? (
                  <Trans>Open System Settings</Trans>
                ) : (
                  <Trans>Allow access</Trans>
                )}
              </Button>
            )
          }
        </SettingRow>
        {/* Fork: adding Google or Outlook is always one click away, not only
            from an empty list (owner, Oct 3). macOS adds calendar accounts in
            Internet Accounts (Apple support icl4308d6701). */}
        <SettingRow
          icon={UserPlus}
          title={<Trans>Add Google or Outlook</Trans>}
          description={
            <Trans>
              Add the account in System Settings › Internet Accounts. Its
              calendars show up here.
            </Trans>
          }
          controlWidth="content"
        >
          {(labelProps) => (
            // Fork: the same size as Allow access (NN/g #4).
            <Button
              aria-describedby={labelProps["aria-describedby"]}
              variant="outline"
              size="sm"
              className="h-8 px-3"
              onClick={() => void openInternetAccounts()}
            >
              <Trans>Add account</Trans>
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Button>
          )}
        </SettingRow>
        {/* Fork: a calendar glyph for the month view, not Kanban
            (journey-account-settings P3; Granola screen 16). */}
        <SettingRow
          icon={CalendarDots}
          title={<Trans>Month view</Trans>}
          description={<Trans>See your events and notes by day.</Trans>}
          controlWidth="content"
        >
          {() => (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3"
              onClick={() => openNew({ type: "calendar" })}
            >
              <Trans>Open calendar</Trans>
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Button>
          )}
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title={<Trans>Display</Trans>}>
        <WeekStartSelector />
      </SettingsGroup>

      {/* Fork: the list waits for access; the Allow access row above already
          says what to do (redline-oct3 Settings). */}
      {authorized ? (
        <SettingsGroup
          title={<Trans>Visible calendars</Trans>}
          action={
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              disabled={isLoading}
              onClick={handleRefresh}
            >
              <Trans>Refresh</Trans>
            </Button>
          }
        >
          {!hasCalendars && isLoading ? (
            <p role="status" className="text-muted-foreground text-sm">
              <Trans>Loading calendars…</Trans>
            </p>
          ) : !hasCalendars ? (
            // Fork: access is on but nothing came back; Add account above and
            // Refresh in the header are the next steps, so only the message
            // shows here (as onboarding does).
            <NoCalendarsYet showAddAccount={false} />
          ) : (
            groups.flatMap((group) => [
              ...(groups.length > 1
                ? [
                    <p
                      key={`source-${group.sourceName}`}
                      className="text-muted-foreground text-xs font-medium"
                    >
                      {group.sourceName}
                    </p>,
                  ]
                : []),
              ...group.calendars.map((item) => (
                <VisibleCalendarRow
                  key={item.id}
                  calendar={item}
                  onToggle={(enabled) => handleToggle(item, enabled)}
                />
              )),
            ])
          )}
        </SettingsGroup>
      ) : null}
    </div>
  );
}

export function VisibleCalendarRow({
  calendar,
  onToggle,
}: {
  calendar: CalendarItem;
  onToggle: (enabled: boolean) => void | Promise<unknown>;
}) {
  const { t } = useLingui();
  const titleId = useId();
  // Optimistic: the write goes through the database queue, and the live
  // query re-emits after it lands. A newer toggle wins over a stale failure.
  const [pending, setPending] = useState<boolean | null>(null);
  const toggleSeq = useRef(0);
  if (pending !== null && pending === calendar.enabled) {
    setPending(null);
  }
  const checked = pending ?? calendar.enabled;

  return (
    <div className="flex items-center gap-3" data-testid="visible-calendar">
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: calendar.color || "#888" }}
      />
      {/* Fork: a long name shows in full on hover; a failed toggle says
          so (journey-account-settings P3; NN/g #9). */}
      <span
        id={titleId}
        title={calendar.title}
        className="min-w-0 flex-1 truncate text-sm"
      >
        {calendar.title}
      </span>
      <Switch
        aria-labelledby={titleId}
        checked={checked}
        onCheckedChange={(next) => {
          const seq = ++toggleSeq.current;
          setPending(next);
          void Promise.resolve(onToggle(next)).catch(() => {
            if (toggleSeq.current !== seq) return;
            setPending(null);
            const title = calendar.title;
            toast.error(t`Couldn't update ${title}. Try again.`);
          });
        }}
      />
    </div>
  );
}
