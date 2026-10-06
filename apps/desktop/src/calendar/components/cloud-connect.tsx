// Fork: Connect Google Calendar or Outlook calendar from the Upshot account,
// on every platform (grandmaster/sops/calendar-from-sign-in.md). Calendar
// access is asked here, in context, not at sign-in: Google's incremental
// authorization (developers.google.com/identity/protocols/oauth2/web-server
// #incrementalAuth; Adam, Oct 5). Granola connects the calendar of the
// account you sign in with (docs.granola.ai syncing-your-calendars).
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useSync } from "./context";
import { useOAuthCalendarSelection } from "./oauth/calendar-selection";
import { PROVIDERS } from "./shared";

import { providerFetch } from "~/ai/provider-fetch";
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

type CalendarProviders = Record<CloudCalendarProvider, boolean>;
const ALL_OFF: CalendarProviders = { google: false, outlook: false };

/**
 * Fork: which account calendars the Worker has turned on. Google Calendar
 * stays off until Google's sensitive-scope review passes, and Outlook until
 * Microsoft's publisher verification, so no one meets an unverified-app
 * screen (Adam, Oct 6). Off when the fetch fails.
 */
export function useCalendarProviders(signedIn: boolean): CalendarProviders {
  const origin = upshotWorkerOrigin();
  const { data } = useQuery({
    queryKey: ["calendar-providers", origin],
    // Only when signed in: the calendar comes from the account.
    enabled: origin !== null && signedIn,
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async (): Promise<CalendarProviders> => {
      const response = await providerFetch(`${origin}/calendar/providers`);
      if (!response.ok) return ALL_OFF;
      const body = (await response.json().catch(() => null)) as Partial<
        Record<string, unknown>
      > | null;
      return { google: body?.google === true, outlook: body?.outlook === true };
    },
  });
  return data ?? ALL_OFF;
}

/**
 * The signed-in account and its calendar. `available` is false while the
 * Worker keeps that calendar off; the row then says "Coming soon" (Adam,
 * Oct 6), as Mokapen marks integrations "(coming soon)".
 */
export function useCloudCalendarAccount(): {
  account: UpshotOAuthProvider;
  provider: CloudCalendarProvider;
  available: boolean;
} | null {
  const session = useUpshotAccount((state) => state.session);
  const providers = useCalendarProviders(session !== null);
  // The button this Mac signed in with; older sessions fall back to the
  // token's list of sign-in methods.
  const account =
    session && upshotWorkerOrigin()
      ? (session.provider ?? upshotAccountProvider(session.access_token))
      : null;
  if (!account) return null;
  const provider = CALENDAR_PROVIDER[account];
  return { account, provider, available: providers[provider] };
}

/**
 * The signed-in account's calendar: which one, whether it is connected, and
 * the Connect action. `provider` is null when signed out, when the build
 * has no Upshot Worker, or while the Worker keeps that calendar off; callers
 * then show only calendars on this Mac.
 */
export function useCloudCalendar() {
  const cloudAccount = useCloudCalendarAccount();
  const account = cloudAccount?.available ? cloudAccount.account : null;
  const provider = cloudAccount?.provider ?? null;
  const available = cloudAccount?.available ?? false;
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
    available,
    connected: available && rows.length > 0,
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
