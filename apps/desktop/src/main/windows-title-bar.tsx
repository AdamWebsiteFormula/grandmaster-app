import { t } from "@lingui/core/macro";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useRef } from "react";

import { commands as openerCommands } from "@anlg/plugin-opener2";
import { ArrowLeft, Sidebar, SidebarSimple } from "@anlg/ui/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@anlg/ui/components/ui/dropdown-menu";
import { cn } from "@anlg/utils";

import {
  LeftSurfaceChromeButton,
  SidebarNoteActions,
} from "./sidebar-timeline-chrome";
import { WindowsWindowControls } from "./windows-window-controls";

import { useShell } from "~/contexts/shell";
import { usesTitleBarSidebarActions } from "~/shared/hooks/useWindowControlsGutter";
import { useOpenNoteDialog } from "~/shared/open-note-dialog";
import { runtimePlatform } from "~/shared/shortcut-label";
import { useNewNote, useNewNoteAndListen } from "~/shared/useNewNote";
import {
  TITLE_BAR_SIDEBAR_ACTIONS_SLOT_ID,
  useCustomSidebarBack,
} from "~/sidebar/custom-sidebar-header";
import { useSidebarUpcomingMeetingStatus } from "~/sidebar/timeline/upcoming-meeting";
import { hasCustomSidebarTab } from "~/sidebar/use-custom-sidebar";
import { useTabs } from "~/store/zustand/tabs";

const appWindow = getCurrentWindow();

