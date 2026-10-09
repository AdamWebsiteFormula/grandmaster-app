import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { DotsThree, Plus } from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@anlg/ui/components/ui/dialog";
import {
  AppFloatingPanel,
  appFloatingMenuPanelClassName,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@anlg/ui/components/ui/dropdown-menu";
import { Input } from "@anlg/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@anlg/ui/components/ui/select";
import { toast } from "@anlg/ui/components/ui/toast";
import { cn } from "@anlg/utils";

import { FolderAskComposer } from "./folder-ask";
import { FolderMaterialTile } from "./folder-material-tile";
import { FolderNotes } from "./folder-notes";
import { useFolderNoteCount } from "./folder-stats";
import { useFolderSelection } from "./selection";

import { useOptionalAuth } from "~/auth";
import { HOME_COLUMN_CLASS } from "~/home/home-view";
import { ResourceShareButton, sharedFolderPayload } from "~/resource-sharing";
import {
  deleteSharedResource,
  moveSharedResource,
  requireResourceSharingContext,
} from "~/resource-sharing/client";
import {
  sharedResourcesQueryKey,
  useSharedResources,
} from "~/resource-sharing/hooks";
import {
  useAvailableShareWorkspaces,
  usePersonalWorkspaceId,
} from "~/session-sharing/source";
import {
  deleteLocalFolderMaterial,
  diskAttachmentId,
  useFolderMaterials,
} from "~/session/folder-attachments";
import {
  deleteNamedFolder,
  renameNamedFolder,
  updateFolderIcon,
  updateFolderWorkspace,
  useFolderInstructions,
  useFolderWorkspaceId,
} from "~/session/folder-catalog";
import { resolvedFolderIcon } from "~/session/folder-icon";
import { FolderInstructionsField } from "~/session/folder-instructions";
import { folderDisplayName, normalizeFolderPath } from "~/session/folders";
import { useFolderIcons } from "~/session/queries";
import { useFolderMaterialUpload } from "~/shared/hooks/useFileUpload";
import { DestructiveConfirmationDialog } from "~/shared/ui/destructive-confirmation-dialog";
import { FolderNameDialog } from "~/sidebar/folder-name-dialog";
import { TemplateIconPicker } from "~/templates/template-icon-picker";

const PERSONAL_WORKSPACE_VALUE = "__personal__";

export function FolderEditor({ folderPath }: { folderPath: string }) {
  const { t } = useLingui();
  const auth = useOptionalAuth();
  const accountUserId = auth?.session?.user.id ?? null;
  const availableWorkspaces = useAvailableShareWorkspaces(accountUserId);
  const personalWorkspaceId = usePersonalWorkspaceId(accountUserId);
  const queryClient = useQueryClient();
  const sharedFolders = useSharedResources("folder");
  const ownedShare = sharedFolders.data?.find(
    (resource) =>
      resource.accessKind === "owner" && resource.sourceId === folderPath,
  );
  const setSelectedPath = useFolderSelection((state) => state.setSelectedPath);
  const markFolderDeleted = useFolderSelection(
    (state) => state.markFolderDeleted,
  );
  const persistedIcons = useFolderIcons();
  const iconOverrides = useFolderSelection((state) => state.iconOverrides);
  const setIconOverride = useFolderSelection((state) => state.setIconOverride);
  const clearIconOverride = useFolderSelection(
    (state) => state.clearIconOverride,
  );
  const rekeyIconOverride = useFolderSelection(
    (state) => state.rekeyIconOverride,
  );
  const icon = resolvedFolderIcon(folderPath, persistedIcons, iconOverrides);
  const materials = useFolderMaterials(folderPath);
  const noteCount = useFolderNoteCount(folderPath);
  const description = useFolderInstructions(folderPath).trim().split("\n")[0];
  const upload = useFolderMaterialUpload(folderPath);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipTitleCommit = useRef(false);
  const [busy, setBusy] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  // Fork: Rename… or Delete… from the folder's right-click menu in the
  // sidebar opens the same dialog as Folder actions here.
  const pendingAction = useFolderSelection((state) => state.pendingAction);
  const clearFolderAction = useFolderSelection(
    (state) => state.clearFolderAction,
  );
  useEffect(() => {
    if (!pendingAction || pendingAction.path !== folderPath) return;
    if (pendingAction.action === "rename") setRenaming(true);
    else setDeleting(true);
    clearFolderAction();
  }, [pendingAction, folderPath, clearFolderAction]);
  const [removingMaterial, setRemovingMaterial] = useState<{
    filename: string;
    relativePath: string;
  } | null>(null);
  const [workspaceConfirmation, setWorkspaceConfirmation] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const folderWorkspaceId = useFolderWorkspaceId(folderPath);
  const selectedWorkspaceValue = availableWorkspaces.some(
    (workspace) => workspace.id === folderWorkspaceId,
  )
    ? folderWorkspaceId
    : PERSONAL_WORKSPACE_VALUE;
  const workspaceMutation = useMutation({
    mutationFn: (workspaceId: string) =>
      updateFolderWorkspace(folderPath, workspaceId),
    onSuccess: () => setWorkspaceConfirmation(null),
  });
  const displayName = folderDisplayName(folderPath);
  const [draft, setDraft] = useState(displayName);

  // Throws on failure; callers say why (title field: toast, Rename dialog:
  // inline error).
  const renameTo = useCallback(
    async (normalizedName: string) => {
      const separatorIndex = folderPath.lastIndexOf("/");
      const parentPath =
        separatorIndex === -1 ? "" : folderPath.slice(0, separatorIndex);
      const renamedPath = parentPath
        ? `${parentPath}/${normalizedName}`
        : normalizedName;
      if (renamedPath === folderPath) {
        setDraft(displayName);
        return;
      }

      setBusy(true);
      try {
        const renamed = await renameNamedFolder(folderPath, renamedPath);
        if (ownedShare && auth) {
          try {
            await moveSharedResource(requireResourceSharingContext(auth), {
              shareId: ownedShare.shareId,
              sourceId: renamed,
              title: folderDisplayName(renamed),
              payload: await sharedFolderPayload(renamed),
            });
          } catch (error) {
            await renameNamedFolder(renamed, folderPath);
            throw error;
          }
          void queryClient.invalidateQueries({
            queryKey: sharedResourcesQueryKey(auth.session?.user.id, "folder"),
          });
        }
        rekeyIconOverride(folderPath, renamed);
        setSelectedPath(renamed);
      } finally {
        setBusy(false);
      }
    },
    [
      auth,
      displayName,
      folderPath,
      ownedShare,
      queryClient,
      rekeyIconOverride,
      setSelectedPath,
    ],
  );

  const commitTitle = useCallback(async () => {
    if (skipTitleCommit.current) {
      skipTitleCommit.current = false;
      setDraft(displayName);
      return;
    }

    // Fork: say why a rename failed instead of silently reverting
    // (ux-audit-oct3 B; NN/g #9). Same strings as the folder name dialog.
    const trimmed = draft.trim();
    const normalizedName = normalizeFolderPath(trimmed);
    if (!normalizedName || normalizedName.includes("/")) {
      setDraft(displayName);
      if (trimmed) toast.error(t`Enter a valid folder name.`);
      return;
    }

    try {
      await renameTo(normalizedName);
    } catch (cause) {
      setDraft(displayName);
      toast.error(
        String(cause instanceof Error ? cause.message : cause).includes(
          "folder_target_exists",
        )
          ? t`A folder with this name already exists.`
          : t`Could not save the folder.`,
      );
    }
  }, [displayName, draft, renameTo, t]);

  return (
    <section className="flex h-full flex-1 flex-col" aria-label={folderPath}>
      {/* Fork: pr-2 ends More on the note header's trailing edge, so it
          doesn't move between a note and a folder (picture review, Oct 9:
          4.5 pt; Apple HIG, Toolbars). */}
      <div className="flex h-12 items-center justify-end gap-3 pr-2 pl-3">
        <div className="flex items-center gap-0.5">
          <ResourceShareButton
            resourceType="folder"
            sourceId={folderPath}
            title={displayName}
            buildPayload={() => sharedFolderPayload(folderPath)}
          />
          <DropdownMenu open={actionsOpen} onOpenChange={setActionsOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={busy}
                className={cn([
                  "text-muted-foreground hover:text-foreground",
                  actionsOpen && "bg-muted text-foreground hover:bg-accent",
                ])}
                aria-label={t`Folder actions`}
              >
                <DotsThree className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent variant="app" align="end">
              <AppFloatingPanel className={appFloatingMenuPanelClassName}>
                {/* Fork: Rename in the actions menu (ux-audit-oct3 B; NN/g #6). */}
                <DropdownMenuItem
                  disabled={busy}
                  onClick={() => setRenaming(true)}
                  className="cursor-pointer"
                >
                  <Trans>Rename</Trans>
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={busy}
                  onClick={() => setDeleting(true)}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <Trans>Delete</Trans>
                </DropdownMenuItem>
              </AppFloatingPanel>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="scrollbar-soft flex-1 overflow-y-auto pb-6">
        {/* Fork: Home's column, so folder notes line up with Home's rows. */}
        <div className={cn([HOME_COLUMN_CLASS, "flex flex-col gap-8"])}>
          {/* Fork: a centered header like a Granola space: icon tile, large
              name, a short description and a counts line
              (granola-compare-oct3 section 7). */}
          <header className="flex flex-col items-center gap-2 pt-2 text-center">
            <TemplateIconPicker
              label={t`Choose folder icon`}
              value={icon}
              onChange={(nextIcon) => {
                setIconOverride(folderPath, nextIcon);
                void updateFolderIcon(folderPath, nextIcon).catch((error) => {
                  clearIconOverride(folderPath, nextIcon);
                  console.error("[folder-editor] failed to update icon", error);
                  toast.error(t`Couldn't change the icon. Try again.`);
                });
              }}
            />
            <div className="relative max-w-full min-w-0">
              <span
                aria-hidden="true"
                className="font-display invisible block px-1 py-0 text-2xl font-semibold tracking-[-0.01em] whitespace-pre"
              >
                {(draft || t`Folder name`) + " "}
              </span>
              <Input
                value={draft}
                disabled={busy}
                aria-label={t`Folder name`}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => {
                  void commitTitle();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                  if (event.key === "Escape") {
                    skipTitleCommit.current = true;
                    setDraft(displayName);
                    event.currentTarget.blur();
                  }
                }}
                placeholder={t`Folder name`}
                className="font-display absolute inset-0 h-auto w-full max-w-full min-w-0 border-0 px-1 py-0 text-center text-2xl font-semibold tracking-[-0.01em] shadow-none focus-visible:ring-0 md:text-2xl"
              />
            </div>
            <p className="text-muted-foreground line-clamp-2 max-w-[60ch] text-sm text-pretty">
              {description || t`Notes, files, and context for this folder.`}
            </p>
            {/* Fork: no "0 notes · 0 files" while the folder is empty; the
                empty sections below already say so (picture review, Oct 6;
                NN/g #8). */}
            {noteCount !== null && (noteCount > 0 || materials.length > 0) ? (
              <p className="text-muted-foreground text-sm tabular-nums">
                {[
                  noteCount === 1 ? t`1 note` : t`${noteCount} notes`,
                  materials.length === 1
                    ? t`1 file`
                    : t`${materials.length} files`,
                ].join(" · ")}
              </p>
            ) : null}
          </header>

          {noteCount ? <FolderAskComposer folderPath={folderPath} /> : null}

          <FolderNotes folderPath={folderPath} />

          {auth?.session?.user.id && availableWorkspaces.length > 0 ? (
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <h4 className="text-muted-foreground text-sm font-medium">
                  <Trans>Team folder</Trans>
                </h4>
                <p className="text-muted-foreground text-xs">
                  <Trans>
                    Choose who receives new notes created in this folder.
                  </Trans>
                </p>
              </div>
              <Select
                value={selectedWorkspaceValue}
                disabled={workspaceMutation.isPending}
                onValueChange={(workspaceId) => {
                  if (workspaceId === PERSONAL_WORKSPACE_VALUE) {
                    workspaceMutation.mutate(personalWorkspaceId);
                    return;
                  }
                  const workspace = availableWorkspaces.find(
                    (candidate) => candidate.id === workspaceId,
                  );
                  if (workspace) {
                    setWorkspaceConfirmation(workspace);
                  }
                }}
              >
                <SelectTrigger
                  aria-label={t`Team folder workspace`}
                  className="h-8 w-44 text-xs"
                >
                  <SelectValue placeholder={t`Only me`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PERSONAL_WORKSPACE_VALUE}>
                    <Trans>Only me</Trans>
                  </SelectItem>
                  {availableWorkspaces.map((workspace) => (
                    <SelectItem key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {/* Fork: every section keeps 8 pt from its heading block to its
              content (picture review, Oct 6: 28, 16 and 14 pt; Apple HIG,
              Layout). */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <h4 className="text-muted-foreground text-sm font-medium">
                <Trans>Context</Trans>
              </h4>
              <p className="text-muted-foreground text-xs">
                <Trans>What these notes are usually about.</Trans>
              </p>
            </div>
            <FolderInstructionsField folderPath={folderPath} rows={4} />
          </div>

          <div className="flex flex-col gap-2">
            <h4 className="text-muted-foreground text-sm font-medium">
              <Trans>Materials</Trans>
            </h4>
            {/* Fork: Add file takes several files at once, as a Mac open
                panel does (task test, Oct 9; Apple HIG, File management). */}
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={async (event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                if (files.length === 0) {
                  return;
                }
                setBusy(true);
                try {
                  for (const file of files) {
                    try {
                      await upload(file);
                    } catch (error) {
                      // Fork: a failed upload said nothing (task test, Oct
                      // 9; NN/g #9).
                      console.error(
                        "[folder-editor] failed to add file",
                        error,
                      );
                      toast.error(t`Couldn't add ${file.name}. Try again.`);
                    }
                  }
                } finally {
                  setBusy(false);
                }
              }}
            />
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <li>
                <button
                  type="button"
                  disabled={busy}
                  className={cn([
                    // Fork: the field-border gray, so the Add file tile's
                    // edge meets 3:1 like a control should (picture review,
                    // Oct 6: 1.15:1; WCAG 2.2 SC 1.4.11).
                    "border-input text-muted-foreground hover:bg-accent hover:text-foreground",
                    "flex aspect-[4/3] w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed",
                    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-hidden",
                    "disabled:opacity-50",
                  ])}
                  onClick={() => inputRef.current?.click()}
                >
                  <Plus className="size-6" />
                  <span className="text-xs font-medium">
                    <Trans>Add file</Trans>
                  </span>
                </button>
              </li>
              {materials.map((material) => (
                <li key={material.id}>
                  <FolderMaterialTile
                    folderPath={folderPath}
                    material={material}
                    busy={busy}
                    onRemove={() =>
                      setRemovingMaterial({
                        filename: material.filename,
                        relativePath: material.relativePath,
                      })
                    }
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <Dialog
        open={workspaceConfirmation !== null}
        onOpenChange={(open) => {
          if (!open && !workspaceMutation.isPending) {
            setWorkspaceConfirmation(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Trans>Share this folder?</Trans>
            </DialogTitle>
            <DialogDescription>
              <Trans>
                New notes in this folder will sync to everyone in{" "}
                {workspaceConfirmation?.name}. Notes already in the folder are
                not moved.
              </Trans>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={workspaceMutation.isPending}
              onClick={() => setWorkspaceConfirmation(null)}
            >
              <Trans>Cancel</Trans>
            </Button>
            <Button
              disabled={workspaceMutation.isPending}
              onClick={() => {
                if (workspaceConfirmation) {
                  workspaceMutation.mutate(workspaceConfirmation.id);
                }
              }}
            >
              {/* Fork: the button names the action, not "Confirm" (Apple
                  HIG, Alerts: use a verb that describes the result). */}
              <Trans>Share folder</Trans>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FolderNameDialog
        open={renaming}
        title={t`Rename folder`}
        confirmLabel={t`Rename`}
        initialValue={displayName}
        onOpenChange={setRenaming}
        onSubmit={renameTo}
      />

      <DestructiveConfirmationDialog
        open={removingMaterial !== null}
        onOpenChange={(open) => {
          if (!open) setRemovingMaterial(null);
        }}
        title={<Trans>Remove “{removingMaterial?.filename}”?</Trans>}
        description={<Trans>This can't be undone.</Trans>}
        confirmLabel={<Trans>Remove file</Trans>}
        isPending={busy}
        onConfirm={() => {
          const material = removingMaterial;
          if (!material) return;
          void (async () => {
            setBusy(true);
            try {
              await deleteLocalFolderMaterial({
                folderPath,
                attachmentId: diskAttachmentId(material.relativePath),
              });
              setRemovingMaterial(null);
            } catch (error) {
              console.error("[folder-editor] failed to remove file", error);
              toast.error(t`Could not remove the file.`);
            } finally {
              setBusy(false);
            }
          })();
        }}
      />

      {/* Fork: alert names the folder and says notes stay on Home
          (ux-audit-oct3 B; HIG alerts). */}
      <DestructiveConfirmationDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={<Trans>Delete “{displayName}”?</Trans>}
        description={
          <Trans>
            Notes stay on Home. This folder, its nested folders and their
            materials will be deleted.
          </Trans>
        }
        confirmLabel={<Trans>Delete folder</Trans>}
        isPending={busy}
        onConfirm={() => {
          void (async () => {
            setBusy(true);
            try {
              if (ownedShare && auth) {
                await deleteSharedResource(
                  requireResourceSharingContext(auth),
                  ownedShare.shareId,
                );
              }
              await deleteNamedFolder(folderPath);
              setDeleting(false);
              markFolderDeleted(folderPath);
              if (ownedShare) {
                void queryClient.invalidateQueries({
                  queryKey: sharedResourcesQueryKey(
                    auth?.session?.user.id,
                    "folder",
                  ),
                });
              }
            } catch (error) {
              // Fork: say it failed instead of an unhandled rejection
              // (journey-after P2 "Folders › Delete"; NN/g #9).
              console.error("[folders] delete failed", error);
              toast.error(t`Couldn't delete the folder. Try again.`);
            } finally {
              setBusy(false);
            }
          })();
        }}
      />
    </section>
  );
}
