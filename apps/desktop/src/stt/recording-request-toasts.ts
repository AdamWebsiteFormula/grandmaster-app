import { t } from "@lingui/core/macro";

import { toast } from "@anlg/ui/components/ui/toast";

import { preloadSession } from "~/session/queries";
import { useTabs } from "~/store/zustand/tabs";

// Fork: a record request must never vanish silently (journey-meeting P1, P2;
// Granola docs "How transcription works": New note starts capturing at once;
// NN/g #1 visibility of system status, #9 help users recover from errors).

// Asks the note to start again through the same manual auto-start path that
// ⌘N, New note and Coming up › Record use; no engine call of its own.
export function requestManualRecording(sessionId: string) {
  useTabs.getState().openNew({
    type: "sessions",
    id: sessionId,
    state: { view: null, autoStart: true, scheduledAutoStart: null },
  });
}

export function showRecordingDidNotStartToast(sessionId: string) {
  toast.error(t`Recording didn't start`, {
    id: `recording-did-not-start-${sessionId}`,
    description: t`Transcription is still getting ready. Try again in a moment.`,
    action: {
      label: t`Start recording`,
      onClick: () => requestManualRecording(sessionId),
    },
  });
}

export function showStillRecordingToast(liveSessionId: string) {
  const show = (title: string) => {
    const name = title.trim();
    toast(
      name ? t`Still recording "${name}"` : t`Still recording another note`,
      {
        id: "still-recording-another-note",
        description: t`Stop it first to record this meeting.`,
        action: {
          label: t`Go to recording`,
          onClick: () =>
            useTabs.getState().openNew({ type: "sessions", id: liveSessionId }),
        },
      },
    );
  };

  void preloadSession(liveSessionId)
    .then((session) => show(session?.title ?? ""))
    .catch(() => show(""));
}
