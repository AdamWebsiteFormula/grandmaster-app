// Fork: data for the home screen (Up next, Follow-ups, Recent notes).
// Pure helpers are exported for tests; the hooks wrap them in live queries.

import { useEffect, useMemo, useState } from "react";

import { safeParseDate } from "@anlg/utils";

import { useIgnoredEvents } from "~/calendar/ignored-events";
import { parseEventParticipants } from "~/calendar/queries";
import { executeTransaction, useLiveQuery } from "~/db";
import { enqueueDatabaseWrite } from "~/db/write-queue";
import { getSessionEvent, sessionSearchTimestamp } from "~/session/utils";
import { useUndoDelete } from "~/store/zustand/undo-delete";

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------- Up next

export type UpcomingEventRow = {
  id: string;
  title: string | null;
  started_at: string | null;
  ended_at: string | null;
  tracking_id_event: string | null;
  recurrence_series_id: string | null;
  participants_json: string | null;
};

export type UpNextEvent = {
  id: string;
  title: string;
  startMs: number;
  endMs: number | null;
  attendees: number;
  /** "now" while it runs, otherwise the day it starts on. */
  when: "now" | "today" | "tomorrow";
};

// Coarse window in SQL (uses idx_events_started_at); exact checks in JS.
// Params: from (ISO), to (ISO).
export const UPCOMING_EVENTS_SQL = `
  SELECT
    id, title, started_at, ended_at, tracking_id_event, recurrence_series_id,
    participants_json
  FROM events
  WHERE deleted_at IS NULL
    AND is_all_day = 0
    AND started_at >= ?
    AND started_at < ?
  ORDER BY started_at, id
  LIMIT 50
`;

function startOfLocalDay(ms: number, addDays = 0): number {
  const date = new Date(ms);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + addDays,
  ).getTime();
}

/** The next meeting that is running now or starts later today or tomorrow. */
export function pickUpNext(
  rows: UpcomingEventRow[],
  nowMs: number,
  isIgnored: (
    trackingId: string | null | undefined,
    seriesId: string | null | undefined,
  ) => boolean = () => false,
): UpNextEvent | null {
  const tomorrowStart = startOfLocalDay(nowMs, 1);
  const windowEnd = startOfLocalDay(nowMs, 2);
  let best: UpNextEvent | null = null;

  for (const row of rows) {
    if (isIgnored(row.tracking_id_event, row.recurrence_series_id)) continue;
    const start = safeParseDate(row.started_at)?.getTime();
    if (start === undefined || Number.isNaN(start)) continue;
    const end = safeParseDate(row.ended_at)?.getTime() ?? null;
    const running = start <= nowMs && end !== null && end > nowMs;
    if (!running && (start <= nowMs || start >= windowEnd)) continue;

    if (best && start >= best.startMs) continue;
    best = {
      id: row.id,
      title: row.title?.trim() || "",
      startMs: start,
      endMs: end,
      attendees: parseEventParticipants(row.participants_json ?? undefined)
        .length,
      when: running ? "now" : start < tomorrowStart ? "today" : "tomorrow",
    };
  }

  return best;
}

