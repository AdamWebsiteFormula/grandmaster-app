import { create } from "zustand";

// Holds chat tool calls that change meeting data and are waiting for the user
// to press Apply or Dismiss on the tool card. Mirrors pending-edit-store.ts,
// which does the same for edit_memo and edit_summary.
type PendingApproval = {
  requestId: string;
  details?: string;
  resolve: (approved: boolean) => void;
};

type PendingApprovalStore = {
  approvals: Map<string, PendingApproval>;
  // Tool calls dismissed by Stop. The aborted stream never delivers their
  // "declined" result, so the card reads this to stop spinning.
  stopped: Set<string>;
  addApproval: (approval: PendingApproval) => void;
  resolveApproval: (requestId: string, approved: boolean) => void;
  markStopped: (requestId: string) => void;
};

export const usePendingApprovalStore = create<PendingApprovalStore>(
  (set, get) => ({
    approvals: new Map(),
    stopped: new Set(),
    addApproval: (approval) => {
      set((state) => {
        const next = new Map(state.approvals);
        next.set(approval.requestId, approval);
        return { approvals: next };
      });
    },
    resolveApproval: (requestId, approved) => {
      const approval = get().approvals.get(requestId);
      if (!approval) {
        return;
      }
      set((state) => {
        const next = new Map(state.approvals);
        next.delete(requestId);
        return { approvals: next };
      });
      approval.resolve(approved);
    },
    markStopped: (requestId) => {
      set((state) => {
        if (state.stopped.has(requestId)) {
          return state;
        }
        const next = new Set(state.stopped);
        next.add(requestId);
        return { stopped: next };
      });
    },
  }),
);

// Resolves true only when the user presses Apply. A stopped chat counts as
// a dismissal, so nothing changes.
export function waitForApproval(
  requestId: string,
  options: { details?: string; abortSignal?: AbortSignal } = {},
): Promise<boolean> {
  const { details, abortSignal } = options;
  if (abortSignal?.aborted) {
    usePendingApprovalStore.getState().markStopped(requestId);
    return Promise.resolve(false);
  }

  return new Promise<boolean>((resolve) => {
    const onAbort = () => {
      const store = usePendingApprovalStore.getState();
      store.markStopped(requestId);
      store.resolveApproval(requestId, false);
    };
    abortSignal?.addEventListener("abort", onAbort, { once: true });
    usePendingApprovalStore.getState().addApproval({
      requestId,
      details,
      resolve: (approved) => {
        abortSignal?.removeEventListener("abort", onAbort);
        resolve(approved);
      },
    });
  });
}
