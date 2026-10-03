import { t } from "@lingui/core/macro";
import { useQueryClient } from "@tanstack/react-query";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { toast } from "@anlg/ui/components/ui/toast";
import { useMountEffect } from "@anlg/ui/hooks/use-mount-effect";

import { restoreDeletedSession } from "~/session/queries";
import { useTabs } from "~/store/zustand/tabs";
import { UNDO_TIMEOUT_MS, useUndoDelete } from "~/store/zustand/undo-delete";

type ToastGroup = {
  key: string;
  sessionIds: string[];
  isBatch: boolean;
  addedAt: number;
};

function useToastGroups(): ToastGroup[] {
  const pendingDeletions = useUndoDelete((state) => state.pendingDeletions);

  return useMemo(() => {
    const batchMap = new Map<string, string[]>();
    const singles: { sessionId: string; addedAt: number }[] = [];

    for (const [sessionId, pending] of Object.entries(pendingDeletions)) {
      if (pending.batchId) {
        const existing = batchMap.get(pending.batchId) ?? [];
        existing.push(sessionId);
        batchMap.set(pending.batchId, existing);
      } else {
        singles.push({ sessionId, addedAt: pending.addedAt });
      }
    }

    const groups: ToastGroup[] = singles.map(({ sessionId, addedAt }) => ({
      key: sessionId,
      sessionIds: [sessionId],
      isBatch: false,
      addedAt,
    }));

    for (const [batchId, sessionIds] of batchMap) {
      groups.push({
        key: batchId,
        sessionIds,
        isBatch: true,
        addedAt: Math.min(
          ...sessionIds.map((id) => pendingDeletions[id].addedAt),
        ),
      });
    }

    return groups.sort((a, b) => a.addedAt - b.addedAt);
  }, [pendingDeletions]);
}

