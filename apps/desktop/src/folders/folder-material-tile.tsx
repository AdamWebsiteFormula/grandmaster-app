import { useLingui } from "@lingui/react/macro";
import { useCallback } from "react";

import { commands as fsSyncCommands } from "@anlg/plugin-fs-sync";
import { commands as openerCommands } from "@anlg/plugin-opener2";
import { File, X } from "@anlg/ui/components/icons";
import { toast } from "@anlg/ui/components/ui/toast";
import { cn } from "@anlg/utils";

import {
  diskAttachmentId,
  type FolderMaterialRecord,
} from "~/session/folder-attachments";
import { useNativeContextMenu } from "~/shared/hooks/useNativeContextMenu";
import { isMac, runtimePlatform } from "~/shared/shortcut-label";

async function resolveMaterialPath(
  folderPath: string,
  relativePath: string,
): Promise<string> {
  const result = await fsSyncCommands.folderAttachmentList(folderPath);
  if (result.status === "error") throw new Error(result.error);
  const attachmentId = diskAttachmentId(relativePath);
  const match = result.data.find((item) => item.attachmentId === attachmentId);
  if (!match) throw new Error("folder_material_missing");
  return match.path;
}

// Fork: a folder's files open the way Finder's do: double-click or Return
// opens a file in its usual app, and right-click offers Open and Show in
// Finder (Show in File Explorer on Windows). They could not be opened
// (task test, Oct 9; Apple HIG, File management; Mac Finder conventions).
export function FolderMaterialTile({
  folderPath,
  material,
  busy,
  onRemove,
}: {
  folderPath: string;
  material: FolderMaterialRecord;
  busy: boolean;
  onRemove: () => void;
}) {
  const { t } = useLingui();
  const platform = runtimePlatform();
  const revealLabel = isMac(platform)
    ? t`Show in Finder`
    : platform === "windows"
      ? t`Show in File Explorer`
      : t`Show in folder`;

  const open = useCallback(async () => {
    try {
      const path = await resolveMaterialPath(folderPath, material.relativePath);
      const result = await openerCommands.openPath(path, null);
      if (result.status === "error") throw new Error(result.error);
    } catch (error) {
      console.error("[folder-material] failed to open", error);
      toast.error(t`Couldn't open ${material.filename}. Try again.`);
    }
  }, [folderPath, material.filename, material.relativePath, t]);

  const reveal = useCallback(async () => {
    try {
      const path = await resolveMaterialPath(folderPath, material.relativePath);
      const result = await openerCommands.revealItemInDir(path);
      if (result.status === "error") throw new Error(result.error);
    } catch (error) {
      console.error("[folder-material] failed to reveal", error);
      toast.error(t`Couldn't show ${material.filename}. Try again.`);
    }
  }, [folderPath, material.filename, material.relativePath, t]);

  const showMenu = useNativeContextMenu([
    {
      id: `folder-material-open-${material.id}`,
      text: t`Open`,
      action: () => void open(),
    },
    {
      id: `folder-material-reveal-${material.id}`,
      text: revealLabel,
      action: () => void reveal(),
    },
    { separator: true },
    {
      id: `folder-material-remove-${material.id}`,
      text: t`Remove…`,
      action: onRemove,
    },
  ]);

  return (
    <div className="border-border relative flex aspect-[4/3] flex-col rounded-lg border">
      <button
        type="button"
        aria-label={t`Open ${material.filename}`}
        title={material.filename}
        onDoubleClick={() => void open()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void open();
          }
        }}
        onContextMenu={(event) => void showMenu(event)}
        className={cn([
          "flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-lg px-3 py-2",
          "hover:bg-accent/50 cursor-default transition-colors",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-hidden",
        ])}
      >
        <File className="text-muted-foreground size-6 shrink-0" aria-hidden />
        <span className="w-full truncate text-center text-xs">
          {material.filename}
        </span>
      </button>
      <button
        type="button"
        aria-label={t`Remove ${material.filename}`}
        disabled={busy}
        className={cn([
          "text-muted-foreground hover:bg-accent hover:text-foreground",
          "absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-hidden",
          "disabled:opacity-50",
        ])}
        // Fork: confirm before deleting a file (ux-audit-oct3 B; NN/g #5,
        // error prevention).
        onClick={onRemove}
      >
        <X size={12} />
      </button>
    </div>
  );
}
