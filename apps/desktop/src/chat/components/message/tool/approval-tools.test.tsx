import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ToolMoveMeetingContents,
  ToolSessionCorrection,
} from "./approval-tools";
import { usePendingApprovalStore } from "./pending-approval-store";

const correctionPart = {
  type: "tool-apply_session_correction",
  toolCallId: "tool-call-1",
  state: "input-available",
  input: { oldText: "approved", newText: "rejected" },
} as const;

const movePart = {
  type: "tool-move_meeting_contents",
  toolCallId: "tool-call-1",
  state: "input-available",
  input: { targetMeetingId: "target" },
} as const;

function addPending(resolve: (approved: boolean) => void) {
  usePendingApprovalStore.getState().addApproval({
    requestId: "tool-call-1",
    details: "Will change Summary (1 place).",
    resolve,
  });
}

describe("approval tool cards", () => {
  beforeEach(() => {
    cleanup();
    usePendingApprovalStore.setState({ approvals: new Map() });
  });

  it("applies a correction only when Apply is pressed", () => {
    const resolve = vi.fn();
    addPending(resolve);

    render(<ToolSessionCorrection part={correctionPart} />);
    expect(screen.getByText("Will change Summary (1 place).")).toBeTruthy();
    expect(resolve).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(resolve).toHaveBeenCalledWith(true);
    expect(usePendingApprovalStore.getState().approvals.size).toBe(0);
  });

  it("dismisses a move without applying it", () => {
    const resolve = vi.fn();
    addPending(resolve);

    render(<ToolMoveMeetingContents part={movePart} />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(resolve).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
  });

  it("hides the actions when nothing is waiting for approval", () => {
    render(<ToolSessionCorrection part={correctionPart} />);

    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
  });
});
