import { useToastUndoShortcut } from "~/shared/toast-undo-shortcut";
import { useMainShortcuts } from "~/shared/useMainShortcuts";

export function useClassicMainShortcuts() {
  useToastUndoShortcut();
  return useMainShortcuts();
}
