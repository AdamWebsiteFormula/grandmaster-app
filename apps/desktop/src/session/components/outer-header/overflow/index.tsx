import { Trans, useLingui } from "@lingui/react/macro";
import { useState } from "react";

import {
  AppWindow,
  ArrowsClockwise,
  ClockCounterClockwise,
  Copy,
  DotsThree,
  FileText,
  Microphone,
  PictureInPicture,
  Sparkle,
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@anlg/ui/components/ui/dropdown-menu";
import { cn } from "@anlg/utils";

import { AudioSavedMenuItem } from "../audio-saved";
import {
  menuContentClassName,
  menuTriggerFocusClassName,
  usePointerCloseAutoFocus,
} from "../menu-focus";
import { DeleteNote } from "./delete";
import { Listening } from "./listening";
import { LockNote } from "./lock-note";
import { ShowInFolder } from "./misc";

import { useAudioPlayer } from "~/audio-player";
import { openFloatingMeetingPanel } from "~/meeting-float/host";
import { isFloatingBarSupported } from "~/meeting-float/support";
import {
  useGenerateSummaryAction,
  useGenerateSummaryOffer,
} from "~/session/components/note-input/generate-summary-offer";
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
  const menuFocus = usePointerCloseAutoFocus();
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
  // Fork: Generate summary also lives in ⋯, so a note with no summary always
  // has a way to make one (Granola 101: enhance after the meeting; NN/g #3).
  const summaryOffer = useGenerateSummaryOffer(sessionId);
  const { generate: generateSummary } = useGenerateSummaryAction(sessionId);
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
  const handleGenerateSummary = () => {
    setOpen(false);
    void generateSummary();
  };
  const handleOpenStandaloneWindow = () => {
    setOpen(false);
    void openStandaloneNoteWindow(sessionId);
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild {...menuFocus.triggerProps}>
          <Button
            size="icon"
            variant="ghost"
            data-tauri-drag-region="false"
            aria-label={t`More`}
            title={t`More`}
            className={cn([
              "text-muted-foreground hover:bg-accent hover:text-foreground rounded-full [&_svg]:size-4",
              menuTriggerFocusClassName,
              open && "bg-accent text-foreground",
            ])}
          >
            <DotsThree className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          variant="app"
          align="end"
          sideOffset={6}
          className={cn([menuContentClassName, "w-56"])}
          {...menuFocus.contentProps}
        >
          <AppFloatingPanel className={appFloatingMenuPanelClassName}>
            {/* Fork: sharing (copy, email, export) lives in Share only, so
                each action has one home (redline-oct3, H2). Then the note,
                the recording in one submenu, and Delete note last in red
                after a separator (Granola's note menu; Apple HIG, Menus). */}
            {summaryOffer.visible && (
              <>
                <DropdownMenuItem
                  onClick={handleGenerateSummary}
                  className="cursor-pointer"
                >
                  <Sparkle />
                  <span>
                    <Trans>Generate summary</Trans>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              onClick={openVersionHistory}
              className="cursor-pointer"
            >
              <ClockCounterClockwise />
              <span>
                <Trans>Version history</Trans>
              </span>
            </DropdownMenuItem>
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
            {hasMeetingActions && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="cursor-pointer">
                    <Microphone />
                    <span>
                      <Trans>Recording</Trans>
                    </span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent
                    variant="app"
                    className={cn([menuContentClassName, "w-56"])}
                    sideOffset={6}
                  >
                    <AppFloatingPanel className={appFloatingMenuPanelClassName}>
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
                      {showRetranscribeAction && (
                        <>
                          <AudioSavedMenuItem onSelect={() => setOpen(false)} />
                          <DropdownMenuSeparator />
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
                        </>
                      )}
                    </AppFloatingPanel>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </>
            )}
            <DropdownMenuSeparator />
            <DeleteNote sessionId={sessionId} />
          </AppFloatingPanel>
        </DropdownMenuContent>
      </DropdownMenu>
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
