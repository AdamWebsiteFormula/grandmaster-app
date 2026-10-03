import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

vi.mock("~/db", () => ({ useLiveQuery: vi.fn(), executeTransaction: vi.fn() }));
vi.mock("~/db/write-queue", () => ({ enqueueDatabaseWrite: vi.fn() }));
vi.mock("~/calendar/ignored-events", () => ({ useIgnoredEvents: vi.fn() }));

import {
  FOLDER_SESSIONS_SQL,
  FOLLOW_UPS_SQL,
  groupRecentNotes,
  groupComingUp,
  RECENT_SESSIONS_SQL,
  UPCOMING_EVENTS_SQL,
  type UpcomingEventRow,
} from "./home-data";

const { DatabaseSync } = createRequire(import.meta.url)(
  "node:sqlite",
) as typeof import("node:sqlite");

// Saturday Oct 3, 2026, 10:00 local time.
const NOW = new Date(2026, 9, 3, 10, 0).getTime();
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 9, day, hour, minute).toISOString();

function event(
  id: string,
  start: string,
  end: string,
  extra: Partial<UpcomingEventRow> = {},
): UpcomingEventRow {
  return {
    id,
    title: id,
    started_at: start,
    ended_at: end,
    tracking_id_event: id,
    recurrence_series_id: null,
    participants_json: null,
    ...extra,
  };
}

describe("groupComingUp", () => {
  const dayOf = (day: number) => new Date(2026, 9, day).getTime();

  it("always starts with today, even when nothing is left", () => {
    expect(groupComingUp([], NOW)).toEqual([
      { dayMs: dayOf(3), isToday: true, events: [] },
    ]);
    const days = groupComingUp(
      [
        event("past", at(3, 8), at(3, 9)),
        event("too-late", at(10, 9), at(10, 10)),
      ],
      NOW,
    );
    expect(days).toEqual([{ dayMs: dayOf(3), isToday: true, events: [] }]);
  });

  it("groups the next days by day, soonest first, with colors and attendees", () => {
    const days = groupComingUp(
      [
        event("mon-b", at(5, 12), at(5, 13)),
        event("sun", at(4, 10), at(4, 10, 5), { calendar_color: "#3B82F6" }),
        event("mon-a", at(5, 10), at(5, 10, 5), {
          participants_json: JSON.stringify([
            { name: "Ana" },
            { email: "bo@example.com" },
          ]),
          calendar_color: "#888",
        }),
        event("fri", at(9, 9), at(9, 10)),
      ],
      NOW,
    );
    expect(days.map((day) => day.dayMs)).toEqual([
      dayOf(3),
      dayOf(4),
      dayOf(5),
      dayOf(9),
    ]);
    expect(days[0].events).toEqual([]);
    expect(days[1].events[0]).toMatchObject({
      id: "sun",
      color: "#3B82F6",
      live: false,
    });
    expect(days[2].events.map((item) => item.id)).toEqual(["mon-a", "mon-b"]);
    expect(days[2].events[0]).toMatchObject({ attendees: 2, color: null });
  });

  it("keeps a running meeting under today, marked live", () => {
    const days = groupComingUp(
      [
        event("running", at(3, 9, 30), at(3, 10, 30)),
        event("later", at(3, 14), at(3, 15)),
      ],
      NOW,
    );
    expect(days).toHaveLength(1);
    expect(days[0].events.map((item) => [item.id, item.live])).toEqual([
      ["running", true],
      ["later", false],
    ]);
  });

  it("skips ignored meetings", () => {
    const days = groupComingUp(
      [event("skip", at(4, 14), at(4, 15))],
      NOW,
      (id) => id === "skip",
    );
    expect(days).toHaveLength(1);
  });
});

