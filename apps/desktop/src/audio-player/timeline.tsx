import { useLingui } from "@lingui/react/macro";
import { useCallback, useMemo, useState } from "react";

import { Pause, Play } from "@anlg/ui/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@anlg/ui/components/ui/dropdown-menu";
import { cn } from "@anlg/utils";

import { useAudioPlayer, useAudioTime } from "./provider";
import { TimelineMeta, TimelineShell } from "./timeline-shell";

import { useBillingAccess } from "~/auth/billing-context";
import { useNativeContextMenu } from "~/shared/hooks/useNativeContextMenu";

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export function Timeline({
  contentClassName,
}: {
  contentClassName?: string;
} = {}) {
  const { t } = useLingui();
  const { isPro } = useBillingAccess();
  const {
    registerContainer,
    state,
    pause,
    resume,
    start,
    stop,
    playbackRate,
    setPlaybackRate,
    requestDeleteRecording,
    isDeletingRecording,
  } = useAudioPlayer();
  const time = useAudioTime();
  const [showRateMenu, setShowRateMenu] = useState(false);

  const handleClick = () => {
    if (state === "playing") {
      pause();
    } else if (state === "paused") {
      resume();
    } else if (state === "stopped") {
      start();
    }
  };

  // Fork: asks before deleting (ux-audit-oct3 C, HIG alerts).
  const handleDeleteRecording = useCallback(() => {
    setShowRateMenu(false);
    requestDeleteRecording();
  }, [requestDeleteRecording]);

  const contextMenu = useMemo(
    () => [
      ...(state === "paused"
        ? [{ id: "resume", text: "Resume", action: resume }]
        : []),
      ...(state === "stopped"
        ? [{ id: "play", text: "Play", action: start }]
        : []),
      ...(state === "playing"
        ? [{ id: "pause", text: "Pause", action: pause }]
        : []),
      ...(state !== "stopped"
        ? [{ id: "stop", text: "Stop", action: stop }]
        : []),
      { separator: true as const },
      {
        id: "delete-recording",
        text: "Delete recording",
        action: handleDeleteRecording,
        disabled: isDeletingRecording,
      },
    ],
    [
      state,
      resume,
      start,
      pause,
      stop,
      isDeletingRecording,
      handleDeleteRecording,
    ],
  );
  const showContextMenu = useNativeContextMenu(contextMenu);

  return (
    <TimelineShell
      contentClassName={contentClassName}
      onContextMenu={showContextMenu}
      leading={
        <button
          type="button"
          onClick={handleClick}
          // Fork: named for screen readers (ux-audit-oct3 C, WCAG 4.1.2).
          aria-label={state === "playing" ? t`Pause` : t`Play`}
          title={state === "playing" ? t`Pause` : t`Play`}
          className={cn([
            "flex items-center justify-center",
            "h-7 w-7 rounded-full",
            "border-border bg-card border",
            "hover:bg-accent transition-all hover:scale-110",
            // Fork: no shadow on black (journey-meeting P3; design-system.md).
            "shrink-0 select-none",
          ])}
        >
          {state === "playing" ? (
            <Pause className="text-foreground h-3.5 w-3.5" />
          ) : (
            <Play className="text-foreground h-3.5 w-3.5" />
          )}
        </button>
      }
      meta={
        <>
          <TimelineMeta>
            <span>{formatTime(time.current)}</span>/
            <span>{formatTime(time.total)}</span>
          </TimelineMeta>

          {isPro ? (
            <DropdownMenu
              modal={false}
              open={showRateMenu}
              onOpenChange={setShowRateMenu}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t`Playback speed`}
                  title={t`Playback speed`}
                  className={cn([
                    "flex shrink-0 items-center justify-center",
                    "h-6 rounded-md px-1.5",
                    "border-border bg-card border",
                    "hover:bg-accent transition-colors",
                    // Fork: Geist Mono is for keys and code only; no shadow
                    // on black (journey-meeting P3; design-system.md).
                    "text-muted-foreground text-xs tabular-nums select-none",
                  ])}
                >
                  {playbackRate}x
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="end"
                className="border-border bg-card min-w-0 rounded-lg p-0 py-1"
              >
                {PLAYBACK_RATES.map((rate) => (
                  <DropdownMenuItem
                    key={rate}
                    onSelect={() => setPlaybackRate(rate)}
                    className={cn([
                      "block w-full rounded-none px-3 py-1 text-left text-xs tabular-nums select-none",
                      "hover:bg-accent focus:bg-accent transition-colors",
                      rate === playbackRate
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground",
                    ])}
                  >
                    {rate}x
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </>
      }
      main={
        <div
          ref={registerContainer}
          className="h-6 min-w-0 flex-1"
          style={{ width: "100%" }}
        />
      }
    />
  );
}

// Fork: h:mm:ss past an hour, "1:15:12" not "75:12" (journey-meeting P3;
// Apple HIG, clear durations).
export function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = (safe % 60).toString().padStart(2, "0");
  return hours > 0
    ? `${hours}:${mins.toString().padStart(2, "0")}:${secs}`
    : `${mins.toString().padStart(2, "0")}:${secs}`;
}
