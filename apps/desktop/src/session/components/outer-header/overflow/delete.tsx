import { Trans } from "@lingui/react/macro";
import { useCallback } from "react";

import { commands as analyticsCommands } from "@anlg/plugin-analytics";
import { Trash } from "@anlg/ui/components/icons";
import { DropdownMenuItem } from "@anlg/ui/components/ui/dropdown-menu";
import { cn } from "@anlg/utils";

import { useDeleteSession } from "~/session/hooks/useDeleteSession";
import { useSessionSummary } from "~/session/queries";

export function DeleteNote({ sessionId }: { sessionId: string }) {
  const deleteSession = useDeleteSession();
  const title = useSessionSummary(sessionId)?.title;

  const handleDeleteNote = useCallback(() => {
    deleteSession(sessionId, { title });

    void analyticsCommands.event({
      event: "session_deleted",
      includes_recording: true,
    });
  }, [sessionId, deleteSession, title]);

  return (
    <DropdownMenuItem
      onClick={handleDeleteNote}
      className={cn([
        "text-destructive cursor-pointer",
        "hover:bg-destructive/10 hover:text-destructive",
      ])}
    >
      <Trash />
      <span>
        {/* Fork: names what goes, next to Delete recording (ux-audit-oct3 C, HIG menus). */}
        <Trans>Delete note</Trans>
      </span>
    </DropdownMenuItem>
  );
}
