import { useLingui } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { platform } from "@tauri-apps/plugin-os";

import { commands as fsSyncCommands } from "@anlg/plugin-fs-sync";
import { commands as openerCommands } from "@anlg/plugin-opener2";
import { CircleNotch, FolderOpen } from "@anlg/ui/components/icons";
import { DropdownMenuItem } from "@anlg/ui/components/ui/dropdown-menu";

export function ShowInFolder({ sessionId }: { sessionId: string }) {
  const { t } = useLingui();
  const label = platform() === "macos" ? t`Show in Finder` : t`Show in folder`;
  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const result = await fsSyncCommands.sessionDir(sessionId);
      if (result.status === "error") {
        throw new Error(result.error);
      }
      await openerCommands.openPath(result.data, null);
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
