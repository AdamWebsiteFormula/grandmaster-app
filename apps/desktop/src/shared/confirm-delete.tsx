import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useRef } from "react";
import { create } from "zustand";

import { DestructiveConfirmationDialog } from "~/shared/ui/destructive-confirmation-dialog";

type ConfirmDeleteRequest = {
  title: string;
  confirmLabel: string;
  resolve: (confirmed: boolean) => void;
};

const useConfirmDeleteStore = create<{ request: ConfirmDeleteRequest | null }>(
  () => ({ request: null }),
);

// Fork: removing something people can't get back asks first, in the app's
// own red dialog (the one "Remove this summary?" and folder files use), so
// Return never deletes by default (delete sweep, Oct 10; Apple HIG, Alerts:
// confirm destructive actions that can't be undone, never make the
// destructive button the default; NN/g #4, one look for one job).
export function confirmDelete(
  title: string,
  confirmLabel: string = t`Delete`,
): Promise<boolean> {
  return new Promise((resolve) => {
    useConfirmDeleteStore.getState().request?.resolve(false);
    useConfirmDeleteStore.setState({
      request: { title, confirmLabel, resolve },
    });
  });
}

function settle(confirmed: boolean) {
  const { request } = useConfirmDeleteStore.getState();
  if (!request) return;
  useConfirmDeleteStore.setState({ request: null });
  request.resolve(confirmed);
}

export function ConfirmDeleteHost() {
  const request = useConfirmDeleteStore((state) => state.request);
  // Keep the words on screen while the dialog fades out.
  const shownRef = useRef<ConfirmDeleteRequest | null>(null);
  if (request) shownRef.current = request;
  const shown = shownRef.current;

  return (
    <DestructiveConfirmationDialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) settle(false);
      }}
      title={shown?.title ?? ""}
      description={<Trans>You can't undo this.</Trans>}
      confirmLabel={shown?.confirmLabel ?? ""}
      onConfirm={() => settle(true)}
    />
  );
}
