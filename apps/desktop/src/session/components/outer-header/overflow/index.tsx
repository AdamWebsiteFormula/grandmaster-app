import { Trans, useLingui } from "@lingui/react/macro";
import { useState } from "react";

import {
  AppWindow,
  ArrowsClockwise,
  ClockCounterClockwise,
  Copy,
  DotsThree,
  FileArrowDown,
  FileText,
  PictureInPicture,
  Trash,
  Waveform,
} from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";
import {
  AppFloatingPanel,
  appFloatingMenuPanelClassName,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@anlg/ui/components/ui/dropdown-menu";
import { cn } from "@anlg/utils";

import { DeleteNote } from "./delete";
import { ExportModal } from "./export-modal";
import { Listening } from "./listening";
import { LockNote } from "./lock-note";
import { ShowInFolder } from "./misc";

import { useAudioPlayer } from "~/audio-player";
import { openFloatingMeetingPanel } from "~/meeting-float/host";
import { isFloatingBarSupported } from "~/meeting-float/support";
import { useCopyTranscript } from "~/session/components/note-input/header-transcript";
import { useRegenerateTranscript } from "~/session/components/note-input/transcript/actions";
import {
  useCurrentNoteHasContent,
  useHasTranscript,
} from "~/session/components/shared";
import { VersionHistoryDialog } from "~/session/components/version-history-dialog";
import { openStandaloneNoteWindow } from "~/session/window";
import { useConfigValue } from "~/shared/config";
import type { EditorView } from "~/store/zustand/tabs/schema";
import { useListener } from "~/stt/contexts";
import { useUploadFile } from "~/stt/useUploadFile";

export function OverflowButton({
  allowListening = true,
  standaloneWindow = false,
  sessionId,
  currentView,
}: {
  allowListening?: boolean;
  standaloneWindow?: boolean;
  sessionId: string;
  currentView: EditorView;
}) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [hasOpenedExportModal, setHasOpenedExportModal] = useState(false);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [hasOpenedVersionHistory, setHasOpenedVersionHistory] = useState(false);
  const hasTranscript = useHasTranscript(sessionId);
  const currentNoteHasContent = useCurrentNoteHasContent(
    sessionId,
    currentView,
  );
  const { audioExists, audioExistsResolved, requestDeleteRecording } =
    useAudioPlayer();
  const { canCopyTranscript, copyTranscript } = useCopyTranscript(sessionId);
  const { uploadAudio, uploadTranscript } = useUploadFile(sessionId);
  const regenerateTranscript = useRegenerateTranscript(sessionId);
  const sessionMode = useListener((state) => state.getSessionMode(sessionId));
  const floatingBarEnabled = useConfigValue("floating_bar_enabled");
  const floatingBarSupported = isFloatingBarSupported();
  const isMeetingInProgress =
    sessionMode === "active" || sessionMode === "finalizing";
  const showListeningAction = allowListening;
  const showRetranscribeAction =
    audioExistsResolved && sessionMode === "inactive" && audioExists;
  const showUploadActions =
    audioExistsResolved &&
    !audioExists &&
    !hasTranscript &&
    !currentNoteHasContent &&
    !isMeetingInProgress;
  const canOpenFloatingPanel =
    floatingBarSupported &&
    allowListening &&
    floatingBarEnabled &&
    sessionMode === "active";
  const hasMeetingActions =
    canCopyTranscript ||
    showListeningAction ||
    showRetranscribeAction ||
    showUploadActions ||
    canOpenFloatingPanel;
  const openExportModal = () => {
    setOpen(false);
    setHasOpenedExportModal(true);
    requestAnimationFrame(() => setIsExportModalOpen(true));
  };
  const openVersionHistory = () => {
    setOpen(false);
    setHasOpenedVersionHistory(true);
    requestAnimationFrame(() => setIsVersionHistoryOpen(true));
  };
  const handleUploadAudio = () => {
    setOpen(false);
    uploadAudio();
  };
  const handleUploadTranscript = () => {
    setOpen(false);
    uploadTranscript();
  };
  const handleRetranscribe = () => {
    setOpen(false);
    void regenerateTranscript();
  };
  const handleOpenFloatingPanel = () => {
    setOpen(false);
    void openFloatingMeetingPanel({
      sessionId,
      enabled: floatingBarEnabled,
    });
  };
  const handleCopyTranscript = () => {
    setOpen(false);
    void copyTranscript();
  };
  const handleDeleteRecording = () => {
    setOpen(false);
    requestDeleteRecording();
  };
  const handleOpenStandaloneWindow = () => {
    setOpen(false);
    void openStandaloneNoteWindow(sessionId);
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            data-tauri-drag-region="false"
            aria-label={t`More`}
            className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-full [&_svg]:size-4"
          >
            <DotsThree className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent variant="app" align="end" className="w-56">
          <AppFloatingPanel className={appFloatingMenuPanelClassName}>
            {/* Fork: Meeting info moved to a header button, so Tab no longer gets trapped in a submenu (ux-audit-oct3 C, WCAG 2.1.1). */}
            <DropdownMenuItem
              onClick={openExportModal}
              className="cursor-pointer"
            >
              <FileArrowDown />
              <span>
                <Trans>Export…</Trans>
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={openVersionHistory}
              className="cursor-pointer"
            >
              <ClockCounterClockwise />
              <span>
                <Trans>Version history</Trans>
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {showListeningAction && (
              <Listening
                sessionId={sessionId}
                resume={audioExists || hasTranscript}
              />
            )}
            {showRetranscribeAction && (
              <DropdownMenuItem
                onClick={handleRetranscribe}
                className="cursor-pointer"
              >
                <ArrowsClockwise />
                <span>
                  <Trans>Transcribe again</Trans>
                </span>
              </DropdownMenuItem>
            )}
            {showUploadActions && (
              <>
                <DropdownMenuItem
                  onClick={handleUploadAudio}
                  className="cursor-pointer"
                >
                  <Waveform />
                  <span>
                    <Trans>Upload audio</Trans>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleUploadTranscript}
                  className="cursor-pointer"
                >
                  <FileText />
                  <span>
                    <Trans>Upload transcript</Trans>
                  </span>
                </DropdownMenuItem>
              </>
            )}
            {canOpenFloatingPanel && (
              <DropdownMenuItem
                onClick={handleOpenFloatingPanel}
                className="cursor-pointer"
              >
                <PictureInPicture />
                <span>
                  <Trans>Open floating panel</Trans>
                </span>
              </DropdownMenuItem>
            )}
            {/* Fork: Copy transcript and Delete recording were right-click only (ux-audit-oct3 C; HIG context menus). */}
            {canCopyTranscript && (
              <DropdownMenuItem
                onClick={handleCopyTranscript}
                className="cursor-pointer"
              >
                <Copy />
                <span>
                  <Trans>Copy transcript</Trans>
                </span>
              </DropdownMenuItem>
            )}
            {hasMeetingActions && <DropdownMenuSeparator />}
            {!standaloneWindow && (
              <DropdownMenuItem
                onClick={handleOpenStandaloneWindow}
                className="cursor-pointer"
              >
                <AppWindow />
                <span>
                  <Trans>Open in new window</Trans>
                </span>
              </DropdownMenuItem>
            )}
            <ShowInFolder sessionId={sessionId} />
            <LockNote sessionId={sessionId} />
            <DropdownMenuSeparator />
            {showRetranscribeAction && (
              <DropdownMenuItem
                onClick={handleDeleteRecording}
                className={cn([
                  "text-destructive cursor-pointer",
                  "hover:bg-destructive/10 hover:text-destructive",
                ])}
              >
                <Trash />
                <span>
                  <Trans>Delete recording</Trans>
                </span>
              </DropdownMenuItem>
            )}
            <DeleteNote sessionId={sessionId} />
          </AppFloatingPanel>
        </DropdownMenuContent>
      </DropdownMenu>
      {hasOpenedExportModal && (
        <ExportModal
          sessionId={sessionId}
          currentView={currentView}
          open={isExportModalOpen}
          onOpenChange={setIsExportModalOpen}
        />
      )}
      {hasOpenedVersionHistory && (
        <VersionHistoryDialog
          sessionId={sessionId}
          open={isVersionHistoryOpen}
          onOpenChange={setIsVersionHistoryOpen}
        />
      )}
    </>
  );
}
