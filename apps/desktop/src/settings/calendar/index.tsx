// Fork: Settings › Calendar, inside Settings as in Granola (Display,
// Permissions, Visible calendars with a color dot and a switch per calendar;
// granola-compare-oct3 section 8). It reuses the calendar rows from this Mac
// that the month view already reads; the month view stays one click away.
import { Trans, useLingui } from "@lingui/react/macro";
import { platform } from "@tauri-apps/plugin-os";
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
import {
  CloudCalendarName,
  useCloudCalendar,
} from "~/calendar/components/cloud-connect";
import { SyncProvider } from "~/calendar/components/context";
import { useOAuthCalendarSelection } from "~/calendar/components/oauth/calendar-selection";
import { PROVIDERS } from "~/calendar/components/shared";
import { useTurnOnCalendarsByDefault } from "~/calendar/default-calendars";
import { allowReconnectedCalendarConnections } from "~/services/calendar";
import { WeekStartSelector } from "~/settings/general/week-start";
import { SettingsPageTitle } from "~/settings/page-title";
import { SettingRow, SettingsGroup } from "~/settings/setting-row";
import { usePermission } from "~/shared/hooks/usePermissions";
import { useTabs } from "~/store/zustand/tabs";
import { useUpshotAccount } from "~/upshot-plan/session";

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

  // Fork: signed in, the account's Google or Outlook calendar is the first
  // row, on every platform; calendars on this Mac follow, on a Mac only
  // (grandmaster/sops/calendar-from-sign-in.md; Adam, Oct 5).
  const cloud = useCloudCalendar();
  const cloudProvider = cloud.provider;
  const signedIn = useUpshotAccount((state) => state.session !== null);
  const onMac = platform() === "macos";
  const cloudSelection = useOAuthCalendarSelection(
    PROVIDERS.find((item) => item.id === (cloud.provider ?? "google"))!,
  );
  const cloudGroups = cloud.connected ? cloudSelection.groups : [];
  const visibleGroups = [
    ...cloudGroups.map((group) => ({ ...group, cloud: true })),
    ...(authorized && onMac
      ? groups.map((group) => ({ ...group, cloud: false }))
      : []),
  ];
  const showVisible = cloud.connected || (authorized && onMac);

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
      {(cloudProvider || onMac || !signedIn) && (
        <SettingsGroup title={<Trans>Calendar accounts</Trans>}>
          {cloudProvider ? (
            <SettingRow
              icon={CalendarDots}
              title={<CloudCalendarName provider={cloudProvider} />}
              description={
                cloud.error ? (
                  <span role="alert" className="text-destructive">
                    {cloud.error}
                  </span>
                ) : cloud.connected ? (
                  <Trans>Upshot shows its meetings and names your notes.</Trans>
                ) : (
                  <Trans>
                    Show your meetings and name your notes after them.
                  </Trans>
                )
              }
              controlWidth="content"
            >
              {(labelProps) =>
                cloud.connected ? (
                  <span className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Check className="size-3.5" aria-hidden />
                    <Trans>Connected</Trans>
                  </span>
                ) : !cloud.available ? (
                  // Fork: before Google's and Microsoft's reviews, no
                  // Connect (Adam, Oct 6).
                  <span className="text-muted-foreground text-xs">
                    <Trans>Coming soon</Trans>
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {cloud.waiting && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-sm"
                        onClick={cloud.cancel}
                      >
                        <Trans>Cancel</Trans>
                      </Button>
                    )}
                    {/* Fork: Connect next to each calendar, all alike, as
                      Calendly lists them (Adam, Oct 6). */}
                    <Button
                      aria-describedby={labelProps["aria-describedby"]}
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 text-sm"
                      disabled={cloud.waiting}
                      onClick={cloud.connect}
                    >
                      {cloud.waiting ? (
                        <Trans>Finish in your browser…</Trans>
                      ) : (
                        <Trans>Connect</Trans>
                      )}
                    </Button>
                  </span>
                )
              }
            </SettingRow>
          ) : !onMac && !signedIn ? (
            <SettingRow
              icon={CalendarDots}
              title={<Trans>Google or Outlook calendar</Trans>}
              description={
                <Trans>
                  Sign in with Google or Microsoft to connect your calendar.
                </Trans>
              }
            >
              {() => null}
            </SettingRow>
          ) : null}
          {cloudProvider && cloud.connected && (
            <TurnOnCloudCalendars
              provider={cloudProvider}
              isLoading={cloudSelection.isLoading}
            />
          )}
          {onMac && (
            <MacCalendarRows
              cloudFirst={cloudProvider !== null && cloud.available}
              authorized={authorized}
              denied={denied}
              isPending={calendar.isPending}
              onAllowAccess={allowAccess}
            />
          )}
        </SettingsGroup>
      )}

      <SettingsGroup title={<Trans>Display</Trans>}>
        <WeekStartSelector />
        {/* Fork: the month view is a way to see the calendar, not an account,
            so it sits with Display (NN/g, Gestalt proximity: related items
            are grouped). A calendar glyph, not Kanban (journey-account-settings
            P3; Granola screen 16). */}
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
              className="h-8 px-3 text-sm"
              onClick={() => openNew({ type: "calendar" })}
            >
              {/* Fork: no ↗, which marks leaving the app; the month view
                  opens in Upshot (NN/g #4). */}
              <Trans>Open calendar</Trans>
            </Button>
          )}
        </SettingRow>
      </SettingsGroup>

      {/* Fork: the list waits for access; the Allow access row above already
          says what to do (redline-oct3 Settings). */}
      {showVisible ? (
        <SettingsGroup
          title={<Trans>Visible calendars</Trans>}
          action={
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              disabled={isLoading || cloudSelection.isLoading}
              onClick={
                cloud.connected ? cloudSelection.handleRefresh : handleRefresh
              }
            >
              <Trans>Refresh</Trans>
            </Button>
          }
        >
          {visibleGroups.length === 0 &&
          (isLoading || cloudSelection.isLoading) ? (
            <p role="status" className="text-muted-foreground text-sm">
              <Trans>Loading calendars…</Trans>
            </p>
          ) : visibleGroups.length === 0 ? (
            // Fork: access is on but nothing came back; Add account above and
            // Refresh in the header are the next steps, so only the message
            // shows here (as onboarding does).
            <NoCalendarsYet showAddAccount={false} />
          ) : (
            visibleGroups.flatMap((group) => [
              ...(visibleGroups.length > 1
                ? [
                    <p
                      key={`source-${group.cloud}-${group.sourceName}`}
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
                  onToggle={(enabled) =>
                    group.cloud
                      ? cloudSelection.handleToggle(item, enabled)
                      : handleToggle(item, enabled)
                  }
                />
              )),
            ])
          )}
        </SettingsGroup>
      ) : null}
    </div>
  );
}