describe("groupRecentNotes", () => {
  it("groups into today, yesterday and earlier, newest first, capped", () => {
    const rows = [
      {
        id: "a",
        title: "Standup",
        created_at: at(3, 9),
        event_json: null,
        attendees: 3,
        participant_names: JSON.stringify(["Ana", "Bo"]),
        duration_ms: 90000,
      },
      {
        id: "b",
        title: "",
        created_at: at(2, 16),
        event_json: null,
        attendees: 0,
      },
      {
        id: "c",
        title: "Kickoff",
        created_at: at(1, 11),
        event_json: null,
        attendees: 1,
      },
      {
        id: "d",
        title: "Old",
        created_at: at(1, 9),
        event_json: null,
        attendees: 0,
      },
      {
        id: "future",
        title: "Prep",
        created_at: at(3, 8),
        event_json: JSON.stringify({ started_at: at(4, 9) }),
        attendees: 0,
      },
    ];
    const { groups, hasMore } = groupRecentNotes(rows, NOW, 3);
    expect(groups.map((group) => group.kind)).toEqual([
      "today",
      "yesterday",
      "day",
    ]);
    expect(groups[2].dayMs).toBe(new Date(2026, 9, 1).getTime());
    expect(groups.flatMap((group) => group.notes.map((n) => n.id))).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(groups[0].notes[0]).toMatchObject({
      title: "Standup",
      attendees: 3,
      people: ["Ana", "Bo"],
      durationMs: 90000,
      locked: false,
    });
    expect(groups[1].notes[0].people).toEqual([]);
    expect(groups[1].notes[0].durationMs).toBe(0);
    expect(hasMore).toBe(true);
  });

  it("gives each earlier day its own group and pages by limit", () => {
    const rows = [1, 1, 30].map((day, index) => ({
      id: `n${index}`,
      title: "Note",
      created_at:
        day === 30
          ? new Date(2026, 8, 30, 9).toISOString()
          : at(day, 9 - index),
      event_json: JSON.stringify({ tracking_id: `t${index}` }),
      attendees: 0,
      locked: index === 0 ? 1 : 0,
    }));
    const { groups, hasMore } = groupRecentNotes(rows, NOW, 20);
    expect(groups.map((group) => group.notes.length)).toEqual([2, 1]);
    expect(groups[1].dayMs).toBe(new Date(2026, 8, 30).getTime());
    expect(groups[0].notes[0]).toMatchObject({
      locked: true,
      trackingId: "t0",
    });
    expect(hasMore).toBe(false);
  });

  it("returns no groups without notes", () => {
    expect(groupRecentNotes([], NOW)).toEqual({ groups: [], hasMore: false });
  });
});

const PARTICIPANT_TABLES = `
  CREATE TABLE humans (id TEXT PRIMARY KEY, name TEXT, deleted_at TEXT);
  CREATE TABLE session_participants (id TEXT PRIMARY KEY, session_id TEXT, human_id TEXT, display_name TEXT, email TEXT, source TEXT, created_at TEXT, deleted_at TEXT);
  CREATE TABLE transcripts (id TEXT PRIMARY KEY, session_id TEXT, started_at_ms INTEGER, ended_at_ms INTEGER, words_json TEXT, deleted_at TEXT);
`;

