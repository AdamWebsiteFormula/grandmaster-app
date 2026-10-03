import { useLingui } from "@lingui/react/macro";
import { useCallback, useMemo } from "react";

import { CheckCircle, Copy, PencilSimple } from "@anlg/ui/components/icons";
import { DancingSticks } from "@anlg/ui/components/ui/dancing-sticks";
import { Spinner } from "@anlg/ui/components/ui/spinner";
import { toast } from "@anlg/ui/components/ui/toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@anlg/ui/components/ui/tooltip";
import { cn } from "@anlg/utils";

import {
  IconHeaderView,
  copyTextToClipboard,
  iconHeaderViewClassName,
} from "./header-shared";
import { TranscriptAudioIcon } from "./header-transcript-icon";

import * as AudioPlayer from "~/audio-player";
import {
  buildTranscriptExportSegments,
  formatTranscriptExportSegments,
} from "~/session/components/note-input/transcript/export-data";
import { useRegenerateTranscriptConfirm } from "~/session/components/note-input/transcript/regenerate-confirm";
import { getSessionTranscriptRenderRequest } from "~/session/components/note-input/transcript/render-request-hooks";
import { useHasTranscript } from "~/session/components/shared";
import {
  type MenuItemDef,
  useNativeContextMenu,
} from "~/shared/hooks/useNativeContextMenu";
import { useListener } from "~/stt/contexts";
import { useSessionTranscriptMetadata } from "~/stt/queries";
import { useStartListeningWithBatchOverride } from "~/stt/useStartListeningWithBatchOverride";
import {
  isMainWebviewWindow,
  requestMainListenerControl,
} from "~/stt/window-control";

export function HeaderViewTranscript({
  isActive,
  isTranscribing,
  editMode = false,
  onEditModeChange,
  onClick = () => {},
  sessionId,
}: {
  isActive: boolean;
  isTranscribing: boolean;
  editMode?: boolean;
  onEditModeChange?: (editMode: boolean) => void;
  onClick?: () => void;
  sessionId: string;
}) {
  const liveState = useTranscriptLiveViewState(sessionId);

  if (!isActive) {
    return (
      <HeaderViewTranscriptButton
        isActive={isActive}
        isTranscribing={isTranscribing}
        onClick={onClick}
        live={liveState.live}
      />
    );
  }

  return (
    <HeaderViewTranscriptActive
      isActive={isActive}
      isTranscribing={isTranscribing}
      editMode={editMode}
      onEditModeChange={onEditModeChange}
      onClick={onClick}
      sessionId={sessionId}
      live={liveState.live}
    />
  );
}

function HeaderViewTranscriptButton({
  isActive,
  isTranscribing,
  onClick,
  onContextMenu,
  live,
  suffixIcon,
  pressed,
  title,
}: {
  isActive: boolean;
  isTranscribing: boolean;
  onClick?: () => void;
  onContextMenu?: React.MouseEventHandler<HTMLButtonElement>;
  suffixIcon?: React.ReactNode;
  pressed?: boolean;
  title?: string;
  live?: {
    amplitude: number;
    muted: boolean;
  };
}) {
  const { t } = useLingui();

  return (
    <IconHeaderView
      isActive={isActive}
      label={t`Transcript`}
      hoverLabel={undefined}
      icon={
        live ? (
          <HeaderViewTranscriptLiveIcon live={live} />
        ) : isTranscribing ? (
          <Spinner size={16} className="shrink-0" />
        ) : (
          <TranscriptAudioIcon />
        )
      }
      suffixIcon={suffixIcon}
      pressed={pressed}
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={title}
      className={cn([
        live
          ? [
              "group/transcript-live",
              isActive
                ? "w-[98px] min-w-[98px] gap-1.5 px-2 @max-[480px]:w-10 @max-[480px]:min-w-10 @max-[480px]:gap-0"
                : null,
              isActive
                ? ["bg-primary/10 text-primary hover:bg-primary/15"]
                : null,
            ]
          : null,
      ])}
    />
  );
}

function HeaderViewTranscriptLiveIcon({
  live,
}: {
  live: {
    amplitude: number;
    muted: boolean;
  };
}) {
  return (
    <span className="relative flex size-4 items-center justify-center">
      {live.muted ? (
        <TranscriptAudioIcon />
      ) : (
        <DancingSticks
          amplitude={live.amplitude}
          color="hsl(var(--primary))"
          height={16}
          width={16}
        />
      )}
    </span>
  );
}

function useTranscriptLiveViewState(sessionId: string) {
  const { amplitude, mode, muted } = useListener((state) => {
    const mode = state.getSessionMode(sessionId);
    return {
      amplitude: state.live.amplitude,
      mode,
      muted: state.live.muted,
    };
  });
  return {
    live:
      mode === "active"
        ? {
            amplitude: Math.min(
              Math.hypot(amplitude.mic, amplitude.speaker),
              1,
            ),
            muted,
          }
        : undefined,
  };
}

