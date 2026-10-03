import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

vi.mock("~/db", () => ({ useLiveQuery: vi.fn(), executeTransaction: vi.fn() }));
vi.mock("~/db/write-queue", () => ({ enqueueDatabaseWrite: vi.fn() }));
vi.mock("~/calendar/ignored-events", () => ({ useIgnoredEvents: vi.fn() }));

import {
  FOLLOW_UPS_SQL,
  groupRecentNotes,
  pickUpNext,
  RECENT_SESSIONS_SQL,
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

describe("pickUpNext", () => {
  it("returns null when nothing is scheduled today or tomorrow", () => {
    expect(pickUpNext([], NOW)).toBeNull();
    expect(
      pickUpNext(
        [
          event("past", at(3, 8), at(3, 9)),
          event("later", at(5, 9), at(5, 10)),
        ],
        NOW,
      ),
    ).toBeNull();
  });

  it("picks the soonest meeting and counts attendees", () => {
    const next = pickUpNext(
      [
        event("tomorrow", at(4, 9), at(4, 10)),
        event("today", at(3, 14), at(3, 15), {
          participants_json: JSON.stringify([
            { name: "Ana" },
            { email: "bo@example.com" },
          ]),
        }),
      ],
      NOW,
    );
    expect(next).toMatchObject({ id: "today", when: "today", attendees: 2 });
  });

  it("shows a running meeting as now and labels tomorrow", () => {
    expect(
      pickUpNext([event("running", at(3, 9, 30), at(3, 10, 30))], NOW),
    ).toMatchObject({ id: "running", when: "now" });
    expect(
      pickUpNext([event("tomorrow", at(4, 9), at(4, 10))], NOW),
    ).toMatchObject({ when: "tomorrow" });
  });

  it("skips ignored meetings", () => {
    expect(
      pickUpNext([event("skip", at(3, 14), at(3, 15))], NOW, (id) =>
        Boolean(id === "skip"),
      ),
    ).toBeNull();
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
      locked: false,
    });
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

describe("home SQL", () => {
  it("links follow-ups to their note and keeps ticked items", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(`
        CREATE TABLE sessions (id TEXT PRIMARY KEY, title TEXT, created_at TEXT, event_json TEXT, deleted_at TEXT, locked INTEGER DEFAULT 0);
        CREATE TABLE session_documents (id TEXT PRIMARY KEY, session_id TEXT, deleted_at TEXT);
        CREATE TABLE session_participants (id TEXT PRIMARY KEY, session_id TEXT, deleted_at TEXT);
        CREATE TABLE action_items (id TEXT PRIMARY KEY, session_id TEXT, source_type TEXT, source_id TEXT, source_order INTEGER, status TEXT, text TEXT, updated_at TEXT, deleted_at TEXT);
        INSERT INTO sessions VALUES ('s1', 'Design review', '2026-10-02T10:00:00Z', '', NULL, 1);
        INSERT INTO sessions VALUES ('s2', 'Gone', '2026-10-03T10:00:00Z', '', '2026-10-03T11:00:00Z', 0);
        INSERT INTO session_documents VALUES ('doc1', 's1', NULL);
        INSERT INTO session_participants VALUES ('p1', 's1', NULL);
        INSERT INTO session_participants VALUES ('p2', 's1', NULL);
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
        expect.objectContaining({ id: "s1", attendees: 2, locked: 1 }),
      ]);
    } finally {
      db.close();
    }
  });
});
