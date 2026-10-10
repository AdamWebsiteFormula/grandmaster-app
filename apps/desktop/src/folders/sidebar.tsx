import { Trans, useLingui } from "@lingui/react/macro";
import { useMemo, useState } from "react";

import {
  Buildings,
  FolderSimple,
  MagnifyingGlass,
  Plus,
  X,
} from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";
import { useSquircleRef } from "@anlg/ui/hooks/use-squircle";
import { cn } from "@anlg/utils";

import { useActiveFolderPath, useFolderSelection } from "./selection";

import { useOptionalAuth } from "~/auth";
import {
  importSharedFolder,
  parseSharedFolderPayload,
  SharedResourceLibrarySection,
} from "~/resource-sharing";
import { createNamedFolder } from "~/session/folder-catalog";
import { resolvedFolderIcon } from "~/session/folder-icon";
import {
  useFolderIcons,
  useFolderPaths,
  useFolderWorkspaces,
} from "~/session/queries";
import { CustomSidebarHeader } from "~/sidebar/custom-sidebar-header";
import { FolderNameDialog } from "~/sidebar/folder-name-dialog";
import { TemplateIconGlyph } from "~/templates/template-icon";

export function FoldersSidebar() {
  const { t } = useLingui();
  const auth = useOptionalAuth();
  const folders = useFolderPaths();
  const persistedIcons = useFolderIcons();
  const folderWorkspaces = useFolderWorkspaces();
  const iconOverrides = useFolderSelection((state) => state.iconOverrides);
  const setSelectedPath = useFolderSelection((state) => state.setSelectedPath);
  const activeFolder = useActiveFolderPath(folders);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useSquircleRef<HTMLDivElement>();

  const filteredFolders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return folders;
    }
    return folders.filter((folder) => folder.toLowerCase().includes(query));
  }, [folders, search]);

  const isEmpty = filteredFolders.length === 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div>
        <CustomSidebarHeader>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground relative z-[60]"
            aria-label={t`New folder`}
            // Fork: a help tag on the icon-only button, as Back has (Apple HIG
            // Offering help).
            title={t`New folder`}
            onClick={() => setCreating(true)}
          >
            <Plus size={16} />
          </Button>
        </CustomSidebarHeader>

        {/* Fork: no search box until there are folders to search (NN/g #8);
            text fields use border-input (design-system.md). */}
        {folders.length > 0 ? (
          <div className="pb-2">
            <div
              ref={searchRef}
              className={cn([
                "border-input bg-accent/50 flex h-8 w-full shrink-0 items-center gap-2 rounded-lg border px-3",
                "focus-within:bg-accent transition-colors",
              ])}
            >
              <MagnifyingGlass className="text-muted-foreground h-4 w-4 shrink-0" />
              <input
                aria-label={t`Search folders`}
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setSearch("");
                  }
                  // Fork: Return opens the top match, as Settings search
                  // does (picker sweep, Oct 10; NN/g #4).
                  if (
                    event.key === "Enter" &&
                    !event.nativeEvent.isComposing &&
                    search.trim() &&
                    filteredFolders[0]
                  ) {
                    event.preventDefault();
                    setSelectedPath(filteredFolders[0]);
                  }
                }}
                placeholder={t`Search folders`}
                className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm placeholder:text-sm focus:outline-hidden"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className={cn([
                    // Fork: a 24 px target (WCAG 2.2 SC 2.5.8).
                    "-mr-2 flex size-6 shrink-0 items-center justify-center rounded",
                    "text-muted-foreground hover:text-foreground",
                    "transition-colors",
                  ])}
                  aria-label={t`Clear search`}
                  title={t`Clear search`}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto pt-1">
        {/* Fork: with no folders at all, the main panel already shows the
            empty state and New folder, so the sidebar shows only a search
            with no match (NN/g #8; NN/g "Designing Empty States in Complex
            Applications"); round 6 visual review. */}
        {isEmpty && folders.length > 0 ? (
          <div className="text-muted-foreground px-3 py-8 text-center">
            <FolderSimple
              size={32}
              className="text-muted-foreground/70 mx-auto mb-2"
            />
            <p className="text-sm">
              <Trans>No folders found</Trans>
            </p>
          </div>
        ) : (
          <ul className="flex flex-col">
            {filteredFolders.map((folder) => {
              const selected = folder === activeFolder;
              return (
                <li key={folder}>
                  <button
                    type="button"
                    aria-label={folder}
                    aria-current={selected ? "page" : undefined}
                    onClick={() => setSelectedPath(folder)}
                    className={cn([
                      "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors select-none",
                      selected
                        ? "bg-accent font-medium"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    ])}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <TemplateIconGlyph
                        icon={resolvedFolderIcon(
                          folder,
                          persistedIcons,
                          iconOverrides,
                        )}
                        className="size-4 text-sm"
                      />
                      {/* Fork: full name on hover (ux-audit-oct3 B, WCAG 1.3.1). */}
                      <span title={folder} className="min-w-0 truncate">
                        {folder}
                      </span>
                      {folderWorkspaces[folder]?.workspaceId ? (
                        <span
                          className="text-muted-foreground shrink-0"
                          title={folderWorkspaces[folder]?.name || undefined}
                        >
                          <Buildings className="size-3.5" aria-hidden="true" />
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <SharedResourceLibrarySection
          resourceType="folder"
          search={search}
          onImport={async (resource) => {
            const userId = auth?.session?.user.id;
            if (!userId) throw new Error(t`Sign in to add this folder`);
            const path = await importSharedFolder(
              parseSharedFolderPayload(resource.payload),
              userId,
            );
            setSelectedPath(path);
          }}
        />
      </div>

      <FolderNameDialog
        open={creating}
        title={t`New folder`}
        confirmLabel={t`Create`}
        onOpenChange={setCreating}
        onSubmit={async (path) => {
          const created = await createNamedFolder(path);
          setSelectedPath(created);
        }}
      />
    </div>
  );
}
