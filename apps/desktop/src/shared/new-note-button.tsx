import { Trans, useLingui } from "@lingui/react/macro";

import { Microphone } from "@anlg/ui/components/icons";
import { cn } from "@anlg/utils";

import { shortcutLabel } from "~/shared/shortcut-label";
import { useNewNoteAndListen } from "~/shared/useNewNote";
import { useListener } from "~/stt/contexts";

// Fork: Granola-style "New note" in the top right. Creates a note and starts recording.
export function NewNoteButton({
  className,
  variant = "primary",
}: {
  className?: string;
  /** "outline" on pages whose own main action is something else (a note). */
  variant?: "primary" | "outline";
}) {
  const { t } = useLingui();
  const newNoteAndListen = useNewNoteAndListen();
  // While recording, Stop is the main action, so this button steps back.
  const recording = useListener((state) => state.live?.status === "active");
  // Fork: ⌘N on a Mac, Ctrl+N elsewhere (Microsoft Writing Style Guide,
  // Keys and keyboard shortcuts).
  const newNoteShortcut = shortcutLabel(["mod", "N"]);

  return (
    <button
      type="button"
      data-tauri-drag-region="false"
      onClick={newNoteAndListen}
      // Fork: say that it records and name the shortcut (UX audit Oct 3, A).
      // While recording it goes back to that note, so it says so
      // (journey-meeting P3; NN/g #4 consistency).
      title={
        recording
          ? t`Go to the note being recorded`
          : t`Record meeting (${newNoteShortcut})`
      }
      className={cn([
        recording
          ? "bg-secondary text-secondary-foreground hover:bg-accent"
          : variant === "outline"
            ? "border-input text-foreground hover:bg-accent border bg-transparent"
            : "bg-primary text-primary-foreground hover:brightness-90",
        "inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors",
        "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        className,
      ])}
    >
      {recording ? (
        <Trans>Back to recording</Trans>
      ) : (
        <>
          {/* Fork: "Record meeting" with a mic, since the button starts
              recording; "New note" did not say so (owner's pick, Oct 6: Apple HIG Buttons, start with a verb; NN/g, say what will happen). */}
          <Microphone className="size-3.5" />
          <Trans>Record meeting</Trans>
        </>
      )}
    </button>
  );
}
