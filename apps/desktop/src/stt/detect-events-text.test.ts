import { describe, expect, it, vi } from "vitest";

vi.mock("@anlg/plugin-detect", () => ({ commands: {}, events: {} }));
vi.mock("@anlg/plugin-notification", () => ({ commands: {} }));
vi.mock("~/calendar/queries", () => ({ getNearbyCalendarEvents: vi.fn() }));
vi.mock("~/shared/config", () => ({ useConfigValue: vi.fn() }));

import {
  getMicDetectedNotificationMessage,
  getMicDetectedNotificationTitle,
} from "./detect-events";

// Journey-first-run P3: Granola's "Meeting detected" / "Call detected" /
// "Huddle detected", with the app named in the body.
describe("mic-detected prompt text", () => {
  it("names the kind of call from the app when no event is nearby", () => {
    expect(getMicDetectedNotificationTitle(null, "Zoom")).toBe(
      "Meeting detected",
    );
    expect(getMicDetectedNotificationTitle(null, "FaceTime")).toBe(
      "Call detected",
    );
    expect(getMicDetectedNotificationTitle(null, "WhatsApp")).toBe(
      "Call detected",
    );
    expect(getMicDetectedNotificationTitle(null, "Slack")).toBe(
      "Huddle detected",
    );
    expect(getMicDetectedNotificationTitle(null, null)).toBe(
      "Meeting detected",
    );
  });

  it("keeps the event-based question when a calendar event is nearby", () => {
    expect(
      getMicDetectedNotificationTitle(
        {
          id: "e1",
          title: "Weekly sync",
          participantNames: ["Dana"],
        } as never,
        "Zoom",
      ),
    ).toBe("Are you talking to Dana right now?");
  });

  it("says which app is using the microphone", () => {
    expect(getMicDetectedNotificationMessage("Zoom")).toBe(
      "Zoom is using your microphone",
    );
    expect(getMicDetectedNotificationMessage(null)).toBe("");
  });
});
