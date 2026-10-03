import { tool } from "ai";
import { z } from "zod";

import type { ToolDependencies } from "./types";

// Fork: the query returns events newest first, so "my next meeting" could miss
// the soonest one behind later events. `upcoming` keeps only events that have
// not started, soonest first (ux-audit-oct3 D P1 starter prompts).
const UPCOMING_SCAN_LIMIT = 500;

export const buildSearchCalendarEventsTool = (deps: ToolDependencies) =>
  tool({
    description:
      "Search calendar events and return schedule, location, and linked session info. Set upcoming to true for future events only, soonest first (for example the user's next meeting).",
    inputSchema: z.object({
      query: z.string().describe("Search query for calendar events"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .describe("Maximum number of events to return"),
      upcoming: z
        .boolean()
        .optional()
        .describe(
          "Only return events that have not started yet, soonest first. Use an empty query with this to find the next meeting.",
        ),
    }),
    execute: async (params: {
      query: string;
      limit?: number;
      upcoming?: boolean;
    }) => {
      const limit = params.limit ?? 8;
      if (!params.upcoming) {
        const results = await deps.getCalendarEventSearchResults(
          params.query,
          limit,
        );
        return { query: params.query, results };
      }

      const now = Date.now();
      const results = (
        await deps.getCalendarEventSearchResults(
          params.query,
          UPCOMING_SCAN_LIMIT,
        )
      )
        .map((event) => ({
          event,
          start: event.startedAt ? Date.parse(event.startedAt) : NaN,
        }))
        .filter(({ start }) => Number.isFinite(start) && start >= now)
        .sort((a, b) => a.start - b.start)
        .slice(0, limit)
        .map(({ event }) => event);

      return {
        query: params.query,
        results,
      };
    },
  });
