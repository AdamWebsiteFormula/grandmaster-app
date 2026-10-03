import { t } from "@lingui/core/macro";

import { CONTEXT_TEXT_FIELD } from "../tools/context-text";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export const MAX_TOOL_STEPS = 5;
export const MESSAGE_WINDOW_THRESHOLD = 20;
export const MESSAGE_WINDOW_SIZE = 10;

export function getMeetingIdsFromSearchOutput(output: unknown): string[] {
  if (!isRecord(output) || !Array.isArray(output.results)) {
    return [];
  }
  return output.results.flatMap((item) => {
    if (
      !isRecord(item) ||
      (typeof item.id !== "string" && typeof item.id !== "number")
    ) {
      return [];
    }
    return [String(item.id)];
  });
}

export type ToolOutputPart = {
  type: `tool-${string}`;
  state: "output-available";
  output?: unknown;
  [key: string]: unknown;
};

export function isToolOutputPart(value: unknown): value is ToolOutputPart {
  return (
    isRecord(value) &&
    typeof value.type === "string" &&
    value.type.startsWith("tool-") &&
    value.state === "output-available"
  );
}

export function hasContextText(output: unknown): boolean {
  if (!isRecord(output)) return false;
  const contextText = output[CONTEXT_TEXT_FIELD];
  return typeof contextText === "string" && contextText.length > 0;
}

// Fork: offline, Tauri plugin-http rejects with a plain string that names the
// Worker URL. Say what happened and how to recover instead (journey-after P1
// "Chat offline"; NN/g #9; Apple HIG Writing: describe the problem and the fix).
const NETWORK_ERROR_PATTERN =
  /error sending request|fetch failed|network|load failed|timed out/i;

export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function describeChatStreamError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  if (isOffline() || NETWORK_ERROR_PATTERN.test(raw)) {
    return t`Upshot AI can't be reached. Check your internet connection, then click Retry.`;
  }
  // Fork: show the message, not "AI_APICallError: …"; the name stays in
  // the console (ux-audit-oct3 D, NN/g #9).
  if (error instanceof Error) {
    console.error(error.name);
    return error.message;
  }
  if (isRecord(error) && typeof error.message === "string") {
    return error.message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
