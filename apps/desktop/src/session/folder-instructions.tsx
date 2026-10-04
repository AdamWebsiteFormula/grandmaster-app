import { useLingui } from "@lingui/react/macro";
import { useState } from "react";

import { toast } from "@anlg/ui/components/ui/toast";
import { cn } from "@anlg/utils";

import {
  updateFolderInstructions,
  useFolderInstructions,
} from "~/session/folder-catalog";

export function FolderInstructionsField({
  folderPath,
  rows = 2,
}: {
  folderPath: string;
  rows?: number;
}) {
  const { t } = useLingui();
  const saved = useFolderInstructions(folderPath);
  const [value, setValue] = useState(saved);
  const [syncedSource, setSyncedSource] = useState({ folderPath, saved });
  if (syncedSource.folderPath !== folderPath || syncedSource.saved !== saved) {
    setSyncedSource({ folderPath, saved });
    setValue(saved);
  }

  return (
    <textarea
      aria-label={t`Folder context`}
      value={value}
      placeholder={t`Add context for this folder`}
      rows={rows}
      className={cn([
        "border-input placeholder:text-muted-foreground w-full resize-none rounded-md border bg-transparent",
        "focus-visible:ring-ring focus-visible:ring-1 focus-visible:outline-hidden",
        rows > 2
          ? "px-3 py-2.5 text-sm leading-5"
          : "px-1.5 py-1 text-xs leading-4",
      ])}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => {
        if (value === saved) {
          return;
        }
        // Fork: say so when the context saves, as Granola confirms edits
        // with a toast (owner test, Oct 4; NN/g heuristic #1).
        void Promise.resolve(updateFolderInstructions(folderPath, value))
          .then(() => {
            toast.success(t`Folder updated`, { id: "folder-updated" });
          })
          .catch(() => {
            toast.error(t`Couldn't save the folder context. Try again.`);
          });
      }}
    />
  );
}