function HeaderViewTranscriptActive({
  isActive,
  isTranscribing,
  editMode,
  onEditModeChange,
  onClick,
  sessionId,
  live,
}: {
  isActive: boolean;
  isTranscribing: boolean;
  editMode: boolean;
  onEditModeChange?: (editMode: boolean) => void;
  onClick?: () => void;
  sessionId: string;
  live?: {
    amplitude: number;
    muted: boolean;
  };
}) {
  const {
    requestRegenerateTranscript: regenerate,
    confirmDialog: regenerateConfirmDialog,
  } = useRegenerateTranscriptConfirm(sessionId);
  const startListening = useStartListeningWithBatchOverride(sessionId);
  const hasTranscript = useHasTranscript(sessionId);
  const { t } = useLingui();
  const { canCopyTranscript, copyTranscript: handleCopyTranscript } =
    useCopyTranscript(sessionId);
  const {
    audioExists,
    audioExistsResolved,
    requestDeleteRecording,
    isDeletingRecording,
  } = AudioPlayer.useAudioPlayer();
  const sessionMode = useListener((state) => state.getSessionMode(sessionId));
  const canEdit =
    sessionMode === "inactive" && hasTranscript && Boolean(onEditModeChange);
  const handleClick = useCallback(() => {
    if (canEdit) {
      onEditModeChange?.(!editMode);
      return;
    }

    onClick?.();
  }, [canEdit, editMode, onClick, onEditModeChange]);
  // Fork: Delete recording asks first (ux-audit-oct3 C, HIG alerts).
  const handleDeleteRecording = useCallback(() => {
    requestDeleteRecording();
  }, [requestDeleteRecording]);
  const handleResumeListening = useCallback(() => {
    if (!isMainWebviewWindow()) {
      void requestMainListenerControl("start", sessionId);
      return;
    }

    void startListening();
  }, [sessionId, startListening]);
  const contextMenu = useMemo<MenuItemDef[]>(() => {
    const items: MenuItemDef[] = [
      {
        id: `copy-transcript-${sessionId}`,
        text: t`Copy transcript`,
        action: () => {
          void handleCopyTranscript();
        },
        disabled: !canCopyTranscript,
      },
    ];

    if (sessionMode === "inactive" || sessionMode === "running_batch") {
      items.push({
        id: `resume-listening-${sessionId}`,
        // Fork: shared recording vocabulary (ux-audit-oct3 C, NN/g #4).
        text: t`Resume recording`,
        action: handleResumeListening,
      });
    }

    if (audioExistsResolved && sessionMode === "inactive" && audioExists) {
      items.push({
        id: `regenerate-transcript-${sessionId}`,
        text: t`Transcribe again`,
        action: regenerate,
      });
    }

    if (audioExists) {
      items.push({
        id: `delete-recording-${sessionId}`,
        text: t`Delete recording`,
        action: handleDeleteRecording,
        disabled: isDeletingRecording,
      });
    }

    return items;
  }, [
    audioExists,
    audioExistsResolved,
    canCopyTranscript,
    handleCopyTranscript,
    handleDeleteRecording,
    handleResumeListening,
    isDeletingRecording,
    regenerate,
    sessionMode,
    sessionId,
    t,
  ]);
  const showContextMenu = useNativeContextMenu(contextMenu);

  return (
    <>
      <HeaderViewTranscriptButton
        isActive={isActive}
        isTranscribing={isTranscribing}
        onClick={handleClick}
        onContextMenu={showContextMenu}
        live={live}
        // Fork: the edit toggle had no tooltip (ux-audit-oct3 C, NN/g #6).
        title={
          canEdit
            ? editMode
              ? t`Done editing`
              : t`Edit transcript`
            : undefined
        }
        suffixIcon={
          canEdit ? (
            editMode ? (
              <CheckCircle aria-hidden className="size-3.5" />
            ) : (
              <PencilSimple aria-hidden className="size-3.5" />
            )
          ) : undefined
        }
        pressed={canEdit ? editMode : undefined}
      />
      {canCopyTranscript ? (
        <CopyTranscriptButton
          onCopy={() => {
            void handleCopyTranscript();
          }}
        />
      ) : null}
      {regenerateConfirmDialog}
    </>
  );
}

// Fork: Copy transcript was only in the right-click menu; Granola shows a
// visible copy for the transcript (ux-audit-oct3 C; HIG context menus).
function CopyTranscriptButton({ onCopy }: { onCopy: () => void }) {
  const { t } = useLingui();
  const label = t`Copy transcript`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            data-main-area-window-drag-region
            data-tauri-drag-region="false"
            type="button"
            aria-label={label}
            onClick={(event) => {
              event.stopPropagation();
              onCopy();
            }}
            className={iconHeaderViewClassName(false, "tray", "px-1.5")}
          >
            <Copy className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function useCopyTranscript(sessionId: string) {
  const { t } = useLingui();
  const transcriptMetadata = useSessionTranscriptMetadata(sessionId);
  const canCopyTranscript = transcriptMetadata.some((item) => item.hasWords);
  const copyTranscript = useCallback(async () => {
    try {
      const transcriptExportRequest =
        await getSessionTranscriptRenderRequest(sessionId);
      if (!transcriptExportRequest) {
        return;
      }

      const transcriptSegments = await buildTranscriptExportSegments(
        transcriptExportRequest,
      );
      const transcriptText = formatTranscriptExportSegments(transcriptSegments);
      if (!transcriptText) {
        return;
      }

      await copyTextToClipboard(transcriptText, {
        success: t`Transcript copied to clipboard`,
        error: t`Couldn't copy the transcript. Try again.`,
      });
    } catch (error) {
      console.error("Failed to copy transcript", error);
      toast.error(t`Couldn't copy the transcript. Try again.`);
    }
  }, [sessionId, t]);

  return { canCopyTranscript, copyTranscript };
}
