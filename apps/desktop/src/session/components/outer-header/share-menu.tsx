import { Trans, useLingui } from "@lingui/react/macro";
import { useState } from "react";

import { Copy, Envelope, FileArrowDown } from "@anlg/ui/components/icons";
import {
  AppFloatingPanel,
  appFloatingMenuPanelClassName,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@anlg/ui/components/ui/dropdown-menu";
import { cn } from "@anlg/utils";

import {
  menuContentClassName,
  menuTriggerFocusClassName,
  usePointerCloseAutoFocus,
} from "./menu-focus";
import { ExportModal } from "./overflow/export-modal";
import { useNoteShareActions } from "./share-actions";

import type { EditorView } from "~/store/zustand/tabs/schema";

// Fork: Granola's note header has a Share pill. Upshot keeps notes on this
// Mac, so Share offers local ways out: copy, mail and export
// (granola-compare-oct3 §1, Share). No cloud link.
export function ShareMenu({
  sessionId,
  currentView,
}: {
  sessionId: string;
  currentView: EditorView;
}) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const menuFocus = usePointerCloseAutoFocus();
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMounted, setExportMounted] = useState(false);
  const { canShareNotes, copyNotes, sendNotesViaEmail } = useNoteShareActions(
    sessionId,
    currentView,
  );

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild {...menuFocus.triggerProps}>
          <button
            type="button"
            data-tauri-drag-region="false"
            className={cn([
              "border-input bg-card dark:bg-muted text-foreground hover:bg-accent dark:hover:bg-accent ml-1 inline-flex h-7 shrink-0 cursor-pointer items-center rounded-full border px-3 text-sm font-medium transition-colors",
              menuTriggerFocusClassName,
              open && "bg-accent dark:bg-accent",
            ])}
          >
            {t`Share`}
          </button>
        </DropdownMenuTrigger>
        {/* Fork: right edge on Share's right edge, as narrow as its rows, so
            it covers as little of the player below as it can (redline-oct3,
            H2). */}
        <DropdownMenuContent
          variant="app"
          align="end"
          sideOffset={6}
          className={cn([menuContentClassName, "w-max min-w-44"])}
          {...menuFocus.contentProps}
        >
          <AppFloatingPanel className={appFloatingMenuPanelClassName}>
            <DropdownMenuItem
              disabled={!canShareNotes}
              // Fork: say why it is off; the hover tip needs pointer events
              // on the disabled row (journey-after P3 "Share menu"; NN/g #1).
              title={canShareNotes ? undefined : t`Nothing to share yet`}
              onClick={() => {
                setOpen(false);
                void copyNotes();
              }}
              className="cursor-pointer data-disabled:pointer-events-auto data-disabled:cursor-default"
            >
              <Copy />
              <span>
                <Trans>Copy notes</Trans>
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canShareNotes}
              // Fork: say why it is off; the hover tip needs pointer events
              // on the disabled row (journey-after P3 "Share menu"; NN/g #1).
              title={canShareNotes ? undefined : t`Nothing to share yet`}
              onClick={() => {
                setOpen(false);
                void sendNotesViaEmail();
              }}
              className="cursor-pointer data-disabled:pointer-events-auto data-disabled:cursor-default"
            >
              <Envelope />
              <span>
                <Trans>Send notes via email</Trans>
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setOpen(false);
                setExportMounted(true);
                requestAnimationFrame(() => setExportOpen(true));
              }}
              className="cursor-pointer"
            >
              <FileArrowDown />
              <span>
                <Trans>Export…</Trans>
              </span>
            </DropdownMenuItem>
          </AppFloatingPanel>
        </DropdownMenuContent>
      </DropdownMenu>
      {exportMounted && (
        <ExportModal
          sessionId={sessionId}
          currentView={currentView}
          open={exportOpen}
          onOpenChange={setExportOpen}
        />
      )}
    </>
  );
}
