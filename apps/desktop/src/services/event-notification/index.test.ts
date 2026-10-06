import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  getIgnoredEventSets: vi.fn(() =>
    Promise.resolve({ ignoredIds: new Set(), ignoredSeriesIds: new Set() }),
  ),
  showNotification: vi.fn(),
}));

vi.mock("@anlg/plugin-notification", () => ({
  commands: { showNotification: mocks.showNotification },
}));

vi.mock("~/calendar/ignored-events", () => ({
  getIgnoredEventSets: mocks.getIgnoredEventSets,
}));

vi.mock("~/db", () => ({
  liveQueryClient: { execute: mocks.execute },
}));

import { checkEventNotifications, formatEventTimeRange } from ".";

describe("checkEventNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.execute.mockReset();
    mocks.execute.mockResolvedValue([]);
    vi.spyOn(Date, "now").mockReturnValue(
      new Date("2026-05-15T12:00:00.000Z").getTime(),
    );
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test.each([
    ["an ISO timestamp", "2026-05-15T12:01:00.000Z"],
    ["a timezone-naive Graph timestamp as UTC", "2026-05-15T12:01:00.0000000"],
  ])("notifies an upcoming event from %s", async (_name, startedAt) => {
    mocks.execute.mockResolvedValueOnce([
      {
        id: "event-1",
        started_at: startedAt,
        tracking_id_event: "tracking-1",
        recurrence_series_id: "series-1",
        title: "Design Review",
        is_all_day: 0,
        meeting_link: "https://meet.google.com/abc-defg-hij",
      },
    ]);

    await checkEventNotifications(true, new Map());

    expect(mocks.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        source: { type: "calendar_event", event_id: "event-1" },
        message: "Starting in 1 minute",
        action_label: "Take notes",
        start_time: new Date("2026-05-15T12:01:00.000Z").getTime() / 1000,
      }),
    );
  });

  // Granola reminds one minute before (docs.granola.ai/help-center/taking-notes/notifications).
  test("waits until one minute before the meeting", async () => {
    mocks.execute.mockResolvedValueOnce([
      {
        id: "event-1",
        started_at: "2026-05-15T12:02:00.000Z",
        tracking_id_event: "tracking-1",
        recurrence_series_id: "",
        title: "Design Review",
        is_all_day: 0,
        meeting_link: "https://meet.google.com/abc-defg-hij",
      },
    ]);

    await checkEventNotifications(true, new Map());

    expect(mocks.showNotification).not.toHaveBeenCalled();
  });

  test("still reminds in the first minute when the check runs late", async () => {
    mocks.execute.mockResolvedValueOnce([
      {
        id: "event-1",
        started_at: "2026-05-15T11:59:30.000Z",
        tracking_id_event: "tracking-1",
        recurrence_series_id: "",
        title: "Design Review",
        is_all_day: 0,
        meeting_link: "https://meet.google.com/abc-defg-hij",
      },
      {
        id: "event-2",
        started_at: "2026-05-15T11:58:30.000Z",
        tracking_id_event: "tracking-2",
        recurrence_series_id: "",
        title: "Earlier call",
        is_all_day: 0,
        meeting_link: "https://meet.google.com/abc-defg-hij",
      },
    ]);

    await checkEventNotifications(true, new Map());

    expect(mocks.showNotification).toHaveBeenCalledTimes(1);
    expect(mocks.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        source: { type: "calendar_event", event_id: "event-1" },
        message: "Starting now",
      }),
    );
  });

  test("does not query or notify when event notifications are disabled", async () => {
    await checkEventNotifications(false, new Map());

    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.showNotification).not.toHaveBeenCalled();
  });

  test("skips ignored tracking ids", async () => {
    mocks.getIgnoredEventSets.mockResolvedValueOnce({
      ignoredIds: new Set(["tracking-1"]),
      ignoredSeriesIds: new Set<string>(),
    });
    mocks.execute.mockResolvedValueOnce([
      {
        id: "event-1",
        started_at: "2026-05-15T12:01:00.000Z",
        tracking_id_event: "tracking-1",
        recurrence_series_id: "",
        title: "Design Review",
        is_all_day: 0,
      },
    ]);

    await checkEventNotifications(true, new Map());

    expect(mocks.showNotification).not.toHaveBeenCalled();
  });

  test("skips all-day events even if the query returns one", async () => {
    mocks.execute.mockResolvedValueOnce([
      {
        id: "event-1",
        started_at: "2026-05-15T12:01:00.000Z",
        tracking_id_event: "tracking-1",
        recurrence_series_id: "",
        title: "Company holiday",
        is_all_day: 1,
      },
    ]);

    await checkEventNotifications(true, new Map());

    expect(mocks.showNotification).not.toHaveBeenCalled();
  });

  const meeting = (overrides: Record<string, unknown> = {}) => ({
    id: "event-1",
    started_at: "2026-05-15T12:01:00.000Z",
    ended_at: "2026-05-15T12:32:00.000Z",
    tracking_id_event: "tracking-1",
    recurrence_series_id: "",
    title: "Design Review",
    is_all_day: 0,
    participants_json: null,
    meeting_link: "",
    location: "",
    ...overrides,
  });

  test("stays quiet for a solo event with no call link", async () => {
    mocks.execute.mockResolvedValueOnce([
      meeting({
        title: "Focus time",
        participants_json: JSON.stringify([
          { name: "Me", email: "me@example.com", is_current_user: true },
        ]),
      }),
    ]);

    await checkEventNotifications(true, new Map());

    expect(mocks.showNotification).not.toHaveBeenCalled();
  });

  test("reminds when someone else is invited, and lists them with the time", async () => {
    mocks.execute.mockResolvedValueOnce([
      meeting({
        location: "Room 4",
        participants_json: JSON.stringify([
          { name: "Me", email: "me@example.com", is_current_user: true },
          { name: "Dana Lee", email: "dana@example.com" },
          { email: "sam@example.com" },
        ]),
      }),
    ]);

    await checkEventNotifications(true, new Map());

    const payload = mocks.showNotification.mock.calls[0]![0];
    expect(payload.participants).toEqual([
      { name: "Dana Lee", email: "dana@example.com", status: "Accepted" },
      { name: null, email: "sam@example.com", status: "Accepted" },
    ]);
    expect(payload.event_details.what).toMatch(/^Design Review, /);
    expect(payload.event_details.location).toBe("Room 4");
  });

  test("does not show the same reminder again after a relaunch", async () => {
    const event = meeting({ meeting_link: "https://zoom.us/j/1" });
    mocks.execute.mockResolvedValue([event]);

    await checkEventNotifications(true, new Map());
    // A relaunch starts with an empty in-memory map.
    await checkEventNotifications(true, new Map());

    expect(mocks.showNotification).toHaveBeenCalledTimes(1);
  });

  test("still reminds when storage is unavailable", async () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    mocks.execute.mockResolvedValueOnce([
      meeting({ meeting_link: "https://zoom.us/j/1" }),
    ]);

    await checkEventNotifications(true, new Map());

    expect(mocks.showNotification).toHaveBeenCalledTimes(1);
    getItem.mockRestore();
    setItem.mockRestore();
  });
});

describe("formatEventTimeRange", () => {
  test("shows a range, or just the start when the end is missing", () => {
    const start = new Date("2026-05-15T12:02:00.000Z");
    const end = new Date("2026-05-15T12:32:00.000Z");
    expect(formatEventTimeRange(start, end)).not.toBe(
      formatEventTimeRange(start, null),
    );
    expect(formatEventTimeRange(start, start)).toBe(
      formatEventTimeRange(start, null),
    );
  });
});
