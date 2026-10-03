import { describe, expect, it, vi } from "vitest";

import { buildSearchCalendarEventsTool } from "./search-calendar-events";
import type { ToolDependencies } from "./types";

const event = (id: string, startedAt: string | null) => ({
  id,
  title: id,
  startedAt,
  endedAt: null,
  location: null,
  meetingLink: null,
  description: null,
  participantCount: 0,
  linkedSessionId: null,
});

describe("search_calendar_events", () => {
  it("returns only upcoming events, soonest first, for 'my next meeting'", async () => {
    const hour = 60 * 60 * 1000;
    const at = (offset: number) => new Date(Date.now() + offset).toISOString();
    const getCalendarEventSearchResults = vi.fn(async () => [
      event("far", at(48 * hour)),
      event("next", at(hour)),
      event("past", at(-hour)),
      event("undated", null),
    ]);
    const tool = buildSearchCalendarEventsTool({
      getCalendarEventSearchResults,
    } as unknown as ToolDependencies);

    const output = (await tool.execute!(
      { query: "", upcoming: true, limit: 1 },
      { toolCallId: "t", messages: [] },
    )) as { results: Array<{ id: string }> };

    expect(output.results.map((result) => result.id)).toEqual(["next"]);
    expect(getCalendarEventSearchResults).toHaveBeenCalledWith("", 500);
  });
});