// The account's calendars start on once, like the Mac's (default-calendars).
function TurnOnCloudCalendars({
  provider,
  isLoading,
}: {
  provider: "google" | "outlook";
  isLoading: boolean;
}) {
  useTurnOnCalendarsByDefault(isLoading, { provider });
  return null;
}

function MacCalendarRows({
  cloudFirst,
  authorized,
  denied,
  isPending,
  onAllowAccess,
}: {
  cloudFirst: boolean;
  authorized: boolean;
  denied: boolean;
  isPending: boolean;
  onAllowAccess: () => void;
}) {
  return (
    <>
      {/* Fork: one glyph per row (access, add account, month grid, week
            start), and Allow access is the page's one orange button unless
            the account's calendar row comes first (redline-oct3 Settings;
            design-system "The one accent"). */}
      <SettingRow
        icon={Key}
        title={
          cloudFirst ? (
            <Trans>Apple Calendar</Trans>
          ) : (
            <Trans>Calendar access</Trans>
          )
        }
        description={
          authorized ? (
            // Fork: the serial comma (Apple Style Guide; NN/g #4).
            <Trans>
              Upshot reads your Google, Outlook, iCloud, and other calendars on
              this Mac.
            </Trans>
          ) : denied ? (
            <Trans>
              Turn on Upshot in System Settings › Privacy &amp; Security ›
              Calendars.
            </Trans>
          ) : (
            // Fork: say why before asking (Apple HIG, Privacy), and name
            // the accounts it covers (Granola names Google and Outlook),
            // with the serial comma (Apple Style Guide; NN/g #4).
            <Trans>
              Upshot needs calendar access to show meetings from your Google,
              Outlook, and iCloud calendars and name your notes.
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
            // Fork: the Settings row-button size, as Plan's: h-8, text-sm
            // (NN/g #4).
            <Button
              aria-describedby={labelProps["aria-describedby"]}
              variant={cloudFirst ? "outline" : "default"}
              size="sm"
              className="h-8 px-3 text-sm"
              disabled={isPending}
              onClick={onAllowAccess}
            >
              {denied ? (
                <Trans>Open System Settings</Trans>
              ) : cloudFirst ? (
                <Trans>Connect</Trans>
              ) : (
                <Trans>Allow access</Trans>
              )}
            </Button>
          )
        }
      </SettingRow>
      {/* Fork: signed in, Google or Outlook connects from its own row above,
          so the Internet Accounts detour shows only without it (Adam, Oct 6). */}
      {!cloudFirst && (
        <>
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
                className="h-8 px-3 text-sm"
                onClick={() => void openInternetAccounts()}
              >
                <Trans>Add account</Trans>
                <ArrowUpRight className="size-3.5" aria-hidden />
              </Button>
            )}
          </SettingRow>
        </>
      )}
    </>
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
