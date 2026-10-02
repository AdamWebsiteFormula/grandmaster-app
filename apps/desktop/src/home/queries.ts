// Fork (F5): local SQLite aggregates for the home stat cards. Each query
// returns a handful of rows; the heavy lifting (word counts, speaking time,
// per-meeting enhance status) happens inside SQLite.

import { useMemo } from "react";

import type { ChannelSpeech, MeetingDay } from "./stats";
import { STREAK_LOOKBACK_DAYS } from "./stats";

import { useAuth } from "~/auth";
import { useLiveQuery } from "~/db";
import { WELCOME_NOTE_TRACKING_ID } from "~/onboarding/welcome-note.constants";
import { DEFAULT_USER_ID } from "~/shared/utils";

// The bundled welcome note is a demo, not the user's meeting.
const OWNED_REAL_SESSION = `
  session.deleted_at IS NULL
  AND COALESCE(session.owner_user_id, '') IN (?, '', '${DEFAULT_USER_ID}')
  AND NOT CASE WHEN json_valid(session.event_json)
    THEN COALESCE(json_extract(session.event_json, '$.tracking_id') = '${WELCOME_NOTE_TRACKING_ID}', 0)
    ELSE 0 END
`;

const SAFE_WORDS_JSON = `CASE
  WHEN json_valid(transcript.words_json) AND json_type(transcript.words_json) = 'array'
    THEN transcript.words_json
  ELSE '[]'
END`;

const TRANSCRIPT_STARTED_MS = `CASE
  WHEN transcript.started_at_ms > 0 THEN transcript.started_at_ms
  ELSE CAST(strftime('%s', transcript.created_at) AS INTEGER) * 1000
END`;

// Word estimate without parsing the note. ProseMirror JSON is stored without
// whitespace outside strings, so spaces + one per text node ≈ words.
// Markdown: spaces + line breaks.
const NOTE_WORDS = `CASE
  WHEN document.body_format = 'prosemirror_json' THEN
    (LENGTH(document.body) - LENGTH(REPLACE(document.body, ' ', '')))
    + (LENGTH(document.body) - LENGTH(REPLACE(document.body, '"text":', ''))) / 7
  ELSE
    (LENGTH(document.body) - LENGTH(REPLACE(document.body, ' ', '')))
    + (LENGTH(document.body) - LENGTH(REPLACE(document.body, char(10), ''))) + 1
END`;

const HAS_NOTE_TEXT = `CASE
  WHEN document.body_format = 'prosemirror_json'
    THEN INSTR(document.body, '"text":') > 0
  ELSE LENGTH(TRIM(document.body)) > 0
END`;

export type NotesRow = {
  total_words: number | null;
  month_generations: number | null;
  month_output_words: number | null;
  month_input_chars: number | null;
};

// Params: month start (ISO) three times, then owner id.
export const NOTES_SQL = `
  SELECT
    SUM(${NOTE_WORDS}) AS total_words,
    SUM(CASE WHEN document.created_at >= ? THEN 1 ELSE 0 END) AS month_generations,
    SUM(CASE WHEN document.created_at >= ? THEN ${NOTE_WORDS} ELSE 0 END) AS month_output_words,
    SUM(CASE WHEN document.created_at >= ? THEN (
      SELECT COALESCE(SUM(LENGTH(json_extract(word.value, '$.text'))), 0)
      FROM transcripts AS transcript
      JOIN json_each(${SAFE_WORDS_JSON}) AS word
      WHERE transcript.session_id = document.session_id
        AND transcript.deleted_at IS NULL
        AND word.type = 'object'
    ) ELSE 0 END) AS month_input_chars
  FROM session_documents AS document
  JOIN sessions AS session ON session.id = document.session_id
  WHERE document.kind IN ('summary', 'template_output')
    AND document.deleted_at IS NULL
    AND ${HAS_NOTE_TEXT}
    AND ${OWNED_REAL_SESSION}
`;

