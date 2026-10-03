import { tool } from "ai";
import { z } from "zod";

import { resolveCurrentSessionId } from "./current-session";
import type { ToolDependencies } from "./types";

import { waitForApproval } from "~/chat/components/message/tool/pending-approval-store";
import { loadReadableSessionContentSnapshot } from "~/session/content-queries";
import { moveSessionContents } from "~/session/move-contents";

async function describeMove(
  sourceMeetingId: string,
  targetMeetingId: string,
): Promise<string | undefined> {
  try {
    const [source, target] = await Promise.all([
      loadReadableSessionContentSnapshot(sourceMeetingId),
      loadReadableSessionContentSnapshot(targetMeetingId),
    ]);
    if (!source || !target) {
      return undefined;
    }
    const sourceTitle = source.title.trim() || "Untitled";
    const targetTitle = target.title.trim() || "Untitled";
    return `Move the recording and notes from "${sourceTitle}" to "${targetTitle}".`;
  } catch {
    return undefined;
  }
}

export const buildMoveMeetingContentsTool = (
  deps: Pick<ToolDependencies, "getSessionId">,
) =>
  tool({
    description:
      "Propose moving a finished recording, transcript, generated summaries, notes, and action items from one meeting onto another existing meeting. Nothing moves until the user presses Apply on the card; a declined status means the user dismissed it. Use this when the user says a recording or notes landed on the wrong meeting. Resolve both meeting IDs with list_meetings or search_meetings first and never guess IDs. The target meeting must not already have a recording or transcript.",
    inputSchema: z.object({
      sourceMeetingId: z
        .string()
        .optional()
        .describe(
          "Meeting that currently has the recording or notes. Defaults to the current note (the one marked as current in context).",
        ),
      targetMeetingId: z
        .string()
        .describe(
          "Existing meeting that should receive the recording and notes.",
        ),
    }),
    execute: async (
      params: {
        sourceMeetingId?: string;
        targetMeetingId: string;
      },
      options,
    ) => {
      const sourceMeetingId =
        params.sourceMeetingId ?? resolveCurrentSessionId(deps, options);
      const targetMeetingId = params.targetMeetingId;

      if (!sourceMeetingId) {
        return {
          status: "error",
          message:
            "No source meeting selected. Provide sourceMeetingId explicitly when calling move_meeting_contents.",
        };
      }

      const approved = await waitForApproval(options.toolCallId, {
        details: await describeMove(sourceMeetingId, targetMeetingId),
        abortSignal: options.abortSignal,
      });
      if (!approved) {
        return {
          status: "declined",
          message: "The user dismissed the move. Nothing was changed.",
          sourceMeetingId,
          targetMeetingId,
        };
      }

      return moveSessionContents({
        sourceSessionId: sourceMeetingId,
        targetSessionId: targetMeetingId,
      });
    },
  });
