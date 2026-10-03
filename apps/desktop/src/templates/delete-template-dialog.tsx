// Fork: deleting a template asks first; it was an instant hard delete
// (ux-audit-oct3 B; NN/g #5, error prevention; Apple HIG, Alerts).
import { Trans, useLingui } from "@lingui/react/macro";

import { DestructiveConfirmationDialog } from "~/shared/ui/destructive-confirmation-dialog";

export function DeleteTemplateDialog({
  template,
  onOpenChange,
  onConfirm,
}: {
  /** The template to delete; null keeps the dialog closed. */
  template: { id: string; title?: string | null } | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string) => void;
}) {
  const { t } = useLingui();
  const title = template?.title?.trim() || t`Untitled`;

  return (
    <DestructiveConfirmationDialog
      open={template !== null}
      onOpenChange={onOpenChange}
      title={<Trans>Delete “{title}”?</Trans>}
      description={<Trans>This can't be undone.</Trans>}
      confirmLabel={<Trans>Delete template</Trans>}
      onConfirm={() => {
        if (!template) return;
        onConfirm(template.id);
        onOpenChange(false);
      }}
    />
  );
}
