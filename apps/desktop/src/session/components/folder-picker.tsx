import { useLingui } from "@lingui/react/macro";
import { useCallback, useMemo, useState } from "react";
import { create } from "zustand";

import { CaretRight, Check, Folder, Plus, X } from "@anlg/ui/components/icons";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@anlg/ui/components/ui/command";
import { Dialog, DialogTitle } from "@anlg/ui/components/ui/dialog";
import {
  AppFloatingPanel,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@anlg/ui/components/ui/popover";
import { toast } from "@anlg/ui/components/ui/toast";
import { useSquircleRef } from "@anlg/ui/hooks/use-squircle";
import { squircleFocusVisibleClassName } from "@anlg/ui/lib/squircle";
import { cn } from "@anlg/utils";

import { noteChipClassName } from "./note-input/header-shared";

import { useFolderSelection } from "~/folders/selection";
import { createNamedFolder } from "~/session/folder-catalog";
import { resolvedFolderIcon } from "~/session/folder-icon";
import { normalizeFolderPath } from "~/session/folders";
import {
  useFolderIcons,
  useFolderPaths,
  useSession,
  useUpdateSession,
} from "~/session/queries";
import {
  GlassDialogCancelButton,
  GlassDialogContent,
} from "~/shared/ui/glass-dialog";
import { useTabs } from "~/store/zustand/tabs";
import { TemplateIconGlyph } from "~/templates/template-icon";

const filterFolders = (value: string, search: string) => {
  const haystack = value.toLocaleLowerCase();
  const needle = search.toLocaleLowerCase();
  return haystack.includes(needle) ? 1 : 0;
};

export function FolderPicker({
  sessionId,
  align = "start",
  variant = "icon",
}: {
  sessionId: string;
  align?: "start" | "end";
  /** "chip": "Add to folder" in the row under the note title (Granola). */
  variant?: "icon" | "chip";
}) {
  const { t } = useLingui();
  const triggerRef = useSquircleRef<HTMLButtonElement>();
  const [open, setOpen] = useState(false);
  const currentPath = normalizeFolderPath(
    useSession(sessionId)?.folder_id ?? "",
  );
  const folderIcons = useFolderIcons();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === "chip" ? (
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-label={currentPath ? t`Folder: ${currentPath}` : undefined}
            title={currentPath || undefined}
            className={noteChipClassName(open)}
          >
            {currentPath ? (
              <TemplateIconGlyph
                icon={resolvedFolderIcon(currentPath, folderIcons)}
                className="size-3.5 shrink-0"
              />
            ) : (
              <Folder aria-hidden />
            )}
            <span className="min-w-0 truncate">
              {currentPath || t`Add to folder`}
            </span>
          </button>
        ) : (
          <button
            ref={triggerRef}
            type="button"
            data-tauri-drag-region="false"
            role="combobox"
            aria-expanded={open}
            aria-label={
              currentPath ? t`Folder: ${currentPath}` : t`Select folder`
            }
            title={currentPath ? currentPath : t`Select folder`}
            className={cn([
              "flex h-7 items-center rounded-full [&_svg]:size-4",
              currentPath
                ? "max-w-36 min-w-0 gap-1 px-1.5 @max-[480px]:w-7 @max-[480px]:gap-0 @max-[480px]:px-0"
                : "w-7 justify-center",
              "text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",
              squircleFocusVisibleClassName,
              open && "bg-accent text-foreground",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
            ])}
          >
            {currentPath ? (
              <TemplateIconGlyph
                icon={resolvedFolderIcon(currentPath, folderIcons)}
                className="size-4 shrink-0"
              />
            ) : (
              <Folder className="size-4 shrink-0" />
            )}
            {currentPath ? (
              <span className="text-muted-foreground min-w-0 truncate text-xs @max-[480px]:sr-only">
                {currentPath}
              </span>
            ) : null}
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        variant="app"
        align={align}
        className="w-56 overflow-hidden pb-0"
      >
        <FolderPickerContent
          sessionId={sessionId}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

// Fork: "Add to folder…" (Granola's word, as on the note chip) from a note's right-click menu on Home and in the
// sidebar opens this picker, as Granola rows offer Add to folder
// (journey-after P2 "Add note to folder from Home"; granola-compare-oct3
// "Home"; NN/g #7). The native menu can't hold React, so a store opens it.
export const useMoveToFolderDialog = create<{ sessionId: string | null }>(
  () => ({ sessionId: null }),
);

export function openMoveToFolderDialog(sessionId: string) {
  useMoveToFolderDialog.setState({ sessionId });
}

export function MoveToFolderDialog() {
  const { t } = useLingui();
  const sessionId = useMoveToFolderDialog((state) => state.sessionId);
  const close = useCallback(() => {
    useMoveToFolderDialog.setState({ sessionId: null });
  }, []);

  return (
    <Dialog
      open={sessionId !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      {sessionId ? (
        <GlassDialogContent className="gap-3">
          <DialogTitle className="text-base leading-normal font-semibold">
            {t`Add to folder`}
          </DialogTitle>
          <div className="border-border overflow-hidden rounded-xl border">
            <FolderPickerContent sessionId={sessionId} onClose={close} />
          </div>
          <GlassDialogCancelButton className="self-end" onClick={close}>
            {t`Cancel`}
          </GlassDialogCancelButton>
        </GlassDialogContent>
      ) : null}
    </Dialog>
  );
}

function FolderPickerContent({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const [query, setQuery] = useState("");
  const folderId = useSession(sessionId)?.folder_id ?? "";
  const folderPaths = useFolderPaths();
  const folderIcons = useFolderIcons();
  const updateSession = useUpdateSession(sessionId);
  const openNew = useTabs((state) => state.openNew);
  const setSelectedPath = useFolderSelection((state) => state.setSelectedPath);
  const currentPath = normalizeFolderPath(folderId) ?? "";
  const [highlighted, setHighlighted] = useState(currentPath);
  const folders = useMemo(() => {
    if (currentPath && !folderPaths.includes(currentPath)) {
      return collectWithCurrent(folderPaths, currentPath);
    }
    return folderPaths;
  }, [currentPath, folderPaths]);
  const trimmedQuery = query.trim();
  const normalizedQuery = normalizeFolderPath(trimmedQuery);
  const canCreateFolder =
    Boolean(normalizedQuery) && !folders.includes(normalizedQuery ?? "");
  const folderName = normalizedQuery ?? "";

  const handleSelect = useCallback(
    (nextFolderId: string) => {
      const normalized = normalizeFolderPath(nextFolderId);
      if (normalized === null) {
        return;
      }

      onClose();
      if (normalized === folderId) {
        return;
      }

      void (async () => {
        try {
          if (normalized && !folderPaths.includes(normalized)) {
            await createNamedFolder(normalized);
            setSelectedPath(normalized);
          }
          await updateSession({ folder_id: normalized });
          // Fork: unchecking the note's folder (Granola's way to remove)
          // happened with no word and no way back, and Enter right after
          // opening the picker did it. Say so, with Undo, as Delete note
          // does (task test, Oct 8; NN/g #3, #1).
          if (!normalized && folderId) {
            const previous = folderId;
            toast(t`Removed from “${previous}”`, {
              id: `folder-removed-${sessionId}`,
              action: {
                label: t`Undo`,
                onClick: () => {
                  void updateSession({ folder_id: previous });
                },
              },
            });
          }
        } catch (error) {
          console.error("[folder-picker] failed to update folder", error);
          // Fork: say it failed; the chip alone doesn't (journey-after P3
          // "Add note to folder, error"; NN/g #9).
          toast.error(t`Couldn't move the note. Try again.`);
        }
      })();
    },
    [
      folderId,
      folderPaths,
      onClose,
      sessionId,
      setSelectedPath,
      t,
      updateSession,
    ],
  );

  const handleSeeAllFolders = useCallback(() => {
    onClose();
    if (currentPath) {
      setSelectedPath(currentPath);
    }
    openNew({ type: "folders" });
  }, [currentPath, onClose, openNew, setSelectedPath]);

  return (
    <div className="flex flex-col">
      <AppFloatingPanel className="overflow-hidden">
        <Command
          filter={filterFolders}
          value={highlighted}
          onValueChange={setHighlighted}
          className="rounded-[inherit] border-0 bg-transparent **:[[cmdk-input-wrapper]]:h-8 **:[[cmdk-input-wrapper]]:px-2.5"
        >
          <CommandInput
            placeholder={t`Search or create folder`}
            value={query}
            onValueChange={setQuery}
            className="h-8 py-0"
          />
          <CommandList className="p-1">
            <CommandEmpty className="text-muted-foreground px-2.5 py-2 text-left text-sm">
              {trimmedQuery
                ? normalizedQuery === null
                  ? t`Enter a valid folder name.`
                  : t`No folders found.`
                : t`No folders yet.`}
            </CommandEmpty>
            {folders.length > 0 ? (
              <CommandGroup>
                {folders.map((path) => (
                  <CommandItem
                    key={path}
                    value={path}
                    onSelect={() =>
                      handleSelect(path === currentPath ? "" : path)
                    }
                    className="cursor-pointer"
                  >
                    <TemplateIconGlyph
                      icon={resolvedFolderIcon(path, folderIcons)}
                      className="size-4 opacity-70"
                    />
                    <span className="min-w-0 flex-1 truncate">{path}</span>
                    {path === currentPath ? (
                      <Check className="size-4 shrink-0" />
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {canCreateFolder && normalizedQuery ? (
              <CommandGroup>
                <CommandItem
                  value={`create-folder ${normalizedQuery}`}
                  onSelect={() => handleSelect(normalizedQuery)}
                  className="cursor-pointer"
                >
                  <Plus className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">
                    {/* Fork: curly quotes (journey-after P3 "Folder
                        picker"; Apple HIG typography). */}
                    {t`Create “${folderName}”`}
                  </span>
                </CommandItem>
              </CommandGroup>
            ) : null}
            {/* Fork: a visible way out of a folder, not only "click the
                checked one again" (journey-after P3 "Folder picker"; NN/g
                #6 recognition over recall). */}
            {currentPath && !trimmedQuery ? (
              <CommandGroup>
                <CommandItem
                  value="remove-from-folder"
                  onSelect={() => handleSelect("")}
                  className="cursor-pointer"
                >
                  <X className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">
                    {t`Remove from folder`}
                  </span>
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </AppFloatingPanel>
      <button
        type="button"
        onClick={handleSeeAllFolders}
        className={cn([
          "flex w-full items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium",
          "text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
        ])}
      >
        {t`See all folders`}
        <CaretRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function collectWithCurrent(folderPaths: string[], currentPath: string) {
  return [...folderPaths, currentPath].sort((left, right) =>
    left.localeCompare(right),
  );
}
