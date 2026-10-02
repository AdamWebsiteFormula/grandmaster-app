import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  moveSessionContents: vi.fn(),
  loadSessionContentSnapshot: vi.fn(),
}));

vi.mock("~/session/move-contents", () => ({
  moveSessionContents: mocks.moveSessionContents,
}));

vi.mock("~/session/content-queries", () => ({
  loadSessionContentSnapshot: mocks.loadSessionContentSnapshot,
}));

import { buildMoveMeetingContentsTool } from "./move-meeting-contents";

import { usePendingApprovalStore } from "~/chat/components/message/tool/pending-approval-store";

const callOptions = { toolCallId: "call-1", messages: [] };

function approvalPending() {
  return usePendingApprovalStore.getState().approvals.get("call-1");
}

describe("move meeting contents chat tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePendingApprovalStore.setState({ approvals: new Map() });
    mocks.loadSessionContentSnapshot.mockImplementation(async (id: string) => ({
      title: id === "source" ? "Standup" : "Board",
    }));
    mocks.moveSessionContents.mockResolvedValue({
      status: "moved",
      sourceMeetingId: "source",
      targetMeetingId: "target",
      sourceTitle: "Standup",
      targetTitle: "Board",
      moved: {
        recording: true,
        transcripts: 1,
        summaries: 1,
        notes: true,
        actionItems: 0,
      },
    });
  });

  it("moves nothing until the user presses Apply", async () => {
    const tool = buildMoveMeetingContentsTool({
      getSessionId: () => "source",
    });

    const pending = (tool as any).execute(
      { targetMeetingId: "target" },
      callOptions,
    );
    await vi.waitFor(() => expect(approvalPending()).toBeDefined());

    expect(mocks.moveSessionContents).not.toHaveBeenCalled();
    expect(approvalPending()?.details).toBe(
      'Move the recording and notes from "Standup" to "Board".',
    );

    usePendingApprovalStore.getState().resolveApproval("call-1", true);

    await expect(pending).resolves.toMatchObject({ status: "moved" });

    expect(mocks.moveSessionContents).toHaveBeenCalledWith({
      sourceSessionId: "source",
      targetSessionId: "target",
    });
  });

  it("moves nothing when the user dismisses the move", async () => {
    const tool = buildMoveMeetingContentsTool({
      getSessionId: () => "source",
    });

    const pending = (tool as any).execute(
      { targetMeetingId: "target" },
      callOptions,
    );
    await vi.waitFor(() => expect(approvalPending()).toBeDefined());
    usePendingApprovalStore.getState().resolveApproval("call-1", false);

    await expect(pending).resolves.toMatchObject({ status: "declined" });
    expect(mocks.moveSessionContents).not.toHaveBeenCalled();
    expect(approvalPending()).toBeUndefined();
  });

  it("moves nothing when the chat is stopped while waiting", async () => {
    const tool = buildMoveMeetingContentsTool({
      getSessionId: () => "source",
    });
    const controller = new AbortController();

    const pending = (tool as any).execute(
      { targetMeetingId: "target" },
      { ...callOptions, abortSignal: controller.signal },
    );
    await vi.waitFor(() => expect(approvalPending()).toBeDefined());
    controller.abort();

    await expect(pending).resolves.toMatchObject({ status: "declined" });
    expect(mocks.moveSessionContents).not.toHaveBeenCalled();
  });

  it("requires an explicit source when no meeting is open", async () => {
    const tool = buildMoveMeetingContentsTool({
      getSessionId: () => undefined,
    });

    await expect(
      (tool as any).execute({ targetMeetingId: "target" }, callOptions),
    ).resolves.toEqual({
      status: "error",
      message:
        "No source meeting selected. Provide sourceMeetingId explicitly when calling move_meeting_contents.",
    });
    expect(mocks.moveSessionContents).not.toHaveBeenCalled();
  });
});
