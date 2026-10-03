// Fork: ⌘K hides the empty notes Home hides (no title, no note text, no
// transcript, no audio), with Home's own query and rule, so both lists agree
// (journey-after P3 "⌘K search, no query"; NN/g #4 consistency).
import { useMemo } from "react";

import { useLiveQuery } from "~/db";
import {
  isEmptyNote,
  RECENT_SESSIONS_SQL,
  type RecentNote,
  type RecentSessionRow,
} from "~/home/home-data";

const MAX_SCANNED_NOTES = 5000;

const EMPTY_NOTE_ROWS_SQL = `
  SELECT id, title, has_transcript, has_content
  FROM (${RECENT_SESSIONS_SQL})
  WHERE TRIM(COALESCE(title, '')) = ''
`;

const NO_IDS: ReadonlySet<string> = new Set();

function flag(value: number | boolean | null | undefined): boolean {
  return value === true || Number(value) === 1;
}

export function emptyNoteIdsFromRows(
  rows: readonly Pick<
    RecentSessionRow,
    "id" | "title" | "has_transcript" | "has_content"
  >[],
): ReadonlySet<string> {
  return new Set(
    rows
      .filter((row) =>
        isEmptyNote({
          title: row.title?.trim() ?? "",
          hasTranscript: flag(row.has_transcript),
          hasContent: flag(row.has_content),
        } as RecentNote),
      )
      .map((row) => row.id),
  );
}

export function useEmptyNoteIds(enabled: boolean): ReadonlySet<string> {
  const { data } = useLiveQuery<RecentSessionRow, RecentSessionRow[]>({
    sql: EMPTY_NOTE_ROWS_SQL,
    params: [MAX_SCANNED_NOTES],
    enabled,
  });
  return useMemo(() => (data ? emptyNoteIdsFromRows(data) : NO_IDS), [data]);
}
