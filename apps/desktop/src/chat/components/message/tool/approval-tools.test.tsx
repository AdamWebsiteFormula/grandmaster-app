import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ToolMoveMeetingContents,
  ToolMoveMeetingsToFolder,
  ToolSessionCorrection,
} from "./approval-tools";
import {
  usePendingApprovalStore,
  waitForApproval,
} from "./pending-approval-store";

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

const folderPart = {
  type: "tool-move_meetings_to_folder",
  toolCallId: "tool-call-1",
  state: "input-available",
  input: { meeting_ids: ["a", "b", "c"], folder_path: "Projects/Launch" },
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
    usePendingApprovalStore.setState({
      approvals: new Map(),
      stopped: new Set(),
    });
  });

  it("applies a correction only when Apply is pressed", () => {
    const resolve = vi.fn();
    addPending(resolve);

    render(<ToolSessionCorrection part={correctionPart} />);
    expect(screen.getByText("Will change Summary (1 place).")).toBeTruthy();
    expect(resolve).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Apply correction" }));

    expect(resolve).toHaveBeenCalledWith(true);
    expect(usePendingApprovalStore.getState().approvals.size).toBe(0);
  });

  it("dismisses a move without applying it", () => {
    const resolve = vi.fn();
    addPending(resolve);

    render(<ToolMoveMeetingContents part={movePart} />);
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect(resolve).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("button", { name: "Move contents" })).toBeNull();
  });

  it("applies a folder move only when Apply is pressed", () => {
    const resolve = vi.fn();
    usePendingApprovalStore.getState().addApproval({
      requestId: "tool-call-1",
      details: 'Move 3 meetings to "Projects/Launch".',
      resolve,
    });

    render(<ToolMoveMeetingsToFolder part={folderPart} />);
    expect(screen.getByText("Review folder move")).toBeTruthy();
    expect(
      screen.getByText('Move 3 meetings to "Projects/Launch".'),
    ).toBeTruthy();
    expect(resolve).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Move meetings" }));
    expect(resolve).toHaveBeenCalledWith(true);
  });

  it("hides the actions when nothing is waiting for approval", () => {
    render(<ToolSessionCorrection part={correctionPart} />);

    expect(
      screen.queryByRole("button", { name: "Apply correction" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
  });

  it("shows a card dismissed by Stop as declined instead of spinning", async () => {
    const controller = new AbortController();
    const approved = waitForApproval("tool-call-1", {
      abortSignal: controller.signal,
    });

    render(<ToolMoveMeetingsToFolder part={folderPart} />);
    expect(screen.getByText("Review folder move")).toBeTruthy();

    controller.abort();

    await expect(approved).resolves.toBe(false);
    expect(await screen.findByText("Folder move dismissed")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Move meetings" })).toBeNull();
  });
});
