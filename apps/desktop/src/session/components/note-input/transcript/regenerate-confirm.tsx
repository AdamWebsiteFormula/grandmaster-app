import { useLingui } from "@lingui/react/macro";
import { useCallback, useState } from "react";

import { useRegenerateTranscript } from "./actions";

import { DestructiveConfirmationDialog } from "~/shared/ui/destructive-confirmation-dialog";

// Fork: Transcribe again replaced the whole transcript, edits and speaker
// names included, on one click. Ask first (Apple HIG Alerts; NN/g #5). What
// it does after Transcribe again is unchanged.
export function useRegenerateTranscriptConfirm(sessionId: string) {
  const { t } = useLingui();
  const regenerate = useRegenerateTranscript(sessionId);
  const [open, setOpen] = useState(false);

  const requestRegenerateTranscript = useCallback(() => {
    setOpen(true);
  }, []);

  const confirm = useCallback(() => {
    setOpen(false);
    void regenerate();
  }, [regenerate]);

  const confirmDialog = (
    <DestructiveConfirmationDialog
      open={open}
      onOpenChange={setOpen}
      title={t`Transcribe this recording again?`}
      description={t`This replaces the current transcript, including your edits and speaker names.`}
      confirmLabel={t`Transcribe again`}
      onConfirm={confirm}
    />
  );

  return { requestRegenerateTranscript, confirmDialog };
}
