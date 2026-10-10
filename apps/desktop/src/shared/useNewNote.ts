import { useCallback } from "react";
import { useShallow } from "zustand/shallow";

import { createSession } from "~/session/queries";
import { folderIdForNewNote, useSidebarNotes } from "~/sidebar/note-filter";
import { listenerStore } from "~/store/zustand/listener/instance";
import { useTabs } from "~/store/zustand/tabs";
import { showStillRecordingToast } from "~/stt/recording-request-toasts";

// Fork: a quick double-click on "Blank note" or "Record meeting" made two
// notes; one create runs at a time, and the extra click does nothing
// (live task test, Oct 10; NN/g heuristic #5, error prevention).
let creatingNote: Promise<string> | null = null;

function createNoteSession(): Promise<string> | null {
  if (creatingNote) return null;
  const { noteFilter, folderFilter } = useSidebarNotes.getState();
  const folderId = folderIdForNewNote(noteFilter, folderFilter);
  const pending = (
    folderId === undefined
      ? createSession()
      : createSession("", undefined, { folder_id: folderId })
  ).finally(() => {
    creatingNote = null;
  });
  creatingNote = pending;
  return pending;
}

export function useNewNote({
  behavior = "new",
}: {
  behavior?: "new" | "current";
} = {}) {
  const { openNew, openCurrent } = useTabs(
    useShallow((state) => ({
      openNew: state.openNew,
      openCurrent: state.openCurrent,
    })),
  );

  const handler = useCallback(() => {
    const ff = behavior === "new" ? openNew : openCurrent;
    void createNoteSession()
      ?.then((sessionId) => {
        ff({ type: "sessions", id: sessionId });
      })
      .catch((error) => {
        console.error("[session] failed to create note", error);
      });
  }, [openNew, openCurrent, behavior]);

  return handler;
}

export function useNewNoteAndListen({
  behavior = "new",
}: {
  behavior?: "new" | "current";
} = {}) {
  const handler = useCallback(
    () => openNewNoteAndListen({ behavior }),
    [behavior],
  );

  return handler;
}

export function openNewNoteAndListen({
  behavior = "new",
}: {
  behavior?: "new" | "current";
} = {}) {
  const { status, sessionId: liveSessionId } = listenerStore.getState().live;

  if (status === "active" && liveSessionId) {
    const { openNew, openCurrent } = useTabs.getState();
    const open = behavior === "new" ? openNew : openCurrent;
    open({ type: "sessions", id: liveSessionId });
    return;
  }

  void createNoteSession()
    ?.then((sessionId) => {
      openSessionAndListen(sessionId, { behavior });
    })
    .catch((error) => {
      console.error("[session] failed to create listening note", error);
    });
}

export function openSessionAndListen(
  sessionId: string,
  {
    behavior = "new",
  }: {
    behavior?: "new" | "current";
  } = {},
) {
  const { openNew, openCurrent } = useTabs.getState();
  const { status, sessionId: liveSessionId } = listenerStore.getState().live;
  const open = behavior === "new" ? openNew : openCurrent;

  if (status === "active") {
    open({ type: "sessions", id: sessionId });
    // Fork: say the other note is still recording instead of opening this
    // one silently (journey-meeting P2; NN/g #1; Granola docs: stop between
    // back-to-back meetings).
    if (liveSessionId && liveSessionId !== sessionId) {
      showStillRecordingToast(liveSessionId);
    }
    return;
  }

  open({
    type: "sessions",
    id: sessionId,
    state: { view: null, autoStart: true, scheduledAutoStart: null },
  });
}
