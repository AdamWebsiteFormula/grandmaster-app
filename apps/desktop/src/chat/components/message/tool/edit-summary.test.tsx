import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const tabState = vi.hoisted(() => ({
  close: vi.fn(),
  tabs: [] as Array<Record<string, unknown>>,
}));
const reviewMocks = vi.hoisted(() => ({
  applyProposalReview: vi.fn(() => Promise.resolve()),
  declineProposalReview: vi.fn(() => Promise.resolve()),
}));

vi.mock("streamdown", () => ({
  Streamdown: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("~/store/zustand/tabs", () => ({
  useTabs: {
    getState: () => tabState,
  },
}));

const toastMocks = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("@anlg/ui/components/ui/toast", () => ({
  toast: { error: toastMocks.error },
}));

vi.mock("~/session/proposal-review", () => ({
  applyProposalReview: reviewMocks.applyProposalReview,
  declineProposalReview: reviewMocks.declineProposalReview,
}));

import { ToolEditMemo, ToolEditSummary } from "./edit-summary";

import { usePendingEditStore } from "~/chat/tools/pending-edit-store";

const part = {
  type: "tool-edit_summary",
  toolCallId: "tool-call-1",
  state: "input-available",
  input: { content: "Updated summary" },
} as const;

const memoPart = {
  type: "tool-edit_memo",
  toolCallId: "tool-call-1",
  state: "input-available",
  input: { content: "## Agenda" },
} as const;

describe("ToolEditSummary", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    usePendingEditStore.setState({ edits: new Map() });
    tabState.tabs = [
      {
        active: true,
        pinned: false,
        requestId: "tool-call-1",
        slotId: "review-slot",
        type: "edit",
      },
    ];
  });

  it("applies a reviewed summary edit from the chat card", () => {
    usePendingEditStore.getState().addEdit({
      requestId: "tool-call-1",
      sessionId: "session-1",
      target: { kind: "summary", enhancedNoteId: "summary-1" },
      currentContent: "Current summary",
      proposedContent: "Updated summary",
      source: "chat",
      resolve: vi.fn(),
    });

    render(<ToolEditSummary part={part} />);
    fireEvent.click(screen.getByRole("button", { name: "Apply to summary" }));

    expect(reviewMocks.applyProposalReview).toHaveBeenCalledWith("tool-call-1");
  });

  it("declines a reviewed summary edit from the chat card", () => {
    usePendingEditStore.getState().addEdit({
      requestId: "tool-call-1",
      sessionId: "session-1",
      target: { kind: "summary", enhancedNoteId: "summary-1" },
      currentContent: "Current summary",
      proposedContent: "Updated summary",
      source: "chat",
      resolve: vi.fn(),
    });

    render(<ToolEditSummary part={part} />);
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect(reviewMocks.declineProposalReview).toHaveBeenCalledWith(
      "tool-call-1",
    );
  });

  it("says so when applying from the chat card fails", async () => {
    reviewMocks.applyProposalReview.mockRejectedValueOnce(new Error("offline"));
    usePendingEditStore.getState().addEdit({
      requestId: "tool-call-1",
      sessionId: "session-1",
      target: { kind: "summary", enhancedNoteId: "summary-1" },
      currentContent: "Current summary",
      proposedContent: "Updated summary",
      source: "chat",
      resolve: vi.fn(),
    });

    render(<ToolEditSummary part={part} />);
    fireEvent.click(screen.getByRole("button", { name: "Apply to summary" }));

    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith(
        "Couldn't apply this edit. Try again.",
      ),
    );
    expect(
      screen
        .getByRole("button", { name: "Apply to summary" })
        .hasAttribute("disabled"),
    ).toBe(false);
  });

  it("hides review actions when the edit is no longer pending", () => {
    render(<ToolEditSummary part={part} />);

    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Apply to summary" }),
    ).toBeNull();
  });

  // Fork: the card says "my notes", the tab's name (NN/g #4).
  it("applies a reviewed My notes edit from the chat card", () => {
    usePendingEditStore.getState().addEdit({
      requestId: "tool-call-1",
      sessionId: "session-1",
      target: { kind: "memo" },
      currentContent: "",
      proposedContent: "## Agenda",
      source: "chat",
      resolve: vi.fn(),
    });

    render(<ToolEditMemo part={memoPart} />);
    fireEvent.click(screen.getByRole("button", { name: "Apply to my notes" }));

    expect(reviewMocks.applyProposalReview).toHaveBeenCalledWith("tool-call-1");
  });
});
