// Fork: Connect Google Calendar or Outlook calendar from the Upshot account,
// on every platform (grandmaster/sops/calendar-from-sign-in.md). Calendar
// access is asked here, in context, not at sign-in: Google's incremental
// authorization (developers.google.com/identity/protocols/oauth2/web-server
// #incrementalAuth; Adam, Oct 5). Granola connects the calendar of the
// account you sign in with (docs.granola.ai syncing-your-calendars).
import { Trans } from "@lingui/react/macro";
import { useEffect, useState } from "react";

import { useSync } from "./context";
import { useOAuthCalendarSelection } from "./oauth/calendar-selection";
import { PROVIDERS } from "./shared";

import { CalendarSelection } from "~/calendar/components/calendar-selection";
import { useTurnOnCalendarsByDefault } from "~/calendar/default-calendars";
import { useCalendarRows } from "~/calendar/queries";
import {
  type UpshotOAuthProvider,
  upshotAccountProvider,
  upshotWorkerOrigin,
  useUpshotAccount,
} from "~/upshot-plan/session";
import {
  beginUpshotSignIn,
  stopWaitingForSignIn,
  useUpshotSignIn,
} from "~/upshot-plan/sign-in";

export type CloudCalendarProvider = "google" | "outlook";

const CALENDAR_PROVIDER: Record<UpshotOAuthProvider, CloudCalendarProvider> = {
  google: "google",
  azure: "outlook",
};

/**
 * The signed-in account's calendar: which one, whether it is connected, and
 * the Connect action. `provider` is null when signed out or when the build
 * has no Upshot Worker; callers then show only calendars on this Mac.
 */
export function useCloudCalendar() {
  const accessToken = useUpshotAccount(
    (state) => state.session?.access_token ?? null,
  );
  const account =
    accessToken && upshotWorkerOrigin()
      ? upshotAccountProvider(accessToken)
      : null;
  const provider = account ? CALENDAR_PROVIDER[account] : null;
  const rows = useCalendarRows(provider ?? "google");
  const waitingFor = useUpshotSignIn((state) => state.waitingFor);
  const error = useUpshotSignIn((state) => state.error);
  const { scheduleSync } = useSync();

  const [attempt, setAttempt] = useState<"idle" | "connecting" | "done">(
    "idle",
  );
  const waiting = account !== null && waitingFor === account;
  // The browser came back: read the new calendar list now, not in a minute.
  useEffect(() => {
    if (attempt !== "connecting" || waiting) return;
    setAttempt("done");
    if (!error) scheduleSync();
  }, [attempt, waiting, error, scheduleSync]);

  return {
    provider,
    connected: provider !== null && rows.length > 0,
    waiting,
    error: attempt === "done" ? error : null,
    connect: () => {
      if (!account) return;
      setAttempt("connecting");
      void beginUpshotSignIn(account, { calendar: true });
    },
    cancel: stopWaitingForSignIn,
  };
}

export function CloudCalendarName({
  provider,
}: {
  provider: CloudCalendarProvider;
}) {
  return provider === "google" ? (
    <Trans>Google Calendar</Trans>
  ) : (
    <Trans>Outlook calendar</Trans>
  );
}

export function ConnectCloudCalendarLabel({
  provider,
  waiting,
}: {
  provider: CloudCalendarProvider;
  waiting: boolean;
}) {
  if (waiting) return <Trans>Finish in your browser…</Trans>;
  return provider === "google" ? (
    <Trans>Connect Google Calendar</Trans>
  ) : (
    <Trans>Connect Outlook calendar</Trans>
  );
}

/** The account's calendars with a switch each; they start on (Granola's
 * setup says to "Select all"; default-calendars.ts). */
export function CloudCalendarList({
  provider,
  className,
}: {
  provider: CloudCalendarProvider;
  className?: string;
}) {
  const config = PROVIDERS.find((item) => item.id === provider)!;
  const { groups, handleRefresh, handleToggle, isLoading } =
    useOAuthCalendarSelection(config);
  useTurnOnCalendarsByDefault(isLoading, {
    provider,
    turnOnNewCalendars: true,
  });

  return (
    <CalendarSelection
      groups={groups}
      onToggle={handleToggle}
      onRefresh={handleRefresh}
      isLoading={isLoading}
      disableHoverTone
      className={className}
    />
  );
}
