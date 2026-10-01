import type { SessionDetail } from "../data/session-detail.ts";

export type NoteDraft = {
  title?: string;
  body?: string;
  bodyFormat?: SessionDetail["bodyFormat"];
};

export function createNoteDraft({
  getNote,
  saveNote,
  saveTitle,
  onError,
}: {
  getNote: () => SessionDetail | null;
  saveNote: (note: {
    title: string;
    bodyText: string;
    bodyFormat: SessionDetail["bodyFormat"];
  }) => Promise<void>;
  saveTitle: (title: string) => Promise<void>;
  onError: (error: unknown, draft: NoteDraft) => void;
}) {
  let pending: NoteDraft = {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  let savedTitle: string | null = null;

  function cancelTimer() {
    clearTimeout(timer);
    timer = undefined;
  }

  function flush(throwOnError = false) {
    cancelTimer();
    const note = getNote();
    if (!note) return;
    const draft = pending;
    pending = {};
    let write: Promise<void>;
    if (draft.body !== undefined) {
      // Live-query results can lag our writes; a body save must keep the latest title.
      const title = draft.title ?? savedTitle ?? note.title;
      savedTitle = title;
      write = saveNote({
        title,
        bodyText: draft.body,
        bodyFormat: draft.bodyFormat ?? note.bodyFormat,
      });
    } else if (draft.title !== undefined) {
      savedTitle = draft.title;
      write = saveTitle(draft.title);
    } else {
      return;
    }
    return write.catch((error) => {
      pending = { ...draft, ...pending };
      onError(error, draft);
      if (throwOnError) throw error;
    });
  }

  return {
    edit(patch: NoteDraft) {
      pending = { ...pending, ...patch };
      cancelTimer();
      timer = setTimeout(flush, 500);
    },
    flush,
    discard() {
      cancelTimer();
      pending = {};
    },
    restore(title: string) {
      cancelTimer();
      pending = {};
      savedTitle = title;
    },
    observeTitle(title: string | undefined) {
      if (title === savedTitle) savedTitle = null;
    },
    snapshot: () => ({ ...pending }),
  };
}
