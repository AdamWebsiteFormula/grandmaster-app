import { t } from "@lingui/core/macro";

import { commands as windowsCommands } from "@anlg/plugin-windows";
import { toast } from "@anlg/ui/components/ui/toast";

import {
  beginCanonicalSessionEditorActivation,
  waitForCanonicalSessionImportUnlock,
} from "~/session-sharing/editor-activity";

export async function openStandaloneNoteWindow(sessionId: string) {
  let finishActivation = beginCanonicalSessionEditorActivation(sessionId);
  while (!finishActivation) {
    await waitForCanonicalSessionImportUnlock(sessionId);
    finishActivation = beginCanonicalSessionEditorActivation(sessionId);
  }

  const result = await windowsCommands
    .windowShow({
      type: "note",
      value: sessionId,
    })
    .finally(finishActivation);

  // Fork: a window that failed to open said nothing (task sweep, Oct 9;
  // NN/g #9).
  if (result.status === "error") {
    console.error("Failed to open note window:", result.error);
    toast.error(t`Couldn't open this note in a new window. Try again.`);
  }
}