describe("home SQL", () => {
  it("links follow-ups to their note and keeps ticked items", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(`
        CREATE TABLE sessions (id TEXT PRIMARY KEY, title TEXT, created_at TEXT, event_json TEXT, deleted_at TEXT, locked INTEGER DEFAULT 0, owner_user_id TEXT DEFAULT 'me');
        CREATE TABLE session_documents (id TEXT PRIMARY KEY, session_id TEXT, deleted_at TEXT);
        ${PARTICIPANT_TABLES}
        CREATE TABLE action_items (id TEXT PRIMARY KEY, session_id TEXT, source_type TEXT, source_id TEXT, source_order INTEGER, status TEXT, text TEXT, updated_at TEXT, deleted_at TEXT);
        INSERT INTO sessions VALUES ('s1', 'Design review', '2026-10-02T10:00:00Z', '', NULL, 1, 'me');
        INSERT INTO sessions VALUES ('s2', 'Gone', '2026-10-03T10:00:00Z', '', '2026-10-03T11:00:00Z', 0, 'me');
        INSERT INTO session_documents VALUES ('doc1', 's1', NULL);
        INSERT INTO humans VALUES ('me', 'Adam', NULL);
        INSERT INTO humans VALUES ('h-ana', 'Ana Ruiz', NULL);
        INSERT INTO session_participants VALUES ('p1', 's1', 'me', '', '', 'calendar', '1', NULL);
        INSERT INTO session_participants VALUES ('p2', 's1', 'h-ana', 'Ana', '', 'calendar', '2', NULL);
        INSERT INTO session_participants VALUES ('p3', 's1', '', '', 'bo@example.com', 'calendar', '3', NULL);
        INSERT INTO session_participants VALUES ('p4', 's1', 'h-x', 'Gone', '', 'excluded', '4', NULL);
        INSERT INTO transcripts VALUES ('t1', 's1', 1000, 601000, '[]', NULL);
        INSERT INTO transcripts VALUES ('t2', 's1', 0, NULL, '[{"text":"hi","start_ms":0,"end_ms":1000},{"text":"bye","start_ms":1000,"end_ms":120000}]', NULL);
        INSERT INTO transcripts VALUES ('t3', 's1', 0, NULL, 'not json', NULL);
        INSERT INTO transcripts VALUES ('t4', 's1', 0, 999999, '[]', '2026-10-03');
        INSERT INTO action_items VALUES ('raw', '', 'session_raw_note', 's1', 0, 'todo', 'Send deck', '', NULL);
        INSERT INTO action_items VALUES ('ai', '', 'enhanced_note', 'doc1', 1, 'todo', 'Book room', '', NULL);
        INSERT INTO action_items VALUES ('done', '', 'enhanced_note', 'doc1', 2, 'done', 'Old task', '', NULL);
        INSERT INTO action_items VALUES ('kept', '', 'enhanced_note', 'doc1', 3, 'done', 'Just ticked', '', NULL);
        INSERT INTO action_items VALUES ('deleted-note', 's2', 'import', 's2', 0, 'todo', 'Hidden', '', NULL);
        INSERT INTO action_items VALUES ('blank', '', 'session_raw_note', 's1', 4, 'todo', '  ', '', NULL);
      `);

      const items = db
        .prepare(FOLLOW_UPS_SQL)
        .all(JSON.stringify(["kept"]), 6) as Array<{
        id: string;
        session_id: string;
        session_title: string;
      }>;
      expect(items.map((item) => item.id)).toEqual(["raw", "ai", "kept"]);
      expect(items[1]).toMatchObject({
        session_id: "s1",
        session_title: "Design review",
      });

      const recent = db.prepare(RECENT_SESSIONS_SQL).all(10) as Array<{
        id: string;
        attendees: number;
      }>;
      expect(recent).toEqual([
        expect.objectContaining({
          id: "s1",
          attendees: 4,
          locked: 1,
          participant_names: JSON.stringify(["Ana Ruiz", "bo@example.com"]),
          // 10 min from ended_at_ms plus 2 min from the last word; bad JSON
          // and deleted transcripts add nothing.
          duration_ms: 720000,
        }),
      ]);
    } finally {
      db.close();
    }
  });

  it("reads timed events in the window with their calendar color", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(`
        CREATE TABLE calendars (id TEXT PRIMARY KEY, color TEXT, deleted_at TEXT);
        CREATE TABLE events (id TEXT PRIMARY KEY, calendar_id TEXT, title TEXT, started_at TEXT, ended_at TEXT, tracking_id_event TEXT, recurrence_series_id TEXT, participants_json TEXT, is_all_day INTEGER, deleted_at TEXT);
        INSERT INTO calendars VALUES ('work', '#3B82F6', NULL);
        INSERT INTO events VALUES ('a', 'work', 'Review', '2026-10-04T14:00:00Z', '2026-10-04T15:00:00Z', 't', '', NULL, 0, NULL);
        INSERT INTO events VALUES ('b', 'none', 'Lunch', '2026-10-05T12:00:00Z', '2026-10-05T13:00:00Z', 't', '', NULL, 0, NULL);
        INSERT INTO events VALUES ('all-day', 'work', 'Holiday', '2026-10-04T00:00:00Z', '', 't', '', NULL, 1, NULL);
        INSERT INTO events VALUES ('deleted', 'work', 'Gone', '2026-10-04T09:00:00Z', '', 't', '', NULL, 0, '2026-10-01');
        INSERT INTO events VALUES ('late', 'work', 'Later', '2026-10-20T09:00:00Z', '', 't', '', NULL, 0, NULL);
      `);
      const rows = db
        .prepare(UPCOMING_EVENTS_SQL)
        .all("2026-10-03T00:00:00Z", "2026-10-11T00:00:00Z") as Array<{
        id: string;
        calendar_color: string | null;
      }>;
      expect(rows.map((row) => [row.id, row.calendar_color])).toEqual([
        ["a", "#3B82F6"],
        ["b", null],
      ]);
    } finally {
      db.close();
    }
  });

  it("lists a folder's notes, including nested folders", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(`
        CREATE TABLE sessions (id TEXT PRIMARY KEY, title TEXT, created_at TEXT, event_json TEXT, deleted_at TEXT, locked INTEGER DEFAULT 0, folder_path TEXT DEFAULT '', owner_user_id TEXT DEFAULT 'me');
        ${PARTICIPANT_TABLES}
        INSERT INTO sessions VALUES ('a', 'In folder', '2026-10-02T10:00:00Z', '', NULL, 0, 'Work', 'me');
        INSERT INTO sessions VALUES ('b', 'Nested', '2026-10-03T10:00:00Z', '', NULL, 0, 'Work/Hiring', 'me');
        INSERT INTO sessions VALUES ('c', 'Sibling prefix', '2026-10-03T11:00:00Z', '', NULL, 0, 'Workshop', 'me');
        INSERT INTO sessions VALUES ('d', 'Deleted', '2026-10-03T12:00:00Z', '', '2026-10-03T13:00:00Z', 0, 'Work', 'me');
        INSERT INTO sessions VALUES ('e', 'No folder', '2026-10-03T12:00:00Z', '', NULL, 0, '', 'me');
        INSERT INTO sessions VALUES ('f', 'Wildcard', '2026-10-03T12:00:00Z', '', NULL, 0, 'Wor_', 'me');
      `);

      const rows = db
        .prepare(FOLDER_SESSIONS_SQL)
        .all("Work", "Work/", "Work/", 10) as Array<{ id: string }>;
      expect(rows.map((row) => row.id)).toEqual(["b", "a"]);
    } finally {
      db.close();
    }
  });
});
