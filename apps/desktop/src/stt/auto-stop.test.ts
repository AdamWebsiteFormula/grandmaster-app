import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  AUTO_STOP_NETWORK_HOLD_MS,
  AUTO_STOP_RECENT_OFFLINE_MS,
  isRecentNetworkDrop,
  resolveNetworkHoldUntilMs,
  showMeetingEndedPrompt,
} from "./auto-stop";
import { cancelAutoStopEndedNotification } from "./auto-stop-notification";

const { getNotificationIconForAppMock, showNotificationMock } = vi.hoisted(
  () => ({
    getNotificationIconForAppMock: vi.fn(),
    showNotificationMock: vi.fn(),
  }),
);

vi.mock("@anlg/plugin-notification", () => ({
  commands: {
    showNotification: showNotificationMock,
  },
}));

vi.mock("./meeting-apps", async (importOriginal) => ({
  ...(await importOriginal()),
  getNotificationIconForApp: getNotificationIconForAppMock,
}));

beforeEach(() => {
  cancelAutoStopEndedNotification("session-1");
  getNotificationIconForAppMock.mockReset();
  showNotificationMock.mockReset();
});

describe("resolveNetworkHoldUntilMs", () => {
  test.each([
    {
      name: "keeps a future calendar deadline",
      calendarDeadlineMs: 2_000,
      expected: 2_000,
    },
    {
      name: "falls back to the default hold when no calendar deadline exists",
      calendarDeadlineMs: null,
      expected: 1_000 + AUTO_STOP_NETWORK_HOLD_MS,
    },
    {
      name: "falls back to the default hold when the calendar deadline has passed",
      calendarDeadlineMs: 500,
      expected: 1_000 + AUTO_STOP_NETWORK_HOLD_MS,
    },
  ])("$name", ({ calendarDeadlineMs, expected }) => {
    expect(
      resolveNetworkHoldUntilMs({ calendarDeadlineMs, nowMs: 1_000 }),
    ).toBe(expected);
  });
});

describe("isRecentNetworkDrop", () => {
  test.each([
    {
      name: "is true inside the recent-reconnect window",
      reconnectMs: 1_000,
      nowMs: 1_000 + AUTO_STOP_RECENT_OFFLINE_MS,
      expected: true,
    },
    {
      name: "is false after the recent-reconnect window",
      reconnectMs: 1_000,
      nowMs: 1_000 + AUTO_STOP_RECENT_OFFLINE_MS + 1,
      expected: false,
    },
    {
      name: "is false when no reconnect was recorded",
      reconnectMs: null,
      nowMs: 1_000,
      expected: false,
    },
  ])("$name", ({ reconnectMs, nowMs, expected }) => {
    expect(isRecentNetworkDrop(reconnectMs, nowMs)).toBe(expected);
  });
});

describe("showMeetingEndedPrompt", () => {
  test("does not show a prompt when recording notifications are disabled", async () => {
    await showMeetingEndedPrompt({
      sessionId: "session-1",
      stoppedTriggerAppIds: ["com.google.Chrome"],
      stoppedApps: [{ id: "com.google.Chrome", name: "Google Chrome" }],
      notificationEnabled: false,
    });

    expect(getNotificationIconForAppMock).not.toHaveBeenCalled();
    expect(showNotificationMock).not.toHaveBeenCalled();
  });

  test("shows the Upshot logo, not the meeting app's icon", async () => {
    await showMeetingEndedPrompt({
      sessionId: "session-1",
      stoppedTriggerAppIds: ["com.google.Chrome"],
      stoppedApps: [{ id: "com.google.Chrome", name: "Google Chrome" }],
    });

    expect(getNotificationIconForAppMock).not.toHaveBeenCalled();
    expect(showNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Did your meeting end?", icon: null }),
    );
  });
});
