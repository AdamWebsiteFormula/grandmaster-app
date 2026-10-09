import { useLingui } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { platform } from "@tauri-apps/plugin-os";

import { commands as fsSyncCommands } from "@anlg/plugin-fs-sync";
import { commands as openerCommands } from "@anlg/plugin-opener2";
import { CircleNotch, FolderOpen } from "@anlg/ui/components/icons";
import { DropdownMenuItem } from "@anlg/ui/components/ui/dropdown-menu";
import { toast } from "@anlg/ui/components/ui/toast";

export function ShowInFolder({ sessionId }: { sessionId: string }) {
  const { t } = useLingui();
  const os = platform();
  const label =
    os === "macos"
      ? t`Show in Finder`
      : os === "windows"
        ? t`Show in File Explorer`
        : t`Show in folder`;
  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const result = await fsSyncCommands.sessionDir(sessionId);
      if (result.status === "error") {
        throw new Error(result.error);
      }
      const opened = await openerCommands.openPath(result.data, null);
      if (opened.status === "error") {
        throw new Error(opened.error);
      }
    },
    // Fork: a note folder that could not be shown said nothing (task sweep,
    // Oct 9; NN/g #9).
    onError: (error) => {
      console.error("[note] show in folder failed", error);
      toast.error(t`Couldn't show this note. Try again.`);
    },
  });

  return (
    <DropdownMenuItem
      onClick={(e) => {
        e.preventDefault();
        mutate();
      }}
      disabled={isPending}
      className="cursor-pointer"
    >
      {isPending ? (
        <CircleNotch className="animate-spin" />
      ) : (
        <FolderOpen data-testid="show-in-folder-icon" />
      )}
      <span>{isPending ? t`Opening…` : label}</span>
    </DropdownMenuItem>
  );
}
