import { Trans } from "@lingui/react/macro";
import type { ComponentProps, ComponentType, ReactNode } from "react";

import { Folder, Pencil, Swap } from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";

import { defineTool } from "./define-tool";
import { usePendingApprovalStore } from "./pending-approval-store";
import { ToolCardBody, ToolCardFooterError, ToolCardFooters } from "./shared";

import { parseMcpObjectOutput } from "~/chat/mcp/mcp-output-parser";

type ApprovalToolOutput = {
  status?: string;
  message?: string;
  sourceTitle?: string;
  targetTitle?: string;
  folder_path?: string;
  moved?: number;
  unchanged?: number;
  failed?: number;
};

function parseApprovalToolOutput(output: unknown): ApprovalToolOutput | null {
  return parseMcpObjectOutput<ApprovalToolOutput>(output);
}

// Same layout as EditActions in edit-summary.tsx. Nothing changes until the
// user presses Apply; the tool call waits on this choice.
// Fork: "Discard" plus a specific verb on every approval card
// (ux-audit-oct3 D, NN/g #4, HIG alerts).
function ApprovalActions({
  toolCallId,
  applyLabel,
}: {
  toolCallId: string;
  applyLabel: ReactNode;
}) {
  const approval = usePendingApprovalStore((state) =>
    state.approvals.get(toolCallId),
  );

  if (!approval) {
    return null;
  }

  const resolve = (approved: boolean) =>
    usePendingApprovalStore.getState().resolveApproval(toolCallId, approved);

  return (
    <>
      {approval.details ? (
        <ToolCardBody>
          <p className="text-muted-foreground text-sm">{approval.details}</p>
        </ToolCardBody>
      ) : null}
      <div className="border-border/80 flex justify-end gap-2 border-t px-3.5 py-2.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => resolve(false)}
        >
          <Trans>Discard</Trans>
        </Button>
        <Button type="button" size="sm" onClick={() => resolve(true)}>
          {applyLabel}
        </Button>
      </div>
    </>
  );
}

function ApprovalFooter({
  failed,
  errorText,
  parsed,
  toolCallId,
  applyLabel,
}: {
  failed: boolean;
  errorText: unknown;
  parsed: ApprovalToolOutput | null;
  toolCallId: string;
  applyLabel: ReactNode;
}) {
  const showMessage =
    parsed?.status === "error" || parsed?.status === "not_found";
  return (
    <>
      <ToolCardFooters failed={failed} errorText={errorText} rawText={null}>
        {showMessage ? (
          <ToolCardFooterError
            text={
              parsed?.message ??
              (parsed?.failed
                ? `${parsed.failed} ${parsed.failed === 1 ? "meeting" : "meetings"} could not be moved`
                : "Unknown error")
            }
          />
        ) : null}
      </ToolCardFooters>
      <ApprovalActions toolCallId={toolCallId} applyLabel={applyLabel} />
    </>
  );
}

const SessionCorrectionCard = defineTool({
  icon: <Pencil />,
  parseFn: parseApprovalToolOutput,
  isDone: (parsed) =>
    parsed?.status === "applied" || parsed?.status === "partial",
  label: ({ running, failed, parsed }) => {
    if (running) return "Review correction";
    if (failed || parsed?.status === "error") return "Correction failed";
    if (parsed?.status === "applied") return "Correction applied";
    if (parsed?.status === "partial") return "Correction partly applied";
    if (parsed?.status === "declined") return "Correction dismissed";
    if (parsed?.status === "not_found") return "No matching text found";
    return "Correction";
  },
  renderBody: (input) =>
    input?.oldText && typeof input.newText === "string" ? (
      <ToolCardBody>
        <p className="text-muted-foreground text-sm">
          “{input.oldText}” → “{input.newText}”
        </p>
      </ToolCardBody>
    ) : null,
  renderFooter: (ctx) => (
    <ApprovalFooter {...ctx} applyLabel=<Trans>Apply correction</Trans> />
  ),
});

const MoveMeetingContentsCard = defineTool({
  icon: <Swap />,
  parseFn: parseApprovalToolOutput,
  isDone: (parsed) => parsed?.status === "moved",
  label: ({ running, failed, parsed }) => {
    if (running) return "Review move";
    if (failed || parsed?.status === "error") return "Move failed";
    if (parsed?.status === "moved") return "Meeting contents moved";
    if (parsed?.status === "declined") return "Move dismissed";
    if (parsed?.status === "nothing_to_move") return "Nothing to move";
    return "Move meeting contents";
  },
  renderBody: (_input, parsed) =>
    parsed?.status === "moved" && parsed.sourceTitle && parsed.targetTitle ? (
      <ToolCardBody>
        <p className="text-muted-foreground text-sm">
          From “{parsed.sourceTitle}” to “{parsed.targetTitle}”
        </p>
      </ToolCardBody>
    ) : null,
  renderFooter: (ctx) => (
    <ApprovalFooter {...ctx} applyLabel=<Trans>Move contents</Trans> />
  ),
});

function folderMoveCounts(parsed: ApprovalToolOutput): string {
  return [
    `${parsed.moved ?? 0} moved`,
    parsed.unchanged ? `${parsed.unchanged} already there` : null,
    parsed.failed ? `${parsed.failed} failed` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

const MoveMeetingsToFolderCard = defineTool({
  icon: <Folder />,
  parseFn: parseApprovalToolOutput,
  isDone: (parsed) => parsed?.status === "ok" || parsed?.status === "partial",
  label: ({ running, failed, parsed }) => {
    if (running) return "Review folder move";
    if (failed || parsed?.status === "error") return "Folder move failed";
    if (parsed?.status === "ok") return "Meetings moved";
    if (parsed?.status === "partial") return "Meetings partly moved";
    if (parsed?.status === "declined") return "Folder move dismissed";
    return "Move meetings to folder";
  },
  renderBody: (_input, parsed) =>
    parsed?.status === "ok" || parsed?.status === "partial" ? (
      <ToolCardBody>
        <p className="text-muted-foreground text-sm">
          {folderMoveCounts(parsed)}
        </p>
      </ToolCardBody>
    ) : null,
  renderFooter: (ctx) => (
    <ApprovalFooter {...ctx} applyLabel=<Trans>Move meetings</Trans> />
  ),
});

type ApprovalCardPart = ComponentProps<typeof SessionCorrectionCard>["part"];

// Stop aborts the stream before the tool's "declined" result reaches the
// message, so the part stays input-available. Show it as dismissed instead
// of spinning forever.
function showStopAsDeclined(Card: ComponentType<{ part: ApprovalCardPart }>) {
  return function ApprovalCard({ part }: { part: ApprovalCardPart }) {
    const stopped = usePendingApprovalStore((state) =>
      state.stopped.has(part.toolCallId),
    );
    const pending =
      part.state === "input-streaming" || part.state === "input-available";
    return (
      <Card
        part={
          stopped && pending
            ? {
                ...part,
                state: "output-available",
                output: { status: "declined" },
              }
            : part
        }
      />
    );
  };
}

export const ToolSessionCorrection = showStopAsDeclined(SessionCorrectionCard);
export const ToolMoveMeetingContents = showStopAsDeclined(
  MoveMeetingContentsCard,
);
export const ToolMoveMeetingsToFolder = showStopAsDeclined(
  MoveMeetingsToFolderCard,
);
