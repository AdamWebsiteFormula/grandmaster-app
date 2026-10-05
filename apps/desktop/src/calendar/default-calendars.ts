import { useEffect, useRef } from "react";

import { useSync } from "~/calendar/components/context";
import {
  type CalendarRow,
  setCalendarEnabled,
  useCalendarRows,
} from "~/calendar/queries";
import {
  setSettingValue,
  useSettingsReady,
  useStoredSettingValue,
} from "~/settings/queries";

// Fork: calendars start on, as Granola's setup says to "Select all" and
// continue (docs.granola.ai/help-center/getting-started/setting-up-granola-for-the-first-time).
// Feeds no one meets from stay off. Journey-first-run P1. Shared by
// onboarding, Settings › Calendar and the month view, wherever access is
// first granted.
const SKIPPED_CALENDAR_NAMES = [
  "subscribed calendars",
  "birthdays",
  "siri suggestions",
];

export function isSkippedCalendar(
  row: Pick<CalendarRow, "name" | "source">,
): boolean {
  return [row.name, row.source].some((value) => {
    const name = (value ?? "").trim().toLowerCase();
    return SKIPPED_CALENDAR_NAMES.includes(name) || name.includes("holidays");
  });
}

// The first time calendars arrive, turn them all on if none is on yet. After
// that, only calendars that are new (an account just added in System
// Settings) are turned on, so a switch the user turned off stays off.
export function getCalendarsToTurnOn(
  rows: Pick<CalendarRow, "id" | "name" | "source" | "enabled">[],
  seen: ReadonlySet<string> | null,
): string[] {
  if (seen === null && rows.some((row) => row.enabled)) return [];
  return rows
    .filter(
      (row) =>
        !row.enabled &&
        !isSkippedCalendar(row) &&
        (seen === null || !seen.has(row.id)),
    )
    .map((row) => row.id);
}

// The defaults apply once per Mac (calendar_defaults_applied): a user who
// later turns every calendar off is not overridden. Onboarding also turns on
// calendars from an account added while the step is open.
export function useTurnOnCalendarsByDefault(
  isLoading: boolean,
  {
    turnOnNewCalendars = false,
    provider = "apple",
  }: {
    turnOnNewCalendars?: boolean;
    provider?: "apple" | "google" | "outlook";
  } = {},
) {
  const { scheduleSync } = useSync();
  const rows = useCalendarRows(provider);
  const settingsReady = useSettingsReady();
  // Fork: calendars from the Upshot account get their own once-only flag,
  // so a Mac that already set up its own calendars still turns them on.
  const appliedKey =
    provider === "apple"
      ? "calendar_defaults_applied"
      : "cloud_calendar_defaults_applied";
  const { value: applied } = useStoredSettingValue(appliedKey);
  const seenRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (isLoading || !settingsReady || rows.length === 0) return;
    const firstPass = seenRef.current === null;
    if (!firstPass && !turnOnNewCalendars) return;

    const ids =
      firstPass && applied === true
        ? []
        : getCalendarsToTurnOn(rows, seenRef.current);
    seenRef.current ??= new Set();
    for (const row of rows) seenRef.current.add(row.id);

    if (firstPass && applied !== true) {
      void setSettingValue(appliedKey, true).catch((error: unknown) => {
        console.error("[calendar] failed to save calendar defaults", error);
      });
    }
    if (ids.length === 0) return;
    // Sync afterward so Coming up on Home picks up the events right away.
    void Promise.all(ids.map((id) => setCalendarEnabled(id, true)))
      .then(() => scheduleSync())
      .catch((error: unknown) => {
        console.error("[calendar] failed to turn on calendars", error);
      });
  }, [
    applied,
    appliedKey,
    isLoading,
    rows,
    scheduleSync,
    settingsReady,
    turnOnNewCalendars,
  ]);

  return rows.length;
}
