import { describe, expect, it, vi } from "vitest";

vi.mock("@anlg/plugin-template", () => ({ commands: { render: vi.fn() } }));

import {
  appendMeetingContextToolGuidance,
  timeZoneGuidance,
} from "./use-transport";

// In-app test, Oct 4: a chat answer listed meeting times "in UTC".
describe("chat time zone guidance", () => {
  it("asks for times in the user's time zone, never UTC", () => {
    const prompt = appendMeetingContextToolGuidance(
      "You are Upshot.",
      "America/New_York",
    );
    expect(prompt).toContain(timeZoneGuidance("America/New_York"));
    expect(prompt?.startsWith("You are Upshot.")).toBe(true);
  });

  it("leaves the prompt as it was without a time zone", () => {
    expect(appendMeetingContextToolGuidance("You are Upshot.")).not.toContain(
      "time zone",
    );
    expect(appendMeetingContextToolGuidance(undefined, "UTC")).toBeUndefined();
  });
});
