import { t } from "@lingui/core/macro";

import { Wrench } from "@anlg/ui/components/icons";

import { useToolState } from "./shared";

import { Disclosure } from "~/chat/components/message/shared";
import { extractMcpOutputText } from "~/chat/mcp/mcp-output-parser";
import { CONTEXT_TEXT_FIELD } from "~/chat/tools/context-text";

// Fork: friendly names instead of raw tool ids (ux-audit-oct3 D, NN/g #2).
const TOOL_LABELS: Record<
  string,
  { done: () => string; running: () => string }
> = {
  grep_notes: {
    done: () => t`Searched notes`,
    running: () => t`Searching notes…`,
  },
  search_meeting_content: {
    done: () => t`Searched notes`,
    running: () => t`Searching notes…`,
  },
  read_folder_material: {
    done: () => t`Read folder files`,
    running: () => t`Reading folder files…`,
  },
  get_meeting_transcript: {
    done: () => t`Read the transcript`,
    running: () => t`Reading the transcript…`,
  },
  get_meeting: {
    done: () => t`Read the note`,
    running: () => t`Reading the note…`,
  },
  list_meetings: {
    done: () => t`Listed meetings`,
    running: () => t`Listing meetings…`,
  },
  get_recurring_meeting_history: {
    done: () => t`Read past meetings in the series`,
    running: () => t`Reading past meetings in the series…`,
  },
  find_related_meetings: {
    done: () => t`Found related meetings`,
    running: () => t`Finding related meetings…`,
  },
  search_contacts: {
    done: () => t`Searched contacts`,
    running: () => t`Searching contacts…`,
  },
  search_calendar_events: {
    done: () => t`Checked the calendar`,
    running: () => t`Checking the calendar…`,
  },
  list_folders: {
    done: () => t`Listed folders`,
    running: () => t`Listing folders…`,
  },
  create_folder: {
    done: () => t`Created a folder`,
    running: () => t`Creating a folder…`,
  },
  web_search: {
    done: () => t`Searched the web`,
    running: () => t`Searching the web…`,
  },
};

function formatToolName(name: string): string {
  return name.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function doneLabel(name: string): string {
  return TOOL_LABELS[name]?.done() ?? formatToolName(name);
}

function runningLabel(name: string): string {
  return TOOL_LABELS[name]?.running() ?? t`Running ${formatToolName(name)}…`;
}

function formatOutputText(output: unknown): string | null {
  const mcpText = extractMcpOutputText(output);
  if (mcpText) {
    return mcpText;
  }

  if (typeof output === "string") {
    return output;
  }

  if (output === null || output === undefined) {
    return null;
  }

  try {
    if (
      typeof output === "object" &&
      output !== null &&
      CONTEXT_TEXT_FIELD in output
    ) {
      const { [CONTEXT_TEXT_FIELD]: _contextText, ...rest } = output as Record<
        string,
        unknown
      >;
      return JSON.stringify(rest, null, 2);
    }

    return JSON.stringify(output, null, 2);
  } catch {
    return String(output);
  }
}

export function ToolGeneric({ part }: { part: Record<string, unknown> }) {
  const toolName = String(
    part.toolName ??
      (typeof part.type === "string" ? part.type.replace("tool-", "") : "tool"),
  );
  const { failed } = useToolState(part as { state: string });
  const done = (part.state as string) === "output-available";

  if (done || failed) {
    const outputText = done ? formatOutputText(part.output) : null;

    return (
      <Disclosure
        icon={<Wrench className="h-3 w-3" />}
        title={
          failed ? t`${formatToolName(toolName)} failed` : doneLabel(toolName)
        }
      >
        <div className="flex flex-col gap-2">
          <InputDisplay input={part.input} />
          {failed ? (
            <p className="text-destructive text-xs">
              {String(part.errorText ?? "Unknown error")}
            </p>
          ) : null}
          {outputText ? (
            <p className="text-muted-foreground text-xs whitespace-pre-wrap">
              {outputText}
            </p>
          ) : null}
        </div>
      </Disclosure>
    );
  }

  return (
    <Disclosure
      icon={<Wrench className="h-3 w-3" />}
      title={runningLabel(toolName)}
      disabled
    >
      {null}
    </Disclosure>
  );
}

function InputDisplay({ input }: { input: unknown }) {
  if (!input || typeof input !== "object") return null;
  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length === 0) return null;

  return (
    <dl className="text-muted-foreground flex flex-col gap-1 text-xs">
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt className="text-muted-foreground inline font-medium">{key}: </dt>
          <dd className="inline wrap-break-word whitespace-pre-wrap">
            {typeof value === "string" ? value : JSON.stringify(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