function useMinuteTick(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function useUpNext(): { isLoading: boolean; event: UpNextEvent | null } {
  const nowMs = useMinuteTick();
  const { isIgnored } = useIgnoredEvents();
  // Params change once per local day, so the live query is not re-created
  // every tick.
  const today = startOfLocalDay(nowMs);
  const [fromIso, toIso] = useMemo(
    () => [
      new Date(today - DAY_MS).toISOString(),
      new Date(today + 3 * DAY_MS).toISOString(),
    ],
    [today],
  );
  const { data, isLoading } = useLiveQuery<
    UpcomingEventRow,
    UpcomingEventRow[]
  >({
    sql: UPCOMING_EVENTS_SQL,
    params: [fromIso, toIso],
  });

  return {
    isLoading,
    event: useMemo(
      () => pickUpNext(data ?? [], nowMs, isIgnored),
      [data, nowMs, isIgnored],
    ),
  };
}

// ------------------------------------------------------------- Follow-ups

export type FollowUpRow = {
  id: string;
  text: string;
  status: string;
  session_id: string | null;
  session_title: string | null;
};

export const FOLLOW_UPS_LIMIT = 6;

// Action items are stored per note editor: raw notes use the session id as
// source id, AI notes use the session_documents id; imports set session_id.
const ACTION_ITEM_SESSION_ID = `COALESCE(
  NULLIF(item.session_id, ''),
  CASE item.source_type
    WHEN 'session_raw_note' THEN item.source_id
    WHEN 'enhanced_note' THEN (
      SELECT document.session_id FROM session_documents AS document
      WHERE document.id = item.source_id AND document.deleted_at IS NULL
    )
  END
)`;

// Open items plus the ones ticked on this screen (kept so a tick can be
// undone). Params: JSON array of item ids ticked here, limit.
export const FOLLOW_UPS_SQL = `
  SELECT
    linked.id,
    linked.text,
    linked.status,
    linked.session_id,
    session.title AS session_title
  FROM (
    SELECT
      item.id,
      TRIM(item.text) AS text,
      item.status,
      item.updated_at,
      item.source_order,
      ${ACTION_ITEM_SESSION_ID} AS session_id
    FROM action_items AS item
    WHERE item.deleted_at IS NULL
      AND TRIM(item.text) <> ''
      AND (
        item.status NOT IN ('done', 'completed')
        OR item.id IN (SELECT value FROM json_each(?))
      )
  ) AS linked
  JOIN sessions AS session
    ON session.id = linked.session_id AND session.deleted_at IS NULL
  ORDER BY session.created_at DESC, linked.source_order, linked.id
  LIMIT ?
`;

export function useFollowUps(keptIds: string[]) {
  const keptJson = useMemo(() => JSON.stringify(keptIds), [keptIds]);
  const { data, isLoading } = useLiveQuery<FollowUpRow, FollowUpRow[]>({
    sql: FOLLOW_UPS_SQL,
    params: [keptJson, FOLLOW_UPS_LIMIT],
  });
  return { isLoading, items: data ?? [] };
}

/** Same write path as the note editor's task storage ("tasks" queue). */
export function setFollowUpDone(id: string, done: boolean): Promise<void> {
  const now = new Date().toISOString();
  return enqueueDatabaseWrite("tasks", async () => {
    await executeTransaction([
      {
        sql: `
          UPDATE action_items
          SET status = ?, updated_at = ?
          WHERE id = ? AND deleted_at IS NULL
        `,
        params: [done ? "done" : "todo", now, id],
      },
    ]);
  });
}

// ----------------------------------------------------------- Recent notes

export type RecentSessionRow = {
  id: string;
  title: string | null;
  created_at: string;
  event_json: string | null;
  attendees: number | null;
  locked?: number | boolean | null;
};

export type RecentNote = {
  id: string;
  title: string;
  timeMs: number;
  attendees: number;
  locked: boolean;
  trackingId: string | null;
};

// Fork (Granola 101): every note, grouped Today, Yesterday, then one group
// per day ("Wed, Sep 30"), paged with "Show more".
export type RecentGroup = {
  key: string;
  kind: "today" | "yesterday" | "day";
  /** Local midnight of the group's day. */
  dayMs: number;
  notes: RecentNote[];
};

export const RECENT_PAGE_SIZE = 20;
// Notes for future calendar events are dropped in JS, so fetch a margin.
const RECENT_FETCH_MARGIN = 50;

// Same rows the sidebar listed (every session not deleted). Params: limit.
export const RECENT_SESSIONS_SQL = `
  SELECT
    session.id,
    session.title,
    session.created_at,
    session.event_json,
    session.locked,
    (
      SELECT COUNT(*) FROM session_participants AS participant
      WHERE participant.session_id = session.id
        AND participant.deleted_at IS NULL
    ) AS attendees
  FROM sessions AS session
  WHERE session.deleted_at IS NULL
  ORDER BY session.created_at DESC, session.id
  LIMIT ?
`;

export function groupRecentNotes(
  rows: RecentSessionRow[],
  nowMs: number,
  limit = RECENT_PAGE_SIZE,
): { groups: RecentGroup[]; hasMore: boolean } {
  const todayStart = startOfLocalDay(nowMs);
  const yesterdayStart = startOfLocalDay(nowMs, -1);
  const all = rows
    .map((row) => ({
      id: row.id,
      title: row.title?.trim() || "",
      timeMs: sessionSearchTimestamp(row.event_json, row.created_at),
      attendees: Number(row.attendees ?? 0),
      locked: row.locked === true || Number(row.locked) === 1,
      trackingId: getSessionEvent(row)?.tracking_id ?? null,
    }))
    .filter((note) => note.timeMs > 0 && note.timeMs <= nowMs)
    .sort((a, b) => b.timeMs - a.timeMs);

  const groups: RecentGroup[] = [];
  for (const note of all.slice(0, limit)) {
    const dayMs = startOfLocalDay(note.timeMs);
    let group = groups[groups.length - 1];
    if (!group || group.dayMs !== dayMs) {
      const kind =
        dayMs === todayStart
          ? "today"
          : dayMs === yesterdayStart
            ? "yesterday"
            : "day";
      group = {
        key: kind === "day" ? String(dayMs) : kind,
        kind,
        dayMs,
        notes: [],
      };
      groups.push(group);
    }
    group.notes.push(note);
  }
  return { groups, hasMore: all.length > limit };
}

export function useRecentNotes(limit = RECENT_PAGE_SIZE) {
  const { data, isLoading } = useLiveQuery<
    RecentSessionRow,
    RecentSessionRow[]
  >({
    sql: RECENT_SESSIONS_SQL,
    params: [limit + RECENT_FETCH_MARGIN],
  });
  const pendingDeletions = useUndoDelete((state) => state.pendingDeletions);
  const rows = useMemo(
    () => (data ?? []).filter((row) => !(row.id in pendingDeletions)),
    [data, pendingDeletions],
  );
  const { groups, hasMore } = useMemo(
    () => groupRecentNotes(rows, Date.now(), limit),
    [rows, limit],
  );
  return { isLoading, hasNotes: rows.length > 0, groups, hasMore };
}
