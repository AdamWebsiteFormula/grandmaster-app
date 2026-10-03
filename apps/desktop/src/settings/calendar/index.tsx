// Fork: Settings › Calendar, inside Settings as in Granola (Display,
// Permissions, Visible calendars with a color dot and a switch per calendar;
// granola-compare-oct3 section 8). It reuses the Apple Calendar rows the
// month view already reads; the month view stays one click away.
import { Trans } from "@lingui/react/macro";
import { useEffect, useId, useRef, useState } from "react";

import { ArrowUpRight, Check, Kanban, Key } from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";
import { Switch } from "@anlg/ui/components/ui/switch";

import { useAppleCalendarSelection } from "~/calendar/components/apple/calendar-selection";
import type { CalendarItem } from "~/calendar/components/calendar-selection";
import { SyncProvider } from "~/calendar/components/context";
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

      <SettingsGroup title={<Trans>Apple Calendar</Trans>}>
        {/* Fork: one glyph per row (access, month grid, week start), and
            Allow access is the page's one orange button (redline-oct3
            Settings; design-system "The one accent"). */}
        <SettingRow
          icon={Key}
          title={<Trans>Calendar access</Trans>}
          description={
            authorized ? (
              <Trans>Upshot reads events from Apple Calendar.</Trans>
            ) : denied ? (
              <Trans>
                Turn on Upshot in System Settings › Privacy &amp; Security ›
                Calendars.
              </Trans>
            ) : (
              <Trans>Allow access to see upcoming meetings.</Trans>
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
        <SettingRow
          icon={Kanban}
          title={<Trans>Month view</Trans>}
          description={<Trans>See your events and notes by day.</Trans>}
          controlWidth="content"
        >
          {() => (
            <Button
              variant="outline"
              size="sm"
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
          {!hasCalendars ? (
            <p role="status" className="text-muted-foreground text-sm">
              {isLoading ? (
                <Trans>Loading calendars…</Trans>
              ) : (
                <Trans>No calendars found.</Trans>
              )}
            </p>
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
      <span id={titleId} className="min-w-0 flex-1 truncate text-sm">
        {calendar.title}
      </span>
      <Switch
        aria-labelledby={titleId}
        checked={checked}
        onCheckedChange={(next) => {
          const seq = ++toggleSeq.current;
          setPending(next);
          void Promise.resolve(onToggle(next)).catch(() => {
            if (toggleSeq.current === seq) setPending(null);
          });
        }}
      />
    </div>
  );
}
