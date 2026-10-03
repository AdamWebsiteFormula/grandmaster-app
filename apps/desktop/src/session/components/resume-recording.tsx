import { useLingui } from "@lingui/react/macro";

import { Microphone } from "@anlg/ui/components/icons";

import { useListener } from "~/stt/contexts";
import { useStartListeningWithBatchOverride } from "~/stt/useStartListeningWithBatchOverride";
import {
  isMainWebviewWindow,
  requestMainListenerControl,
} from "~/stt/window-control";

// Fork: Resume sits where Stop was, and adds to the same transcript, as in
// Granola (journey-meeting P1; Granola docs "How transcription works";
// Granola screen 06; NN/g #3 user control). Same start path as ⋯ › Recording
// › Resume recording; no engine change. Redline3 S3: Resume lives in the note
// bar beside the transcript toggle, not in a separate far-left pill.
export function useCanResumeRecording(sessionId: string) {
  return useListener(
    (state) =>
      state.getSessionMode(sessionId) === "inactive" &&
      state.canStartLiveSession(sessionId),
  );
}

type ResumeButtonProps = {
  sessionId: string;
  variant: "bar" | "toolbar";
};

export function ResumeRecordingButton(props: ResumeButtonProps) {
  // The main window owns capture; any other window asks it to start.
  return isMainWebviewWindow() ? (
    <MainWindowResumeButton {...props} />
  ) : (
    <ResumeButtonView
      {...props}
      onResume={() => {
        void requestMainListenerControl("start", props.sessionId);
      }}
    />
  );
}

function MainWindowResumeButton(props: ResumeButtonProps) {
  const startListening = useStartListeningWithBatchOverride(props.sessionId);

  return (
    <ResumeButtonView
      {...props}
      onResume={() => {
        void startListening();
      }}
    />
  );
}

function ResumeButtonView({
  variant,
  onResume,
}: ResumeButtonProps & { onResume: () => void }) {
  const { t } = useLingui();

  if (variant === "toolbar") {
    return (
      <button
        type="button"
        aria-label={t`Resume recording`}
        title={t`Resume recording`}
        onClick={onResume}
        className="text-foreground hover:bg-accent focus-visible:ring-ring inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <Microphone aria-hidden className="size-3.5" />
        <span>{t`Resume`}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      data-resume-recording
      aria-label={t`Resume recording`}
      title={t`Resume recording`}
      onClick={onResume}
      className="text-foreground hover:bg-accent focus-visible:ring-ring inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <Microphone aria-hidden className="size-4" />
      <span>{t`Resume`}</span>
    </button>
  );
}