export function WindowsTitleBar({
  showSidebarTimelineChrome,
}: {
  showSidebarTimelineChrome: boolean;
}) {
  const { leftsidebar } = useShell();
  const currentTab = useTabs((state) => state.currentTab);
  const openNew = useTabs((state) => state.openNew);
  const createNewNote = useNewNote();
  const newNoteAndListen = useNewNoteAndListen();
  const openNoteDialog = useOpenNoteDialog();
  const upcomingMeetingStatus = useSidebarUpcomingMeetingStatus();
  const goBack = useCustomSidebarBack();
  const showBackButton = hasCustomSidebarTab(currentTab);
  const editTargetRef = useRef<HTMLElement | null>(null);
  const currentSessionId =
    currentTab?.type === "sessions" ? currentTab.id : undefined;
  const showUpcomingMeetingBadge =
    !leftsidebar.expanded &&
    !!upcomingMeetingStatus &&
    (!currentSessionId ||
      upcomingMeetingStatus.itemKey !== `session-${currentSessionId}`);

  const rememberEditTarget = useCallback(() => {
    editTargetRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  }, []);
  const runEditCommand = useCallback((command: string) => {
    const editTarget = editTargetRef.current;
    if (editTarget?.isConnected) {
      editTarget.focus();
    }

    document.execCommand(command);
  }, []);
  const toggleFullscreen = useCallback(async () => {
    const isFullscreen = await appWindow.isFullscreen();
    await appWindow.setFullscreen(!isFullscreen);
  }, []);
  return (
    <header
      data-tauri-drag-region
      data-testid="windows-title-bar"
      className="bg-background flex h-10 shrink-0 items-stretch"
    >
      <div
        data-tauri-drag-region
        className="flex min-w-0 flex-1 items-center pl-2"
      >
        {showBackButton ? (
          <>
            <LeftSurfaceChromeButton
              ariaLabel={t`Back`}
              label={t`Back`}
              onClick={goBack}
            >
              <ArrowLeft size={16} />
            </LeftSurfaceChromeButton>
            <div
              id={TITLE_BAR_SIDEBAR_ACTIONS_SLOT_ID}
              data-tauri-drag-region="false"
              className="flex items-center"
            />
          </>
        ) : (
          <LeftSurfaceChromeButton
            ariaLabel={leftsidebar.expanded ? t`Hide sidebar` : t`Show sidebar`}
            badge={showUpcomingMeetingBadge ? "upcomingMeeting" : null}
            onClick={leftsidebar.toggleExpanded}
          >
            {leftsidebar.expanded ? (
              <SidebarSimple size={16} />
            ) : (
              <Sidebar size={16} />
            )}
          </LeftSurfaceChromeButton>
        )}
        {usesTitleBarSidebarActions() &&
        showSidebarTimelineChrome &&
        leftsidebar.expanded ? (
          <SidebarNoteActions
            onNewNote={createNewNote}
            onSearch={openNoteDialog.open}
          />
        ) : null}
        <nav
          aria-label={t`Application menu`}
          className="ml-2 flex h-full items-center"
          role="menubar"
        >
          {/* Fork: each item names the key that really does it (Microsoft
              Writing Style Guide, Keys and keyboard shortcuts): Ctrl+N
              records and Ctrl+Shift+N makes a blank note, as in the Mac's
              File menu (useMainShortcuts; NN/g #4). Settings and Full screen
              have no key here, so they show none (NN/g #5). Sentence case,
              as Windows 11 Notepad's menus. */}
          <TitleBarMenu label={t`File`} onPointerDown={rememberEditTarget}>
            <DropdownMenuItem onSelect={newNoteAndListen}>
              {t`Record meeting`}
              <DropdownMenuShortcut>Ctrl+N</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={createNewNote}>
              {t`Blank note`}
              <DropdownMenuShortcut>Ctrl+Shift+N</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                openNew({ type: "settings", state: { tab: "app" } })
              }
            >
              {t`Settings`}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void appWindow.close()}>
              {t`Close`}
              <DropdownMenuShortcut>Alt+F4</DropdownMenuShortcut>
            </DropdownMenuItem>
          </TitleBarMenu>
          <TitleBarMenu label={t`Edit`} onPointerDown={rememberEditTarget}>
            <DropdownMenuItem onSelect={() => runEditCommand("undo")}>
              {t`Undo`}
              <DropdownMenuShortcut>Ctrl+Z</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => runEditCommand("redo")}>
              {t`Redo`}
              {/* Fork: Linux redoes with Ctrl+Shift+Z (GNOME HIG, Keyboard
                  shortcuts); Ctrl+Y is the Windows key. */}
              <DropdownMenuShortcut>
                {runtimePlatform() === "linux" ? "Ctrl+Shift+Z" : "Ctrl+Y"}
              </DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => runEditCommand("cut")}>
              {t`Cut`}
              <DropdownMenuShortcut>Ctrl+X</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => runEditCommand("copy")}>
              {t`Copy`}
              <DropdownMenuShortcut>Ctrl+C</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => runEditCommand("paste")}>
              {t`Paste`}
              <DropdownMenuShortcut>Ctrl+V</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => runEditCommand("selectAll")}>
              {t`Select all`}
              <DropdownMenuShortcut>Ctrl+A</DropdownMenuShortcut>
            </DropdownMenuItem>
          </TitleBarMenu>
          <TitleBarMenu label={t`View`} onPointerDown={rememberEditTarget}>
            <DropdownMenuItem onSelect={leftsidebar.toggleExpanded}>
              {leftsidebar.expanded ? t`Hide sidebar` : t`Show sidebar`}
              <DropdownMenuShortcut>Ctrl+\</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void toggleFullscreen()}>
              {t`Full screen`}
            </DropdownMenuItem>
          </TitleBarMenu>
          <TitleBarMenu label={t`Help`} onPointerDown={rememberEditTarget}>
            <DropdownMenuItem
              onSelect={() =>
                void openerCommands.openUrl(
                  "https://github.com/AdamWebsiteFormula/grandmaster-app",
                  null,
                )
              }
            >
              {t`Documentation`}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() =>
                void openerCommands.openUrl(
                  "https://github.com/AdamWebsiteFormula/grandmaster-app",
                  null,
                )
              }
            >
              {t`Report a bug`}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                void openerCommands.openUrl(
                  "https://github.com/AdamWebsiteFormula/grandmaster-app",
                  null,
                )
              }
            >
              {t`Suggest a feature`}
            </DropdownMenuItem>
          </TitleBarMenu>
        </nav>
        <div data-tauri-drag-region className="min-w-4 flex-1" />
      </div>
      <WindowsWindowControls />
    </header>
  );
}

function TitleBarMenu({
  children,
  label,
  onPointerDown,
}: {
  children: React.ReactNode;
  label: string;
  onPointerDown: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-tauri-drag-region="false"
          role="menuitem"
          className={cn([
            "text-muted-foreground h-7 rounded-md px-2.5 text-sm",
            "hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-hidden",
          ])}
          onPointerDown={onPointerDown}
        >
          {label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={1}
        className="w-56 rounded-lg"
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
