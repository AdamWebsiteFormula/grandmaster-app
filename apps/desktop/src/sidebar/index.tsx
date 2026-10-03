import { Trans } from "@lingui/react/macro";
import { type ReactNode } from "react";

import { Gear } from "@anlg/ui/components/icons";
import { Kbd } from "@anlg/ui/components/ui/kbd";
import { cn } from "@anlg/utils";

import { AutomationsNav } from "./automations";
import { CalendarNav } from "./calendar";
import { ContactsNav } from "./contacts";
import { FolderMaterialsPanel } from "./folder-materials";
import { FoldersNav } from "./folders";
import { SidebarHomeNav } from "./home-nav";
import type { SidebarNoteFilter } from "./note-filter";
import { SettingsNav } from "./settings";
import { SharedNotesNav } from "./shared-notes";
import { TemplatesNav } from "./templates";
import { TimelineView } from "./timeline";
import { hasOwnSidebarHeaderTab } from "./use-custom-sidebar";

import { usesTitleBarSidebarActions } from "~/shared/hooks/useWindowControlsGutter";
import { useTabs } from "~/store/zustand/tabs";

// Fork (Granola 101, docs.granola.ai/help-center/getting-started/granola-101):
// the sidebar is navigation; notes are listed on Home, grouped by day. The
// date-grouped timeline is kept behind this switch, not deleted.
const SHOW_SIDEBAR_TIMELINE = false;

export function LeftSidebar({
  folderFilter = null,
  noteFilter = "mine",
  timelineHeader,
  showIgnoredTimelineEvents,
  onShowIgnoredTimelineEventsChange,
}: {
  folderFilter?: string | null;
  noteFilter?: SidebarNoteFilter;
  timelineHeader?: ReactNode;
  showIgnoredTimelineEvents?: boolean;
  onShowIgnoredTimelineEventsChange?: (showIgnored: boolean) => void;
} = {}) {
  const currentTab = useTabs((state) => state.currentTab);
  const openNew = useTabs((state) => state.openNew);

  const isSettingsMode = currentTab?.type === "settings";
  const isCalendarMode = currentTab?.type === "calendar";
  const isContactsMode = currentTab?.type === "contacts";
  const isTemplatesMode = currentTab?.type === "templates";
  const isAutomationsMode = currentTab?.type === "automations";
  const isFoldersMode = currentTab?.type === "folders";
  const isSpecialMode =
    isSettingsMode ||
    isCalendarMode ||
    isContactsMode ||
    isTemplatesMode ||
    isAutomationsMode ||
    isFoldersMode;
  const isTimelineSidebarLayout = !isSpecialMode;
  // Navs with their own CustomSidebarHeader fill the chrome row themselves; a
  // top padding here would push the header out of it (and overflow-hidden
  // would clip a pulled-up header).
  const needsChromeRowGutter =
    isSpecialMode && !hasOwnSidebarHeaderTab(currentTab);
  return (
    <div
      className={cn([
        "flex h-full w-full shrink-0 flex-col gap-1 overflow-hidden",
        needsChromeRowGutter ? "pt-11" : "pt-0",
        !isTimelineSidebarLayout && "pr-1",
      ])}
    >
      <div className="flex flex-1 flex-col gap-1 overflow-hidden">
        {isTimelineSidebarLayout ? timelineHeader : null}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {isSettingsMode ? (
            <SettingsNav />
          ) : isCalendarMode ? (
            <CalendarNav />
          ) : isContactsMode ? (
            <ContactsNav />
          ) : isTemplatesMode ? (
            <TemplatesNav />
          ) : isAutomationsMode ? (
            <AutomationsNav />
          ) : isFoldersMode ? (
            <FoldersNav />
          ) : !SHOW_SIDEBAR_TIMELINE ? (
            <SidebarHomeNav />
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              {noteFilter === "mine" ? (
                <>
                  {folderFilter ? (
                    <FolderMaterialsPanel folderPath={folderFilter} />
                  ) : null}
                  <div className="relative min-h-0 flex-1">
                    <TimelineView
                      folderFilter={folderFilter}
                      showIgnoredEvents={showIgnoredTimelineEvents}
                      onShowIgnoredEventsChange={
                        onShowIgnoredTimelineEventsChange
                      }
                      topChromeInset={
                        isTimelineSidebarLayout &&
                        !timelineHeader &&
                        !usesTitleBarSidebarActions()
                      }
                      topChipsOverlapHeader={
                        isTimelineSidebarLayout && !!timelineHeader
                      }
                    />
                  </div>
                </>
              ) : (
                <SharedNotesNav />
              )}
            </div>
          )}
        </div>
      </div>
      {isTimelineSidebarLayout ? (
        // Fork (Glaido and Granola pattern): a visible Settings entry at the
        // bottom of the sidebar, so nobody has to know the shortcut.
        // Fork: same 12 px left inset as the note list; Kbd chip like home.
        <div className="shrink-0 pb-2">
          <button
            type="button"
            onClick={() => openNew({ type: "settings", state: { tab: "app" } })}
            className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
          >
            <Gear size={16} />
            <span className="flex-1 text-left">
              <Trans>Settings</Trans>
            </span>
            <Kbd>⌘ ,</Kbd>
          </button>
        </div>
      ) : null}
    </div>
  );
}
