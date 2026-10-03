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
// › Resume recording; no engine change.
export function useCanResumeRecording(sessionId: string) {
  return useListener(
    (state) =>
      state.getSessionMode(sessionId) === "inactive" &&
      state.canStartLiveSession(sessionId),
  );
}

type ResumeButtonProps = {
  sessionId: string;
  variant: "pill" | "toolbar";
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
      className="border-input bg-popover text-popover-foreground hover:bg-accent focus-visible:ring-ring pointer-events-auto absolute bottom-4 left-4 z-20 inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm font-medium shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none dark:shadow-none"
    >
      <Microphone aria-hidden className="size-4" />
      {/* In a very narrow pane only the icon shows, so the note bar fits
          beside it (WCAG 2.2 SC 1.4.10 Reflow). */}
      <span className="@max-[560px]:sr-only">{t`Resume recording`}</span>
    </button>
  );
}
