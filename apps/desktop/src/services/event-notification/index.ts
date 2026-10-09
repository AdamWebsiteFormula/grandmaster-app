import { t } from "@lingui/core/macro";

import {
  type EventDetails,
  commands as notificationCommands,
  type Participant,
} from "@anlg/plugin-notification";
import { eventParticipantSchema } from "@anlg/store";
import { parseEventInstant } from "@anlg/utils";

import { getIgnoredEventSets } from "~/calendar/ignored-events";
import { liveQueryClient } from "~/db";

export const EVENT_NOTIFICATION_TASK_ID = "eventNotification";
export const EVENT_NOTIFICATION_INTERVAL = 30 * 1000;

// Fork: remind one minute before, as Granola does ("one minute before a
// meeting in your calendar", docs.granola.ai/help-center/taking-notes/notifications).
// The 30-second check shows it 30 to 60 seconds before the start. Granola 7.637
// still reminds up to 4 minutes after the start and hides the card after 4
// minutes; a late check (a hidden window can slow timers) does the same here.
const NOTIFY_WINDOW_MS = 60 * 1000;
const LATE_WINDOW_MS = 4 * 60 * 1000;
const REMINDER_VISIBLE_SECS = 4 * 60;
const NOTIFIED_EVENTS_TTL_MS = 10 * 60 * 1000;

export type NotifiedEventsMap = Map<string, number>;

type NotificationEventRow = {
  id: string;
  title: string;
  started_at: string;
  ended_at?: string | null;
  tracking_id_event: string;
  recurrence_series_id: string;
  is_all_day: boolean | number;
  participants_json?: string | null;
  meeting_link?: string | null;
  location?: string | null;
};

// Fork: remember shown reminders across a relaunch (or the Accessibility
// restart), so the same reminder doesn't show twice (NN/g #8;
// journey-first-run P3). Same 10-minute TTL as the in-memory map.
const NOTIFIED_EVENTS_STORAGE_KEY = "upshot.notified-events";

function loadNotifiedEvents(notifiedEvents: NotifiedEventsMap) {
  try {
    const raw = localStorage.getItem(NOTIFIED_EVENTS_STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    for (const [key, timestamp] of Object.entries(parsed)) {
      if (typeof timestamp === "number" && !notifiedEvents.has(key)) {
        notifiedEvents.set(key, timestamp);
      }
    }
  } catch {
    // Storage can be missing or blocked; reminders still work from memory.
  }
}

function saveNotifiedEvents(notifiedEvents: NotifiedEventsMap) {
  try {
    localStorage.setItem(
      NOTIFIED_EVENTS_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(notifiedEvents)),
    );
  } catch {
    // See loadNotifiedEvents.
  }
}

// Fork: remind only for real meetings: someone else is invited, or there is a
// call link. Granola's reminders "only appear for events with 2 or more
// attendees" (docs.granola.ai/help-center/taking-notes/notifications);
// journey-first-run P2. Focus blocks and solo reminders stay quiet.
const MAX_REMINDER_PARTICIPANTS = 6;

function parseParticipants(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      const result = eventParticipantSchema.safeParse(item);
      return result.success ? [result.data] : [];
    });
  } catch {
    return [];
  }
}

function getOtherParticipants(row: NotificationEventRow): Participant[] {
  return parseParticipants(row.participants_json)
    .filter((participant) => participant.is_current_user !== true)
    .filter((participant) => participant.name || participant.email)
    .slice(0, MAX_REMINDER_PARTICIPANTS)
    .map((participant) => ({
      name: participant.name || null,
      email: participant.email ?? "",
      status: "Accepted",
    }));
}

export function isMeetingWorthReminding(row: NotificationEventRow): boolean {
  return (
    Boolean(row.meeting_link?.trim()) || getOtherParticipants(row).length > 0
  );
}

export function formatEventTimeRange(start: Date, end: Date | null): string {
  const format = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (!end || end.getTime() <= start.getTime()) return format.format(start);
  return `${format.format(start)} – ${format.format(end)}`;
}

function getEventDetails(
  row: NotificationEventRow,
  title: string,
  start: Date,
): EventDetails {
  const end = row.ended_at ? parseEventInstant(row.ended_at) : null;
  return {
    what: `${title}, ${formatEventTimeRange(start, end ?? null)}`,
    timezone: null,
    location: row.location?.trim() || null,
  };
}

export async function checkEventNotifications(
  notificationEnabled: boolean,
  notifiedEvents: NotifiedEventsMap,
): Promise<void> {
  if (!notificationEnabled) return;

  const now = Date.now();
  loadNotifiedEvents(notifiedEvents);
  for (const [key, timestamp] of notifiedEvents) {
    if (now - timestamp > NOTIFIED_EVENTS_TTL_MS) notifiedEvents.delete(key);
  }

  const [{ ignoredIds, ignoredSeriesIds }, events] = await Promise.all([
    getIgnoredEventSets(),
    liveQueryClient.execute<NotificationEventRow>(`
      SELECT
        id,
        title,
        started_at,
        ended_at,
        tracking_id_event,
        recurrence_series_id,
        is_all_day,
        participants_json,
        meeting_link,
        location
      FROM events
      WHERE deleted_at IS NULL AND started_at <> '' AND is_all_day = 0
      ORDER BY started_at, id
    `),
  ]);

  for (const event of events) {
    if (Boolean(event.is_all_day)) {
      continue;
    }

    const startTime = parseEventInstant(event.started_at);
    if (!startTime) {
      continue;
    }
    const timeUntilStart = startTime.getTime() - now;
    const notificationKey = `event-${event.id}-${startTime.getTime()}`;

    if (
      event.tracking_id_event &&
      (ignoredIds.has(event.tracking_id_event) ||
        (event.recurrence_series_id &&
          ignoredSeriesIds.has(event.recurrence_series_id)))
    ) {
      continue;
    }

    if (
      timeUntilStart > -LATE_WINDOW_MS &&
      timeUntilStart <= NOTIFY_WINDOW_MS
    ) {
      if (notifiedEvents.has(notificationKey)) continue;
      if (!isMeetingWorthReminding(event)) continue;
      notifiedEvents.set(notificationKey, now);
      const minutesUntil = Math.ceil(timeUntilStart / 60_000);
      const title = event.title || t`Upcoming event`;
      const participants = getOtherParticipants(event);

      void notificationCommands.showNotification({
        key: notificationKey,
        title,
        message:
          minutesUntil <= 0
            ? t`Started`
            : minutesUntil === 1
              ? t`Starting in 1 minute`
              : t`Starting in ${minutesUntil} minutes`,
        timeout: { secs: REMINDER_VISIBLE_SECS, nanos: 0 },
        source: { type: "calendar_event", event_id: event.id },
        start_time: Math.floor(startTime.getTime() / 1000),
        participants: participants.length > 0 ? participants : null,
        event_details: getEventDetails(event, title, startTime),
        // Fork: the button says what it does: it opens the call and starts
        // notes (Granola Notifications; journey-first-run P2).
        action_label: t`Take notes`,
        action_variant: null,
        options: null,
        footer: null,
        icon: null,
      });
    } else if (timeUntilStart <= -LATE_WINDOW_MS) {
      notifiedEvents.delete(notificationKey);
    }
  }
  saveNotifiedEvents(notifiedEvents);
}
