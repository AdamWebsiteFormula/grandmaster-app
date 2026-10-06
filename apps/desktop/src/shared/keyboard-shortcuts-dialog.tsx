import { Trans, useLingui } from "@lingui/react/macro";
import { useState } from "react";

import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@anlg/ui/components/ui/dialog";
import { Kbd } from "@anlg/ui/components/ui/kbd";
import { useMountEffect } from "@anlg/ui/hooks/use-mount-effect";

import {
  GlassDialogCancelButton,
  GlassDialogContent,
} from "~/shared/ui/glass-dialog";

// Fork: Help › Keyboard shortcuts (⌘/) lists every shortcut in one place
// (UX audit Oct 3, A: NN/g #6 recognition over recall, #10 help; HIG
// keyboards). Keep in sync with shared/useMainShortcuts.tsx, the native menus
// in plugins/tray/src/ext.rs, and the hotkeys they point to.
const OPEN_EVENT = "upshot:open-keyboard-shortcuts";

export function openKeyboardShortcuts() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function KeyboardShortcutsDialog() {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);

  useMountEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  });

  const groups: { title: string; rows: [string, string][] }[] = [
    {
      title: t`Notes`,
      rows: [
        [t`Record meeting`, "⌘ N"],
        [t`Blank note`, "⇧ ⌘ N"],
        [t`Search notes`, "⌘ K"],
        [t`Ask Upshot AI`, "⌘ J"],
      ],
    },
    {
      title: t`In a note`,
      rows: [
        [t`Find`, "⌘ F"],
        [t`Find and replace`, "⌥ ⌘ F"],
        [t`Previous or next view`, "⌥ ⌘ ← →"],
        // Fork: Space plays the recording only on the Transcript tab.
        [t`Play or pause (Transcript tab)`, "Space"],
      ],
    },
    {
      title: t`App`,
      rows: [
        [t`Show or hide the sidebar`, "⌘ \\"],
        [t`Settings`, "⌘ ,"],
        [t`Zoom in, zoom out, actual size`, "⌘ = − 0"],
        [t`Keyboard shortcuts`, "⌘ /"],
        [t`Close`, "Esc"],
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <GlassDialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-sm leading-5 font-semibold tracking-normal">
            <Trans>Keyboard shortcuts</Trans>
          </DialogTitle>
          <DialogDescription className="sr-only">
            <Trans>Every keyboard shortcut in Upshot</Trans>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <section key={group.title} className="flex flex-col gap-1">
              <h3 className="text-muted-foreground text-xs font-medium">
                {group.title}
              </h3>
              <ul className="flex flex-col">
                {group.rows.map(([label, keys]) => (
                  <li
                    key={label}
                    className="text-foreground flex items-center justify-between gap-6 py-1 text-sm"
                  >
                    <span>{label}</span>
                    <Kbd className="shrink-0">{keys}</Kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <DialogFooter>
          <GlassDialogCancelButton onClick={() => setOpen(false)}>
            <Trans>Done</Trans>
          </GlassDialogCancelButton>
        </DialogFooter>
      </GlassDialogContent>
    </Dialog>
  );
}