// Speaking time per channel: word durations plus pauses under 1.5 s between
// consecutive words on the same channel. Params: owner id, since (epoch ms).
export const TALK_SQL = `
  SELECT
    spoken.channel AS channel,
    COUNT(*) AS words,
    SUM(spoken.duration_ms)
      + SUM(CASE WHEN spoken.gap_ms BETWEEN 0 AND 1500 THEN spoken.gap_ms ELSE 0 END)
      AS speech_ms
  FROM (
    SELECT
      json_extract(word.value, '$.channel') AS channel,
      MAX(0, json_extract(word.value, '$.end_ms') - json_extract(word.value, '$.start_ms')) AS duration_ms,
      json_extract(word.value, '$.start_ms') - LAG(json_extract(word.value, '$.end_ms')) OVER (
        PARTITION BY transcript.id, json_extract(word.value, '$.channel')
        ORDER BY json_extract(word.value, '$.start_ms')
      ) AS gap_ms
    FROM transcripts AS transcript
    JOIN sessions AS session ON session.id = transcript.session_id
    JOIN json_each(${SAFE_WORDS_JSON}) AS word
    WHERE transcript.deleted_at IS NULL
      AND ${OWNED_REAL_SESSION}
      AND ${TRANSCRIPT_STARTED_MS} >= ?
      AND word.type = 'object'
      AND json_extract(word.value, '$.channel') IN (0, 1)
      AND json_type(word.value, '$.start_ms') IN ('integer', 'real')
      AND json_type(word.value, '$.end_ms') IN ('integer', 'real')
  ) AS spoken
  GROUP BY spoken.channel
`;

// One row per transcribed meeting: when it started and whether it has an
// enhanced note. Params: owner id, since (epoch ms).
export const STREAK_SQL = `
  SELECT
    MIN(${TRANSCRIPT_STARTED_MS}) AS started_at_ms,
    EXISTS (
      SELECT 1 FROM session_documents AS document
      WHERE document.session_id = session.id
        AND document.kind IN ('summary', 'template_output')
        AND document.deleted_at IS NULL
        AND ${HAS_NOTE_TEXT}
    ) AS enhanced
  FROM sessions AS session
  JOIN transcripts AS transcript ON transcript.session_id = session.id
  WHERE transcript.deleted_at IS NULL
    AND ${OWNED_REAL_SESSION}
    AND json_valid(transcript.words_json)
    AND json_array_length(transcript.words_json) > 0
  GROUP BY session.id
  HAVING started_at_ms >= ?
`;

/** Stable per local day, so live queries are not re-subscribed every render. */
function useDayStamp(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
}

function startOfLocalDay(daysAgo: number): number {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - daysAgo,
  ).getTime();
}

export function useHomeStats() {
  const auth = useAuth();
  const ownerId = auth.session?.user.id ?? DEFAULT_USER_ID;
  const day = useDayStamp();

  const { monthStartIso, talkSince, streakSince } = useMemo(() => {
    const now = new Date();
    return {
      monthStartIso: new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      ).toISOString(),
      // Last 7 days including today.
      talkSince: startOfLocalDay(6),
      streakSince: startOfLocalDay(STREAK_LOOKBACK_DAYS),
    };
  }, [day]);

  const notes = useLiveQuery<NotesRow, NotesRow | null>({
    sql: NOTES_SQL,
    params: [monthStartIso, monthStartIso, monthStartIso, ownerId],
    mapRows: (rows) => rows[0] ?? null,
  });
  const talk = useLiveQuery<ChannelSpeech, ChannelSpeech[]>({
    sql: TALK_SQL,
    params: [ownerId, talkSince],
  });
  const streak = useLiveQuery<MeetingDay, MeetingDay[]>({
    sql: STREAK_SQL,
    params: [ownerId, streakSince],
  });

  return {
    isLoading: notes.isLoading || talk.isLoading || streak.isLoading,
    notes: notes.data ?? null,
    talk: talk.data ?? [],
    meetings: streak.data ?? [],
  };
}
