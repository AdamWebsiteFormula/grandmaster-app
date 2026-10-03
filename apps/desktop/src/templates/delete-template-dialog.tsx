// Fork: deleting a template asks first; it was an instant hard delete
// (ux-audit-oct3 B; NN/g #5, error prevention; Apple HIG, Alerts).
import { Trans, useLingui } from "@lingui/react/macro";

import { setSettingValue } from "~/settings/queries";
import { useConfigValue } from "~/shared/config";
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
  const title = template?.title?.trim() || t`Untitled template`;
  // Fork: deleting the default says what happens next and resets the
  // default to Auto (journey-after P3 "Templates › Delete"; Apple HIG,
  // Alerts: say what will happen).
  const defaultTemplateId = useConfigValue("selected_template_id");
  const isDefault = Boolean(template) && defaultTemplateId === template?.id;

  return (
    <DestructiveConfirmationDialog
      open={template !== null}
      onOpenChange={onOpenChange}
      title={<Trans>Delete “{title}”?</Trans>}
      description={
        isDefault ? (
          <Trans>This is your default template. New notes will use Auto.</Trans>
        ) : (
          <Trans>This can't be undone.</Trans>
        )
      }
      confirmLabel={<Trans>Delete template</Trans>}
      onConfirm={() => {
        if (!template) return;
        if (isDefault) {
          void setSettingValue("selected_template_id", "").catch((error) => {
            console.error("[templates] failed to reset the default", error);
          });
        }
        onConfirm(template.id);
        onOpenChange(false);
      }}
    />
  );
}
