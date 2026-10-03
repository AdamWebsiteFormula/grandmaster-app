// Fork: data for the home screen (Coming up, Follow-ups, Recent notes).
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

// -------------------------------------------------------------- Coming up

export type UpcomingEventRow = {
  id: string;
  title: string | null;
  started_at: string | null;
  ended_at: string | null;
  tracking_id_event: string | null;
  recurrence_series_id: string | null;
  participants_json: string | null;
  calendar_color?: string | null;
};

export type ComingUpEvent = {
  id: string;
  title: string;
  startMs: number;
  endMs: number | null;
  attendees: number;
  /** The calendar's color, or null to use the neutral bar. */
  color: string | null;
  /** True while the meeting runs. */
  live: boolean;
};

export type ComingUpDay = {
  /** Local midnight of the day. */
  dayMs: number;
  isToday: boolean;
  events: ComingUpEvent[];
};

/** Days of meetings the Coming up card covers, today included. */
export const COMING_UP_DAYS = 7;

// Coarse window in SQL (uses idx_events_started_at); exact checks in JS.
// Params: from (ISO), to (ISO).
export const UPCOMING_EVENTS_SQL = `
  SELECT
    event.id, event.title, event.started_at, event.ended_at,
    event.tracking_id_event, event.recurrence_series_id,
    event.participants_json, calendar.color AS calendar_color
  FROM events AS event
  LEFT JOIN calendars AS calendar
    ON calendar.id = event.calendar_id AND calendar.deleted_at IS NULL
  WHERE event.deleted_at IS NULL
    AND event.is_all_day = 0
    AND event.started_at >= ?
    AND event.started_at < ?
  ORDER BY event.started_at, event.id
  LIMIT 200
`;

function startOfLocalDay(ms: number, addDays = 0): number {
  const date = new Date(ms);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + addDays,
  ).getTime();
}

// Calendar colors are stored as hex ("#888" is the unset default).
function calendarColor(value: string | null | undefined): string | null {
  const color = value?.trim() ?? "";
  if (!/^#[0-9a-f]{3,8}$/i.test(color) || color === "#888") return null;
  return color;
}

/**
 * Granola 101 "Coming up": today first (even when nothing is left), then
 * each later day that has a meeting, up to COMING_UP_DAYS. Meetings that
 * already ended drop off; a running one stays, marked live.
 */
export function groupComingUp(
  rows: UpcomingEventRow[],
  nowMs: number,
  isIgnored: (
    trackingId: string | null | undefined,
    seriesId: string | null | undefined,
  ) => boolean = () => false,
): ComingUpDay[] {
  const todayStart = startOfLocalDay(nowMs);
  const windowEnd = startOfLocalDay(nowMs, COMING_UP_DAYS);
  const days: ComingUpDay[] = [
    { dayMs: todayStart, isToday: true, events: [] },
  ];
  const events: ComingUpEvent[] = [];

  for (const row of rows) {
    if (isIgnored(row.tracking_id_event, row.recurrence_series_id)) continue;
    const start = safeParseDate(row.started_at)?.getTime();
    if (start === undefined || Number.isNaN(start)) continue;
    const end = safeParseDate(row.ended_at)?.getTime() ?? null;
    const live = start <= nowMs && end !== null && end > nowMs;
    if (!live && (start <= nowMs || start >= windowEnd)) continue;
    events.push({
      id: row.id,
      title: row.title?.trim() || "",
      startMs: start,
      endMs: end,
      attendees: parseEventParticipants(row.participants_json ?? undefined)
        .length,
      color: calendarColor(row.calendar_color),
      live,
    });
  }

  events.sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id));
  for (const event of events) {
    const dayMs = event.live ? todayStart : startOfLocalDay(event.startMs);
    let day = days[days.length - 1];
    if (day.dayMs !== dayMs) {
      day = { dayMs, isToday: false, events: [] };
      days.push(day);
    }
    day.events.push(event);
  }
  return days;
}

