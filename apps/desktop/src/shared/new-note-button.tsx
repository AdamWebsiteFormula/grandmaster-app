import { Trans } from "@lingui/react/macro";

import { Plus } from "@anlg/ui/components/icons";
import { cn } from "@anlg/utils";

import { useNewNoteAndListen } from "~/shared/useNewNote";
import { useListener } from "~/stt/contexts";

// Fork: Granola-style "New note" in the top right. Creates a note and starts recording.
export function NewNoteButton({ className }: { className?: string }) {
  const newNoteAndListen = useNewNoteAndListen();
  // While recording, Stop is the main action, so this button steps back.
  const recording = useListener((state) => state.live?.status === "active");

  return (
    <button
      type="button"
      data-tauri-drag-region="false"
      onClick={newNoteAndListen}
      className={cn([
        recording
          ? "bg-secondary text-secondary-foreground hover:bg-accent"
          : "bg-primary text-primary-foreground hover:bg-primary/90",
        "inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors",
        "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        className,
      ])}
    >
      <Plus className="size-3.5" weight="bold" />
      <Trans>New note</Trans>
    </button>
  );
}
