// Fork: the sidebar is navigation, not a note list (Granola 101,
// docs.granola.ai/help-center/getting-started/granola-101: the sidebar holds
// Search, Home and Chat, then Spaces; notes are listed on Home, grouped by
// day). Every note stays one step away: Home lists them all, Search opens the
// ⌘K dialog, and each folder opens its notes.
import { Trans, useLingui } from "@lingui/react/macro";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import {
  ChatCircle,
  FolderSimple,
  House,
  MagnifyingGlass,
} from "@anlg/ui/components/icons";
import { cn } from "@anlg/utils";

import { ShortcutTooltip } from "./shortcut-tooltip";

import { useFolderSelection } from "~/folders/selection";
import { resolvedFolderIcon } from "~/session/folder-icon";
import { useFolderIcons, useFolderPaths } from "~/session/queries";
import { useOpenNoteDialog } from "~/shared/open-note-dialog";
import { useTabs } from "~/store/zustand/tabs";
import { TemplateIconGlyph } from "~/templates/template-icon";

const NAV_ITEM_CLASS =
  "flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-hidden";

export function SidebarHomeNav() {
  const { t } = useLingui();
  const currentTab = useTabs((state) => state.currentTab);
  const openNew = useTabs((state) => state.openNew);
  const openNoteDialog = useOpenNoteDialog();
  const folders = useFolderPaths();
  const persistedIcons = useFolderIcons();
  const iconOverrides = useFolderSelection((state) => state.iconOverrides);
  const setSelectedPath = useFolderSelection((state) => state.setSelectedPath);

  const goHome = () => {
    const { tabs, select, openCurrent } = useTabs.getState();
    const home = tabs.find((tab) => tab.type === "empty");
    if (home) {
      select(home);
    } else {
      openCurrent({ type: "empty" });
    }
  };

  // Fork: one Chat page, like Home (granola-compare-oct3 section 6).
  const openChatPage = () => {
    const { tabs, select, openCurrent } = useTabs.getState();
    const chatTab = tabs.find((tab) => tab.type === "chat");
    if (chatTab) {
      select(chatTab);
    } else {
      openCurrent({ type: "chat" });
    }
  };

  // Same entry as "See all folders" in the note's folder picker.
  const openFolder = (folder: string | null) => {
    if (folder) setSelectedPath(folder);
    openNew({ type: "folders" });
  };

  return (
    <nav
      aria-label={t`Main`}
      className="scrollbar-hide flex h-full min-h-0 flex-col gap-0.5 overflow-y-auto pt-2"
    >
      <NavItem
        icon={<House size={16} />}
        active={currentTab?.type === "empty"}
        onClick={goHome}
      >
        <Trans>Home</Trans>
      </NavItem>
      <ShortcutTooltip label={t`Search`} keys="⌘ K">
        <NavItem
          icon={<MagnifyingGlass size={16} />}
          onClick={() => openNoteDialog.open()}
          keyShortcuts="Meta+K"
        >
          <Trans>Search</Trans>
        </NavItem>
      </ShortcutTooltip>
      <NavItem
        icon={<ChatCircle size={16} />}
        active={currentTab?.type === "chat"}
        onClick={openChatPage}
      >
        <Trans>Chat</Trans>
      </NavItem>
      <NavItem
        icon={<FolderSimple size={16} />}
        onClick={() => openFolder(null)}
      >
        <Trans>Folders</Trans>
      </NavItem>
      {folders.length > 0 ? (
        <ul className="flex flex-col gap-0.5 pl-3">
          {folders.map((folder) => (
            <li key={folder}>
              <NavItem
                icon={
                  <TemplateIconGlyph
                    icon={resolvedFolderIcon(
                      folder,
                      persistedIcons,
                      iconOverrides,
                    )}
                    className="size-4 text-sm"
                  />
                }
                onClick={() => openFolder(folder)}
              >
                {/* Fork: full name on hover (ux-audit-oct3 B, WCAG 1.3.1). */}
                <span title={folder} className="min-w-0 truncate">
                  {folder}
                </span>
              </NavItem>
            </li>
          ))}
        </ul>
      ) : null}
    </nav>
  );
}

function NavItem({
  icon,
  active = false,
  keyShortcuts,
  onClick,
  children,
  ...rest
}: {
  icon: ReactNode;
  active?: boolean;
  keyShortcuts?: string;
  onClick: () => void;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "children">) {
  return (
    <button
      {...rest}
      type="button"
      aria-current={active ? "page" : undefined}
      aria-keyshortcuts={keyShortcuts}
      onClick={onClick}
      className={cn([
        NAV_ITEM_CLASS,
        active
          ? "bg-sidebar-accent text-foreground font-medium"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      ])}
    >
      <span className="flex size-4 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 items-center">{children}</span>
    </button>
  );
}