function useMinuteTick(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function useComingUp(): { isLoading: boolean; days: ComingUpDay[] } {
  const nowMs = useMinuteTick();
  const { isIgnored } = useIgnoredEvents();
  // Params change once per local day, so the live query is not re-created
  // every tick.
  const today = startOfLocalDay(nowMs);
  const [fromIso, toIso] = useMemo(
    () => [
      new Date(today - DAY_MS).toISOString(),
      new Date(today + (COMING_UP_DAYS + 1) * DAY_MS).toISOString(),
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
    days: useMemo(
      () => groupComingUp(data ?? [], nowMs, isIgnored),
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
  participant_names?: string | null;
  duration_ms?: number | null;
  locked?: number | boolean | null;
  has_transcript?: number | boolean | null;
  has_content?: number | boolean | null;
};

export type RecentNote = {
  id: string;
  title: string;
  timeMs: number;
  attendees: number;
  /** Other people in the meeting, first four, you left out. */
  people: string[];
  /** Recorded length across the note's transcripts; 0 when none. */
  durationMs: number;
  /** At least one transcript, even an empty one. */
  hasTranscript: boolean;
  /** Written or generated note text, or an attachment such as audio. */
  hasContent: boolean;
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

// Fork: the second line of a note row names who was there, as Granola's
// home list does ("Bbaird & Jimharbaugh104"). You are left out: your own
// human row has the owner user id. JSON array, first four names.
const PARTICIPANT_NAMES_SQL = `(
      SELECT json_group_array(name) FROM (
        SELECT COALESCE(
          NULLIF(TRIM(human.name), ''),
          NULLIF(TRIM(participant.display_name), ''),
          NULLIF(TRIM(participant.email), '')
        ) AS name
        FROM session_participants AS participant
        LEFT JOIN humans AS human
          ON human.id = participant.human_id AND human.deleted_at IS NULL
        WHERE participant.session_id = session.id
          AND participant.deleted_at IS NULL
          AND participant.source <> 'excluded'
          AND participant.human_id <> session.owner_user_id
        ORDER BY participant.created_at, participant.id
        LIMIT 4
      ) WHERE name IS NOT NULL
    )`;

// Fork: recorded length for the row's second line ("32 min · Ana & Bo").
// ended_at_ms comes first (no JSON to parse; COALESCE stops there); else the
// last word's end_ms, which Settings › Insights also reads as the length.
const DURATION_SQL = `(
      SELECT SUM(COALESCE(
        CASE WHEN transcript.ended_at_ms > transcript.started_at_ms
          THEN transcript.ended_at_ms - transcript.started_at_ms END,
        CASE WHEN json_valid(transcript.words_json)
          THEN json_extract(transcript.words_json, '$[#-1].end_ms') END,
        0
      ))
      FROM transcripts AS transcript
      WHERE transcript.session_id = session.id
        AND transcript.deleted_at IS NULL
    )`;

// Fork (redline2-oct3, Home): flags for the row's second line and for
// hiding empty notes. A raw note counts once its ProseMirror body has text
// or any node beyond empty paragraphs (session/queries/deletion.ts reads
// the same note as content); summaries, template outputs and any attachment
// (recorded audio is cataloged there) count too.
const NOTE_FLAGS_SQL = `
    EXISTS (
      SELECT 1 FROM transcripts AS transcript
      WHERE transcript.session_id = session.id
        AND transcript.deleted_at IS NULL
    ) AS has_transcript,
    (
      EXISTS (
        SELECT 1 FROM session_documents AS document
        WHERE (document.session_id = session.id OR document.id = session.id)
          AND document.deleted_at IS NULL
          AND document.kind <> 'meeting_chat'
          AND (
            document.kind <> 'note'
            OR CASE
              WHEN document.body_format = 'prosemirror_json'
                AND json_valid(document.body)
              THEN EXISTS (
                SELECT 1 FROM json_tree(document.body) AS node
                WHERE (
                  node.key = 'text' AND node.type = 'text'
                  AND TRIM(node.atom, ' ' || char(9, 10, 13, 160)) <> ''
                ) OR (
                  node.key = 'type'
                  AND node.atom NOT IN ('doc', 'paragraph', 'text', 'hardBreak')
                )
              )
              ELSE TRIM(document.body) NOT IN ('', '&nbsp;')
            END
          )
      )
      OR EXISTS (
        SELECT 1 FROM session_attachments AS attachment
        WHERE attachment.session_id = session.id
          AND attachment.deleted_at IS NULL
      )
    ) AS has_content`;

/** No title, no note text, no transcript, no audio: nothing to open. */
export function isEmptyNote(note: RecentNote): boolean {
  return !note.title && !note.hasTranscript && !note.hasContent;
}

function parseNames(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((name): name is string => typeof name === "string")
      : [];
  } catch {
    return [];
  }
}
function flag(value: number | boolean | null | undefined): boolean {
  return value === true || Number(value) === 1;
}

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
    ) AS attendees,
    ${PARTICIPANT_NAMES_SQL} AS participant_names,
    ${DURATION_SQL} AS duration_ms,
    ${NOTE_FLAGS_SQL}
  FROM sessions AS session
  WHERE session.deleted_at IS NULL
  ORDER BY session.created_at DESC, session.id
  LIMIT ?
`;

export function groupRecentNotes(
  rows: RecentSessionRow[],
  nowMs: number,
  limit = RECENT_PAGE_SIZE,
  { hideEmpty = false }: { hideEmpty?: boolean } = {},
): { groups: RecentGroup[]; hasMore: boolean } {
  const todayStart = startOfLocalDay(nowMs);
  const yesterdayStart = startOfLocalDay(nowMs, -1);
  const all = rows
    .map((row) => ({
      id: row.id,
      title: row.title?.trim() || "",
      timeMs: sessionSearchTimestamp(row.event_json, row.created_at),
      attendees: Number(row.attendees ?? 0),
      people: parseNames(row.participant_names),
      durationMs: Math.max(0, Number(row.duration_ms ?? 0) || 0),
      hasTranscript: flag(row.has_transcript),
      hasContent: flag(row.has_content),
      locked: flag(row.locked),
      trackingId: getSessionEvent(row)?.tracking_id ?? null,
    }))
    .filter((note) => note.timeMs > 0 && note.timeMs <= nowMs)
    // Display filter only; the note itself is kept (redline2-oct3, Home).
    .filter((note) => !hideEmpty || !isEmptyNote(note))
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

// Fork: a folder page lists its notes like Home does (Granola folders,
// docs.granola.ai/help-center/sharing/folders/spaces-and-folders). Includes
// nested folders, matching the sidebar folder filter. Params: folder path,
// folder path + "/", folder path + "/", limit.
export const FOLDER_SESSIONS_SQL = `
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
    ) AS attendees,
    ${PARTICIPANT_NAMES_SQL} AS participant_names,
    ${DURATION_SQL} AS duration_ms,
    ${NOTE_FLAGS_SQL}
  FROM sessions AS session
  WHERE session.deleted_at IS NULL
    AND (
      session.folder_path = ?
      OR substr(session.folder_path, 1, length(?)) = ?
    )
  ORDER BY session.created_at DESC, session.id
  LIMIT ?
`;

function useGroupedNotes(
  sql: string,
  params: unknown[],
  limit: number,
  hideEmpty = false,
) {
  const { data, isLoading } = useLiveQuery<
    RecentSessionRow,
    RecentSessionRow[]
  >({ sql, params });
  const pendingDeletions = useUndoDelete((state) => state.pendingDeletions);
  const rows = useMemo(
    () => (data ?? []).filter((row) => !(row.id in pendingDeletions)),
    [data, pendingDeletions],
  );
  const { groups, hasMore } = useMemo(
    () => groupRecentNotes(rows, Date.now(), limit, { hideEmpty }),
    [rows, limit, hideEmpty],
  );
  return { isLoading, hasNotes: groups.length > 0, groups, hasMore };
}

export function useRecentNotes(limit = RECENT_PAGE_SIZE) {
  return useGroupedNotes(
    RECENT_SESSIONS_SQL,
    [limit + RECENT_FETCH_MARGIN],
    limit,
    true,
  );
}

export function useFolderNotes(folderPath: string, limit = RECENT_PAGE_SIZE) {
  const prefix = `${folderPath}/`;
  return useGroupedNotes(
    FOLDER_SESSIONS_SQL,
    [folderPath, prefix, prefix, limit + RECENT_FETCH_MARGIN],
    limit,
  );
}
