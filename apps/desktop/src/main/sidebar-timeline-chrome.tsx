import { memo, type ReactNode } from "react";

import {
  MagnifyingGlass,
  NotePencil,
  Sidebar,
  SidebarSimple,
} from "@anlg/ui/components/icons";
import { cn } from "@anlg/utils";

import { useSidebarUpcomingMeetingStatus } from "~/sidebar/timeline/upcoming-meeting";

export const SidebarTimelineChromeWithUpcomingMeeting = memo(
  function SidebarTimelineChromeWithUpcomingMeeting({
    currentSessionId,
    onToggleSidebar,
    sidebarExpanded,
    showSidebarToggle = true,
    showIgnoredTimelineEvents,
  }: {
    currentSessionId?: string;
    onNewNote: () => void;
    onSearch: () => void;
    onToggleSidebar: () => void;
    sidebarExpanded: boolean;
    showSidebarToggle?: boolean;
    showIgnoredTimelineEvents: boolean;
  }) {
    const upcomingMeetingStatus = useSidebarUpcomingMeetingStatus({
      showIgnored: showIgnoredTimelineEvents,
    });
    const hasUpcomingMeeting = upcomingMeetingStatus
      ? !currentSessionId ||
        upcomingMeetingStatus.itemKey !== `session-${currentSessionId}`
      : false;

    return (
      <SidebarTimelineChrome
        hasUpcomingMeeting={hasUpcomingMeeting}
        onToggleSidebar={onToggleSidebar}
        sidebarExpanded={sidebarExpanded}
        showSidebarToggle={showSidebarToggle}
      />
    );
  },
);

function SidebarTimelineChrome({
  hasUpcomingMeeting,
  onToggleSidebar,
  sidebarExpanded,
  showSidebarToggle,
}: {
  hasUpcomingMeeting: boolean;
  onToggleSidebar: () => void;
  sidebarExpanded: boolean;
  showSidebarToggle: boolean;
}) {
  const collapsedBadge = !sidebarExpanded
    ? hasUpcomingMeeting
      ? "upcomingMeeting"
      : null
    : null;

  return (
    <div data-tauri-drag-region className="flex w-full items-center">
      <div data-tauri-drag-region className="flex items-center gap-0">
        {showSidebarToggle && (
          <LeftSurfaceChromeButton
            ariaLabel={
              sidebarExpanded
                ? "Hide sidebar"
                : // Fork: the badge is said, not only shown (ux-audit-oct3 B,
                  // WCAG 1.4.1).
                  collapsedBadge
                  ? "Show sidebar, meeting coming up"
                  : "Show sidebar"
            }
            badge={collapsedBadge}
            onClick={onToggleSidebar}
          >
            {sidebarExpanded ? (
              <SidebarSimple size={16} />
            ) : (
              <Sidebar size={16} />
            )}
          </LeftSurfaceChromeButton>
        )}
        {/* Fork: Search moved into the sidebar nav and "New note" is the
            orange button top right (Granola 101: the sidebar top holds only
            the toggle), so the chrome row keeps just the sidebar toggle. */}
      </div>
    </div>
  );
}

export function SidebarNoteActions({
  onNewNote,
  onSearch,
}: {
  onNewNote: () => void;
  onSearch: () => void;
}) {
  return (
    <>
      <LeftSurfaceChromeButton ariaLabel="Search" onClick={onSearch}>
        <MagnifyingGlass size={15} />
      </LeftSurfaceChromeButton>
      <LeftSurfaceChromeButton ariaLabel="New note" onClick={onNewNote}>
        <NotePencil size={15} />
      </LeftSurfaceChromeButton>
      {/* Fork: the sort/group filter only applied to the sidebar timeline,
          which is hidden (sidebar/index.tsx). */}
    </>
  );
}

export function LeftSurfaceChromeButton({
  ariaLabel,
  badge = null,
  children,
  disabled = false,
  onClick,
}: {
  ariaLabel: string;
  badge?: "upcomingMeeting" | null;
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      data-tauri-drag-region="false"
      disabled={disabled}
      className={cn([
        "pointer-events-auto relative flex size-7 items-center justify-center rounded-full",
        "text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-hidden",
        "disabled:text-muted-foreground/70 disabled:hover:text-muted-foreground/70 disabled:hover:bg-transparent",
      ])}
      onClick={onClick}
    >
      {children}
      {badge ? (
        <span
          aria-hidden="true"
          data-testid="collapsed-sidebar-upcoming-meeting-badge"
          // Fork: the one accent, not red (ux-audit-oct3 B; red is for
          // errors and Stop, design-system.md).
          className="ring-background bg-primary pointer-events-none absolute top-1 right-1 size-1.5 rounded-full ring-2"
        />
      ) : null}
    </button>
  );
}
