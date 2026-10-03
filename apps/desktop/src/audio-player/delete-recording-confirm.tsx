import { Trans, useLingui } from "@lingui/react/macro";
import { useCallback, useState } from "react";

import { toast } from "@anlg/ui/components/ui/toast";

import { DestructiveConfirmationDialog } from "~/shared/ui/destructive-confirmation-dialog";

// Fork: Delete recording ran on one click and swallowed errors. Ask first,
// then report a failure (ux-audit-oct3 C; HIG alerts, NN/g #5). What the
// delete does is unchanged: it still calls the same deleteRecording.
export function useDeleteRecordingConfirm({
  deleteRecording,
  isPending,
}: {
  deleteRecording: () => Promise<void>;
  isPending: boolean;
}) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);

  const requestDeleteRecording = useCallback(() => {
    setOpen(true);
  }, []);

  const confirm = useCallback(() => {
    deleteRecording().then(
      () => setOpen(false),
      (error: unknown) => {
        console.error("[audio-player] delete recording failed", error);
        setOpen(false);
        toast.error(
          t`Couldn't delete the recording. Stop playback and try again.`,
        );
      },
    );
  }, [deleteRecording, t]);

  const confirmDialog = (
    <DestructiveConfirmationDialog
      open={open}
      onOpenChange={setOpen}
      title={<Trans>Delete this recording?</Trans>}
      description={
        <Trans>The transcript and notes stay. You can't undo this.</Trans>
      }
      confirmLabel={<Trans>Delete recording</Trans>}
      isPending={isPending}
      onConfirm={confirm}
    />
  );

  return { requestDeleteRecording, confirmDialog };
}
