import { useRef, useState } from "react";

import { useMountEffect } from "@anlg/ui/hooks/use-mount-effect";

import { isLockedFlag } from "~/lock/flag";
import { useAppLock } from "~/lock/store";
import { useSession } from "~/session/queries";
import { useLatestRef } from "~/shared/hooks/useLatestRef";
import { type Tab, useTabs } from "~/store/zustand/tabs";
import { useListener } from "~/stt/contexts";
import {
  showRecordingDidNotStartToast,
  showStillRecordingToast,
} from "~/stt/recording-request-toasts";
import { readDueScheduledSessionMeeting } from "~/stt/scheduled-auto-start";
import {
  beginScheduledAutoStart,
  finishScheduledAutoStart,
  isScheduledAutoStartInFlight,
} from "~/stt/scheduled-auto-start-state";
import { useStartListeningState } from "~/stt/useStartListening";

// Fork: a manual start (⌘N, New note, Coming up › Record, "Take notes") waits
// this long for the transcription engine, then records anyway through the
// header button's start path, which saves audio and shows the Configure toast
// when no engine is ready (journey-meeting P1; Granola docs "How transcription
// works": New note starts capturing at once; NN/g #1).
export const MANUAL_START_ENGINE_GRACE_MS = 2_000;
const AUTO_START_TIMEOUT_MS = 30_000;

export function ScheduledSessionAutoStart({
  requiresCalendarEligibility = true,
  sessionId,
}: {
  requiresCalendarEligibility?: boolean;
  sessionId: string;
}) {
  const canStartLiveSession = useListener((state) =>
    state.canStartLiveSession(sessionId),
  );
  const recordingActive = useListener(
    (state) => state.live.status === "active",
  );
  const liveSessionId = useListener((state) => state.live.sessionId ?? null);
  const session = useSession(sessionId);
  const revealed = useAppLock((state) =>
    Boolean(state.revealedNoteIds[sessionId]),
  );
  const locked = isLockedFlag(session?.locked) && !revealed;

  if (recordingActive || (session && locked)) {
    return (
      <AbandonedScheduledSessionAutoStart
        sessionId={sessionId}
        otherLiveSessionId={
          recordingActive &&
          !requiresCalendarEligibility &&
          liveSessionId &&
          liveSessionId !== sessionId
            ? liveSessionId
            : null
        }
      />
    );
  }

  return canStartLiveSession && session ? (
    <ReadyScheduledSessionAutoStart
      key={`${sessionId}:${requiresCalendarEligibility ? "scheduled" : "manual"}`}
      requiresCalendarEligibility={requiresCalendarEligibility}
      sessionId={sessionId}
    />
  ) : (
    <PendingScheduledSessionAutoStart
      requiresCalendarEligibility={requiresCalendarEligibility}
      sessionId={sessionId}
    />
  );
}

function AbandonedScheduledSessionAutoStart({
  otherLiveSessionId,
  sessionId,
}: {
  otherLiveSessionId: string | null;
  sessionId: string;
}) {
  useMountEffect(() => {
    // Fork: a manual record request while another note records says so
    // instead of opening a silent note (journey-meeting P2; NN/g #1).
    if (clearPendingAutoStart(sessionId) && otherLiveSessionId) {
      showStillRecordingToast(otherLiveSessionId);
    }
  });

  return null;
}

// Fork: at the timeout a manual request says it didn't start and offers
// Start recording, instead of clearing silently (journey-meeting P1; NN/g #9).
function expirePendingAutoStart(
  sessionId: string,
  requiresCalendarEligibility: boolean,
) {
  if (clearPendingAutoStart(sessionId) && !requiresCalendarEligibility) {
    showRecordingDidNotStartToast(sessionId);
  }
}

function PendingScheduledSessionAutoStart({
  requiresCalendarEligibility,
  sessionId,
}: {
  requiresCalendarEligibility: boolean;
  sessionId: string;
}) {
  useMountEffect(() => {
    const timeout = setTimeout(
      () => expirePendingAutoStart(sessionId, requiresCalendarEligibility),
      AUTO_START_TIMEOUT_MS,
    );
    return () => clearTimeout(timeout);
  });

  return null;
}

function ReadyScheduledSessionAutoStart({
  requiresCalendarEligibility,
  sessionId,
}: {
  requiresCalendarEligibility: boolean;
  sessionId: string;
}) {
  const { connectionReady, startListening } = useStartListeningState(
    sessionId,
    { automatic: true },
  );
  const attemptedRef = useRef(false);
  const [engineGraceOver, setEngineGraceOver] = useState(false);

  useMountEffect(() => {
    const timeout = setTimeout(
      () => expirePendingAutoStart(sessionId, requiresCalendarEligibility),
      AUTO_START_TIMEOUT_MS,
    );
    const grace = requiresCalendarEligibility
      ? null
      : setTimeout(
          () => setEngineGraceOver(true),
          MANUAL_START_ENGINE_GRACE_MS,
        );
    return () => {
      clearTimeout(timeout);
      if (grace) clearTimeout(grace);
    };
  });

  // Fork: scheduled starts still wait for the engine; manual ones don't
  // (journey-meeting P1).
  return connectionReady || engineGraceOver ? (
    <StartScheduledSessionAutoStart
      attemptedRef={attemptedRef}
      requiresCalendarEligibility={requiresCalendarEligibility}
      sessionId={sessionId}
      startListening={startListening}
    />
  ) : null;
}

function StartScheduledSessionAutoStart({
  attemptedRef,
  requiresCalendarEligibility,
  sessionId,
  startListening,
}: {
  attemptedRef: { current: boolean };
  requiresCalendarEligibility: boolean;
  sessionId: string;
  startListening: () => Promise<void>;
}) {
  const startListeningRef = useLatestRef(startListening);

  useMountEffect(() => {
    if (attemptedRef.current) {
      return;
    }
    attemptedRef.current = true;
    let cancelled = false;
    let captureStarted = false;

    const eligibility = requiresCalendarEligibility
      ? readDueScheduledSessionMeeting(sessionId).then(Boolean)
      : Promise.resolve(true);

    void eligibility
      .then((eligible) => {
        if (cancelled) return;
        clearPendingAutoStart(sessionId);
        if (
          !eligible ||
          (requiresCalendarEligibility &&
            isScheduledAutoStartInFlight(sessionId))
        ) {
          return;
        }

        captureStarted = true;
        if (!requiresCalendarEligibility) {
          return startListeningRef.current();
        }

        beginScheduledAutoStart(sessionId);
        return startListeningRef.current().finally(() => {
          finishScheduledAutoStart(sessionId);
        });
      })
      .catch((error) => {
        if (cancelled) return;
        clearPendingAutoStart(sessionId);
        console.error("[listener] failed to auto-start session", error);
      });

    return () => {
      cancelled = true;
      if (!captureStarted) {
        attemptedRef.current = false;
      }
    };
  });

  return null;
}

function clearPendingAutoStart(sessionId: string): boolean {
  const tabsState = useTabs.getState();
  const currentTab = tabsState.tabs.find(
    (candidate): candidate is Extract<Tab, { type: "sessions" }> =>
      candidate.type === "sessions" && candidate.id === sessionId,
  );
  if (!currentTab?.state.autoStart) {
    return false;
  }

  tabsState.updateSessionTabState(currentTab, {
    ...currentTab.state,
    autoStart: null,
    scheduledAutoStart: null,
  });
  return true;
}
