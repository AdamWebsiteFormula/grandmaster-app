import { Trans, useLingui } from "@lingui/react/macro";
import { useCallback } from "react";

import { Square, Warning } from "@anlg/ui/components/icons";
import { DancingSticks } from "@anlg/ui/components/ui/dancing-sticks";

import {
  type CaptureHealthNotice,
  meterLevel,
  useCaptureHealthNotice,
} from "./capture-health";

import { usePermission } from "~/shared/hooks/usePermissions";
import { useListener } from "~/stt/contexts";
import {
  isMainWebviewWindow,
  requestMainListenerControl,
} from "~/stt/window-control";

// Fork: Granola-style recording state at the bottom of the note: moving bars and a clear stop button.
export function RecordingBar({ sessionId }: { sessionId: string }) {
  const { t } = useLingui();
  const { active, amplitude, mic, speaker, muted } = useListener((state) => ({
    active: state.getSessionMode(sessionId) === "active",
    amplitude: Math.min(
      Math.hypot(state.live.amplitude.mic, state.live.amplitude.speaker),
      1,
    ),
    mic: state.live.amplitude.mic,
    speaker: state.live.amplitude.speaker,
    muted: state.live.muted,
  }));
  const stop = useListener((state) => state.stop);

  const handleStop = useCallback(() => {
    if (!isMainWebviewWindow()) {
      void requestMainListenerControl("stop", sessionId);
      return;
    }

    stop();
  }, [sessionId, stop]);

  if (!active) {
    return null;
  }

  return (
    <>
      <CaptureHealth speaker={speaker} />
      <div
        role="status"
        className="border-border bg-popover text-popover-foreground pointer-events-auto absolute bottom-3 left-4 z-20 flex h-10 items-center gap-3 rounded-full border pr-1 pl-4"
      >
        <DancingSticks
          // A floor keeps the bars moving in silence, so recording always reads as live.
          amplitude={muted ? 0 : Math.max(amplitude, 0.35)}
          color="hsl(var(--primary))"
          height={18}
          width={22}
          stickWidth={3}
        />
        <span className="text-sm font-medium">
          {muted ? <Trans>Muted</Trans> : <Trans>Recording</Trans>}
        </span>
        <span className="grid grid-cols-[auto_2rem] items-center gap-x-1.5">
          <LevelMeter label={t`You`} amplitude={muted ? 0 : mic} />
          <LevelMeter label={t`Them`} amplitude={speaker} />
        </span>
        <button
          type="button"
          onClick={handleStop}
          title={t`Stop recording`}
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-ring inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <Square className="size-3" weight="bold" />
          <Trans>Stop</Trans>
        </button>
      </div>
    </>
  );
}

// Fork (F2): one level per side, so you can see both are being heard.
function LevelMeter({
  label,
  amplitude,
}: {
  label: string;
  amplitude: number;
}) {
  const level = meterLevel(amplitude);

  return (
    <>
      <span className="text-muted-foreground text-xs leading-4">{label}</span>
      <span
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(level * 100)}
        className="bg-muted relative h-1.5 w-8 overflow-hidden rounded-full"
      >
        <span
          className="bg-foreground absolute inset-y-0 left-0 rounded-full transition-[width] duration-100 ease-out"
          style={{ width: `${level * 100}%` }}
        />
      </span>
    </>
  );
}

// Fork (F2): mounted only while recording, so the 10 s silence clock starts
// with the recording and the permission poll stops with it.
function CaptureHealth({ speaker }: { speaker: number }) {
  const systemAudio = usePermission("systemAudio");
  const notice = useCaptureHealthNotice(speaker, systemAudio.confirmedStatus);

  return (
    <CaptureHealthBanner notice={notice} onOpenSettings={systemAudio.open} />
  );
}

export function CaptureHealthBanner({
  notice,
  onOpenSettings,
}: {
  notice: CaptureHealthNotice;
  onOpenSettings: () => Promise<void>;
}) {
  if (notice === "none") {
    return null;
  }

  if (notice === "quiet") {
    return (
      <div
        role="status"
        className="border-border bg-popover text-muted-foreground pointer-events-auto absolute bottom-16 left-4 z-20 max-w-[calc(100%-2rem)] rounded-lg border px-3 py-2 text-sm"
      >
        <Trans>No sound from the other side yet</Trans>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="border-destructive/50 bg-popover text-popover-foreground pointer-events-auto absolute bottom-16 left-4 z-20 flex max-w-[calc(100%-2rem)] items-center gap-3 rounded-lg border py-2 pr-2 pl-3"
    >
      <Warning className="text-destructive size-4 shrink-0" />
      <span className="text-sm">
        <Trans>
          Can't hear the other side. Check the system audio permission.
        </Trans>
      </span>
      <button
        type="button"
        onClick={() => {
          onOpenSettings().catch((error: unknown) => {
            console.error("[capture-health] open settings failed", error);
          });
        }}
        className="bg-secondary text-secondary-foreground hover:bg-accent focus-visible:ring-ring inline-flex h-8 shrink-0 cursor-pointer items-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <Trans>Open System Settings</Trans>
      </button>
    </div>
  );
}
