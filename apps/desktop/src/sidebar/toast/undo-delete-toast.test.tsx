import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  message: vi.fn(),
  error: vi.fn(),
  dismiss: vi.fn(),
  openCurrent: vi.fn(),
  restoreDeletedSession: vi.fn(),
}));

vi.mock("@anlg/ui/components/ui/toast", () => ({
  toast: {
    message: mocks.message,
    error: mocks.error,
    dismiss: mocks.dismiss,
  },
}));

vi.mock("~/session/queries", () => ({
  restoreDeletedSession: mocks.restoreDeletedSession,
}));

vi.mock("~/store/zustand/tabs", () => ({
  useTabs: (selector: (state: { openCurrent: () => void }) => unknown) =>
    selector({ openCurrent: mocks.openCurrent }),
}));

import { UndoDeleteGauge, UndoDeleteToast } from "./undo-delete-toast";

import { UNDO_TIMEOUT_MS, useUndoDelete } from "~/store/zustand/undo-delete";

describe("UndoDeleteToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useUndoDelete.setState({ pendingDeletions: {} });
    mocks.message.mockClear();
    mocks.error.mockClear();
    mocks.dismiss.mockClear();
    mocks.openCurrent.mockClear();
    mocks.restoreDeletedSession.mockClear();
  });

  afterEach(() => {
    for (const pending of Object.values(
      useUndoDelete.getState().pendingDeletions,
    )) {
      if (pending.timeoutId) clearTimeout(pending.timeoutId);
    }
    useUndoDelete.setState({ pendingDeletions: {} });
    cleanup();
    vi.useRealTimers();
  });

  it("renders undo deletion through the shared toaster", () => {
    act(() => {
      useUndoDelete.getState().addDeletion({
        session: { id: "session-1", title: "Design sync" },
        tombstone: "tombstone",
        deletedAt: Date.now(),
      });
    });

    const queryClient = new QueryClient();
    const view = render(
      <QueryClientProvider client={queryClient}>
        <UndoDeleteToast />
      </QueryClientProvider>,
    );

    expect(mocks.message).toHaveBeenCalledWith(
      "Design sync deleted",
      expect.objectContaining({
        id: "undo-delete:session-1",
        duration: Infinity,
        closeButton: false,
        dismissible: false,
        action: expect.objectContaining({ label: "Undo" }),
      }),
    );
    view.unmount();
    expect(mocks.dismiss).toHaveBeenCalledWith("undo-delete:session-1");
  });

  // Fork: journey-after P2 "Delete note / undo".
  it("keeps the note restorable for 10 seconds", () => {
    const onConfirm = vi.fn();
    expect(UNDO_TIMEOUT_MS).toBe(10000);
    act(() => {
      useUndoDelete.getState().addDeletion(
        {
          session: { id: "session-1", title: "Design sync" },
          tombstone: "tombstone",
          deletedAt: Date.now(),
        },
        onConfirm,
      );
    });
    act(() => vi.advanceTimersByTime(9_000));
    expect(onConfirm).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1_000));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("pauses the countdown while the toast is hovered or focused", () => {
    const onConfirm = vi.fn();
    act(() => {
      useUndoDelete.getState().addDeletion(
        {
          session: { id: "session-1", title: "Design sync" },
          tombstone: "tombstone",
          deletedAt: Date.now(),
        },
        onConfirm,
      );
    });
    const view = render(
      <div data-sonner-toast="" data-testid="toast">
        <UndoDeleteGauge
          sessionIds={["session-1"]}
          remainingDuration={UNDO_TIMEOUT_MS}
          progress={1}
        />
        <button type="button">Undo</button>
      </div>,
    );
    const toastElement = view.getByTestId("toast");
    const gauge = toastElement.querySelector("span")!;

    act(() => vi.advanceTimersByTime(8_000));
    fireEvent.mouseEnter(toastElement);
    expect(gauge.style.animationPlayState).toBe("paused");
    act(() => vi.advanceTimersByTime(60_000));
    expect(onConfirm).not.toHaveBeenCalled();

    // Focus inside keeps it paused after the pointer leaves.
    fireEvent.focusIn(view.getByRole("button", { name: "Undo" }));
    fireEvent.mouseLeave(toastElement);
    act(() => vi.advanceTimersByTime(60_000));
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.focusOut(view.getByRole("button", { name: "Undo" }));
    expect(gauge.style.animationPlayState).toBe("running");
    act(() => vi.advanceTimersByTime(1_999));
    expect(onConfirm).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("dismisses the toast and reopens the tab before the restore resolves", () => {
    // Never resolves: undo feedback must not wait for the restore write.
    mocks.restoreDeletedSession.mockImplementationOnce(
      () => new Promise(() => {}),
    );

    act(() => {
      useUndoDelete.getState().addDeletion({
        session: { id: "session-1", title: "Design sync" },
        tombstone: "tombstone",
        deletedAt: Date.now(),
      });
    });

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <UndoDeleteToast />
      </QueryClientProvider>,
    );

    const options =
      mocks.message.mock.calls[mocks.message.mock.calls.length - 1][1];
    act(() => {
      options.action.onClick();
    });

    expect(mocks.restoreDeletedSession).toHaveBeenCalledOnce();
    expect(mocks.openCurrent).toHaveBeenCalledWith({
      type: "sessions",
      id: "session-1",
    });
    expect(useUndoDelete.getState().pendingDeletions).toEqual({});
  });

  it("updates a batch toast when later deletions join the batch", async () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <UndoDeleteToast />
      </QueryClientProvider>,
    );

    act(() => {
      useUndoDelete.getState().addDeletion(
        {
          session: { id: "session-1", title: "Design sync" },
          tombstone: "tombstone-1",
          deletedAt: Date.now(),
        },
        undefined,
        "batch-1",
      );
    });

    expect(mocks.message).toHaveBeenLastCalledWith(
      "1 note deleted",
      expect.objectContaining({ id: "undo-delete:batch-1" }),
    );

    act(() => {
      useUndoDelete.getState().addDeletion(
        {
          session: { id: "session-2", title: "Weekly review" },
          tombstone: "tombstone-2",
          deletedAt: Date.now(),
        },
        undefined,
        "batch-1",
      );
    });

    expect(mocks.message).toHaveBeenLastCalledWith(
      "2 notes deleted",
      expect.objectContaining({ id: "undo-delete:batch-1" }),
    );

    const options =
      mocks.message.mock.calls[mocks.message.mock.calls.length - 1][1];
    await act(async () => {
      options.action.onClick();
      await Promise.resolve();
    });

    expect(mocks.restoreDeletedSession).toHaveBeenCalledTimes(2);
    expect(mocks.restoreDeletedSession).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        session: expect.objectContaining({ id: "session-1" }),
      }),
    );
    expect(mocks.restoreDeletedSession).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        session: expect.objectContaining({ id: "session-2" }),
      }),
    );
  });

  it("restores the latest deleted note with Cmd+Z outside text fields", () => {
    mocks.restoreDeletedSession.mockImplementation(() => new Promise(() => {}));
    act(() => {
      useUndoDelete.getState().addDeletion({
        session: { id: "session-1", title: "Design sync" },
        tombstone: "tombstone",
        deletedAt: Date.now(),
      });
    });

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <input aria-label="Title" />
        <UndoDeleteToast />
      </QueryClientProvider>,
    );

    // Text fields keep their own undo.
    const input = document.querySelector("input")!;
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "z",
          metaKey: true,
          bubbles: true,
        }),
      );
    });
    expect(mocks.restoreDeletedSession).not.toHaveBeenCalled();

    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "z",
          metaKey: true,
          bubbles: true,
        }),
      );
    });
    expect(mocks.restoreDeletedSession).toHaveBeenCalledOnce();
    expect(mocks.openCurrent).toHaveBeenCalledWith({
      type: "sessions",
      id: "session-1",
    });
    expect(useUndoDelete.getState().pendingDeletions).toEqual({});
  });
});
