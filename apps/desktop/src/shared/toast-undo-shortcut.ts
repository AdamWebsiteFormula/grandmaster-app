import { useLingui } from "@lingui/react/macro";
import { useHotkeys } from "react-hotkeys-hook";

import { runLatestAppToastAction } from "@anlg/ui/components/ui/app-toast";

// Fork: ⌘Z (Ctrl+Z off a Mac) presses the newest toast's Undo when no text
// field or editor has focus, as Edit › Undo reverses the last action (Apple
// HIG, Undo and redo; Devin's undo toasts take ⌘Z the same way). Text fields
// keep their own undo.
export function useToastUndoShortcut() {
  const { t } = useLingui();

  useHotkeys(
    "mod+z",
    (event) => {
      const undoLabel = t`Undo`;
      if (runLatestAppToastAction((label) => label === undoLabel)) {
        event.preventDefault();
      }
    },
    { enableOnFormTags: false, enableOnContentEditable: false },
    [t],
  );
}