function useRestoreGroup() {
  const queryClient = useQueryClient();
  const pendingDeletions = useUndoDelete((state) => state.pendingDeletions);
  const addDeletion = useUndoDelete((state) => state.addDeletion);
  const clearDeletion = useUndoDelete((state) => state.clearDeletion);
  const clearBatch = useUndoDelete((state) => state.clearBatch);
  const openCurrent = useTabs((state) => state.openCurrent);
  const invalidateResource = useTabs((state) => state.invalidateResource);

  return useCallback(
    (group: ToastGroup) => {
      const entries = group.sessionIds
        .map((sessionId) => pendingDeletions[sessionId])
        .filter((pending) => pending !== undefined);

      // Optimistic: dismiss the toast (also cancelling the finalize timers)
      // and reopen the tab before the restore writes commit.
      if (group.isBatch) {
        clearBatch(group.key);
      } else {
        clearDeletion(group.sessionIds[0]);
      }
      if (group.sessionIds.length > 0) {
        openCurrent({ type: "sessions", id: group.sessionIds[0] });
      }

      void (async () => {
        const remaining = [...entries];
        try {
          while (remaining.length > 0) {
            const pending = remaining[0];
            await restoreDeletedSession(pending.data);
            remaining.shift();
            const sessionId = pending.data.session.id;
            void queryClient.invalidateQueries({
              predicate: (query) =>
                query.queryKey.length >= 2 &&
                query.queryKey[0] === "audio" &&
                query.queryKey[1] === sessionId,
            });
          }
        } catch (error) {
          console.error("[undo-delete] failed to restore session", error);
          toast.error(t`Could not restore deleted note`);
          // Re-add the unrestored deletions so their undo toast (and the
          // finalize path) comes back instead of leaving them tombstoned,
          // and close the optimistically reopened tab — it still points at
          // a tombstoned note.
          for (const pending of remaining) {
            addDeletion(
              pending.data,
              pending.onDeleteConfirm ?? undefined,
              pending.batchId ?? undefined,
            );
            invalidateResource("sessions", pending.data.session.id);
          }
        }
      })();
    },
    [
      pendingDeletions,
      openCurrent,
      invalidateResource,
      addDeletion,
      clearDeletion,
      clearBatch,
      queryClient,
    ],
  );
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

// Fork: ⌘Z restores the latest deleted note while its Undo toast shows,
// outside text fields and editors, which keep their own undo
// (ux-audit-oct3 B; Apple HIG, Keyboards: ⌘Z is Undo).
function useUndoShortcut(groups: ToastGroup[]) {
  const restoreGroup = useRestoreGroup();
  const latest = groups[groups.length - 1];

  useEffect(() => {
    if (!latest) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.shiftKey ||
        event.altKey ||
        event.key.toLowerCase() !== "z" ||
        event.defaultPrevented ||
        isEditableTarget(event.target)
      ) {
        return;
      }
      event.preventDefault();
      restoreGroup(latest);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [latest, restoreGroup]);
}

export function UndoDeleteToast() {
  const groups = useToastGroups();
  useUndoShortcut(groups);

  return groups.map((group) => (
    <UndoDeleteNotificationToast
      key={`${group.key}:${group.sessionIds.join(":")}`}
      group={group}
    />
  ));
}

function UndoDeleteNotificationToast({ group }: { group: ToastGroup }) {
  const restoreGroup = useRestoreGroup();
  const pendingDeletions = useUndoDelete((state) => state.pendingDeletions);
  const title =
    pendingDeletions[group.sessionIds[0]]?.data.session.title || t`Untitled`;
  const noteLabel = group.sessionIds.length === 1 ? t`note` : t`notes`;
  const label = group.isBatch
    ? t`${group.sessionIds.length} ${noteLabel} deleted`
    : t`${title} deleted`;
  const remainingDuration = Math.max(
    0,
    group.addedAt + UNDO_TIMEOUT_MS - Date.now(),
  );
  const progress = remainingDuration / UNDO_TIMEOUT_MS;

  useMountEffect(() => {
    const toastId = `undo-delete:${group.key}`;

    toast.message(label, {
      id: toastId,
      duration: Infinity,
      closeButton: false,
      dismissible: false,
      description: (
        <UndoDeleteGauge
          sessionIds={group.sessionIds}
          remainingDuration={remainingDuration}
          progress={progress}
        />
      ),
      descriptionClassName:
        "bg-muted absolute inset-x-0 bottom-0 h-1 overflow-hidden rounded-b-xl",
      action: {
        label: t`Undo`,
        onClick: () => restoreGroup(group),
      },
    });

    return () => toast.dismiss(toastId);
  });

  return null;
}

// Fork: hovering or focusing the toast pauses both the countdown gauge and
// the finalize timer (journey-after P2 "Delete note / undo"; WCAG 2.2 SC
// 2.2.1 Timing Adjustable).
export function UndoDeleteGauge({
  sessionIds,
  remainingDuration,
  progress,
}: {
  sessionIds: string[];
  remainingDuration: number;
  progress: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [paused, setPaused] = useState(false);
  const idsKey = sessionIds.join(":");

  useEffect(() => {
    const toastElement =
      ref.current?.closest<HTMLElement>("[data-sonner-toast]") ?? null;
    if (!toastElement) return;
    const ids = idsKey.split(":");
    let hovered = false;
    let focused = false;
    const sync = () => {
      const next = hovered || focused;
      setPaused(next);
      const store = useUndoDelete.getState();
      if (next) store.pauseDeletions(ids);
      else store.resumeDeletions(ids);
    };
    const onEnter = () => {
      hovered = true;
      sync();
    };
    const onLeave = () => {
      hovered = false;
      sync();
    };
    const onFocusIn = () => {
      focused = true;
      sync();
    };
    const onFocusOut = (event: FocusEvent) => {
      if (
        event.relatedTarget instanceof Node &&
        toastElement.contains(event.relatedTarget)
      ) {
        return;
      }
      focused = false;
      sync();
    };
    toastElement.addEventListener("mouseenter", onEnter);
    toastElement.addEventListener("mouseleave", onLeave);
    toastElement.addEventListener("focusin", onFocusIn);
    toastElement.addEventListener("focusout", onFocusOut);
    return () => {
      toastElement.removeEventListener("mouseenter", onEnter);
      toastElement.removeEventListener("mouseleave", onLeave);
      toastElement.removeEventListener("focusin", onFocusIn);
      toastElement.removeEventListener("focusout", onFocusOut);
    };
  }, [idsKey]);

  return (
    <span
      ref={ref}
      aria-hidden="true"
      className="undo-delete-toast-gauge bg-primary block h-full w-full"
      style={
        {
          "--undo-delete-duration": `${remainingDuration}ms`,
          "--undo-delete-progress": progress,
          animationPlayState: paused ? "paused" : "running",
        } as CSSProperties
      }
    />
  );
}
