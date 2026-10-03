import { create } from "zustand";

type DeletedSession = {
  id: string;
  title: string;
};

export type DeletedSessionData = {
  session: DeletedSession;
  tombstone: string;
  deletedAt: number;
};

// Fork: 10 seconds (Granola's undo lasts about 10 s), and the timer pauses
// while the toast is hovered or focused (journey-after P2 "Delete note /
// undo"; WCAG 2.2 SC 2.2.1 Timing Adjustable; NN/g #3 user control).
export const UNDO_TIMEOUT_MS = 10000;

type PendingDeletion = {
  data: DeletedSessionData;
  timeoutId: ReturnType<typeof setTimeout> | null;
  onDeleteConfirm: (() => void | Promise<unknown>) | null;
  addedAt: number;
  batchId: string | null;
  /** When the deletion becomes final while the timer runs. */
  deadline?: number;
  /** Time left while paused; null while the timer runs. */
  pausedRemainingMs?: number | null;
};

interface UndoDeleteState {
  pendingDeletions: Record<string, PendingDeletion>;
  addDeletion: (
    data: DeletedSessionData,
    onConfirm?: () => void | Promise<unknown>,
    batchId?: string,
  ) => void;
  clearDeletion: (sessionId: string) => void;
  confirmDeletion: (sessionId: string) => void | Promise<unknown>;
  clearBatch: (batchId: string) => void;
  confirmBatch: (batchId: string) => void;
  pauseDeletions: (sessionIds: string[]) => void;
  resumeDeletions: (sessionIds: string[]) => void;
}

export const useUndoDelete = create<UndoDeleteState>((set, get) => ({
  pendingDeletions: {},

  addDeletion: (data, onConfirm, batchId) => {
    const sessionId = data.session.id;

    const existing = get().pendingDeletions[sessionId];
    if (existing?.timeoutId) {
      clearTimeout(existing.timeoutId);
    }

    const timeoutId = setTimeout(() => {
      get().confirmDeletion(sessionId);
    }, UNDO_TIMEOUT_MS);

    set((state) => ({
      pendingDeletions: {
        ...state.pendingDeletions,
        [sessionId]: {
          data,
          timeoutId,
          onDeleteConfirm: onConfirm ?? null,
          addedAt: Date.now(),
          batchId: batchId ?? null,
          deadline: Date.now() + UNDO_TIMEOUT_MS,
          pausedRemainingMs: null,
        },
      },
    }));
  },

  pauseDeletions: (sessionIds) => {
    const now = Date.now();
    set((state) => {
      const next = { ...state.pendingDeletions };
      for (const sessionId of sessionIds) {
        const pending = next[sessionId];
        if (!pending || pending.pausedRemainingMs != null) continue;
        if (pending.timeoutId) clearTimeout(pending.timeoutId);
        next[sessionId] = {
          ...pending,
          timeoutId: null,
          pausedRemainingMs: Math.max(
            0,
            (pending.deadline ?? pending.addedAt + UNDO_TIMEOUT_MS) - now,
          ),
        };
      }
      return { pendingDeletions: next };
    });
  },

  resumeDeletions: (sessionIds) => {
    const now = Date.now();
    set((state) => {
      const next = { ...state.pendingDeletions };
      for (const sessionId of sessionIds) {
        const pending = next[sessionId];
        if (!pending || pending.pausedRemainingMs == null) continue;
        const remaining = pending.pausedRemainingMs;
        next[sessionId] = {
          ...pending,
          timeoutId: setTimeout(() => {
            get().confirmDeletion(sessionId);
          }, remaining),
          deadline: now + remaining,
          pausedRemainingMs: null,
        };
      }
      return { pendingDeletions: next };
    });
  },

  clearDeletion: (sessionId) => {
    const pending = get().pendingDeletions[sessionId];
    if (!pending) return;

    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }

    set((state) => {
      const { [sessionId]: _, ...rest } = state.pendingDeletions;
      return { pendingDeletions: rest };
    });
  },

  confirmDeletion: (sessionId) => {
    const pending = get().pendingDeletions[sessionId];
    if (!pending) return;

    const result = pending.onDeleteConfirm?.();
    get().clearDeletion(sessionId);
    return result;
  },

  clearBatch: (batchId) => {
    const entries = Object.entries(get().pendingDeletions).filter(
      ([_, p]) => p.batchId === batchId,
    );
    for (const [sessionId] of entries) {
      get().clearDeletion(sessionId);
    }
  },

  confirmBatch: (batchId) => {
    const entries = Object.entries(get().pendingDeletions).filter(
      ([_, p]) => p.batchId === batchId,
    );
    for (const [sessionId] of entries) {
      get().confirmDeletion(sessionId);
    }
  },
}));

// App exit must not strand notes soft-deleted with live shared links: confirm
// every pending deletion now and let the caller await the finalize work.
export function confirmAllPendingDeletions(): Promise<void> {
  const { pendingDeletions, confirmDeletion } = useUndoDelete.getState();
  return Promise.allSettled(
    Object.keys(pendingDeletions).map((sessionId) =>
      confirmDeletion(sessionId),
    ),
  ).then(() => undefined);
}
