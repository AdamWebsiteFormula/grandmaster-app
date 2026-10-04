import { Trans } from "@lingui/react/macro";

import { Pencil } from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";

import { defineTool } from "./define-tool";
import {
  MarkdownPreview,
  ToolCardBody,
  ToolCardFooterError,
  ToolCardFooters,
} from "./shared";

import { parseMcpObjectOutput } from "~/chat/mcp/mcp-output-parser";
import { usePendingEditStore } from "~/chat/tools/pending-edit-store";
import {
  applyProposalReview,
  declineProposalReview,
} from "~/session/proposal-review";

type EditSummaryOutput = {
  status?: string;
  message?: string;
  candidates?: Array<{
    enhancedNoteId: string;
    title: string;
    templateId?: string;
    position?: number;
  }>;
};

function parseEditSummaryOutput(output: unknown): EditSummaryOutput | null {
  return parseMcpObjectOutput<EditSummaryOutput>(output);
}

function EditActions({
  toolCallId,
  target,
}: {
  toolCallId: string;
  target: "memo" | "summary";
}) {
  const editPending = usePendingEditStore((state) =>
    state.edits.has(toolCallId),
  );

  if (!editPending) {
    return null;
  }

  return (
    <div className="border-border/80 flex justify-end gap-2 border-t px-3.5 py-2.5">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => void declineProposalReview(toolCallId)}
      >
        {/* Fork: same "Discard" as the other approval cards (ux-audit-oct3 D). */}
        <Trans>Discard</Trans>
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={() => void applyProposalReview(toolCallId)}
      >
        {/* Fork: the tab is "My notes", not "memo" (NN/g #4). */}
        {target === "summary" ? (
          <Trans>Apply to summary</Trans>
        ) : (
          <Trans>Apply to my notes</Trans>
        )}
      </Button>
    </div>
  );
}

export const ToolEditSummary = defineTool({
  icon: <Pencil />,
  parseFn: parseEditSummaryOutput,
  isDone: (parsed) => parsed?.status === "applied",
  label: ({ running, failed, parsed }) => {
    if (running) return "Edit summary — review tab opened";
    if (failed) return "Summary edit failed";
    if (parsed?.status === "applied") return "Summary updated";
    // Fork: the button says Discard, so the result does too (NN/g #4).
    if (parsed?.status === "declined") return "Summary edit discarded";
    return "Edit summary";
  },
  renderBody: (input) =>
    input?.content ? (
      <ToolCardBody>
        <MarkdownPreview>{input.content}</MarkdownPreview>
      </ToolCardBody>
    ) : null,
  renderFooter: ({ failed, errorText, parsed, toolCallId }) => (
    <>
      <ToolCardFooters failed={failed} errorText={errorText} rawText={null}>
        {parsed?.status === "error" ? (
          <div className="space-y-2">
            <ToolCardFooterError text={parsed.message ?? "Unknown error"} />
            {parsed.candidates && parsed.candidates.length > 0 ? (
              <div className="border-border bg-muted text-muted-foreground space-y-1 rounded-md border p-2 text-[12px]">
                {parsed.candidates.map((candidate) => (
                  <div key={candidate.enhancedNoteId}>
                    {candidate.title} ({candidate.enhancedNoteId})
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </ToolCardFooters>
      <EditActions toolCallId={toolCallId} target="summary" />
    </>
  ),
});

export const ToolEditMemo = defineTool({
  icon: <Pencil />,
  parseFn: parseEditSummaryOutput,
  isDone: (parsed) => parsed?.status === "applied",
  // Fork: "My notes", the tab's name, not "memo" (NN/g #4).
  label: ({ running, failed, parsed }) => {
    if (running) return "Edit my notes — review tab opened";
    if (failed) return "My notes edit failed";
    if (parsed?.status === "applied") return "My notes updated";
    if (parsed?.status === "declined") return "My notes edit discarded";
    return "Edit my notes";
  },
  renderBody: (input) =>
    input?.content ? (
      <ToolCardBody>
        <MarkdownPreview>{input.content}</MarkdownPreview>
      </ToolCardBody>
    ) : null,
  renderFooter: ({ failed, errorText, parsed, toolCallId }) => (
    <>
      <ToolCardFooters failed={failed} errorText={errorText} rawText={null}>
        {parsed?.status === "error" ? (
          <ToolCardFooterError text={parsed.message ?? "Unknown error"} />
        ) : null}
      </ToolCardFooters>
      <EditActions toolCallId={toolCallId} target="memo" />
    </>
  ),
});
