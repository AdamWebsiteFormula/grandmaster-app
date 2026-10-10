import { t } from "@lingui/core/macro";
import { ask } from "@tauri-apps/plugin-dialog";

// Fork: removing something people can't get back asks first (delete sweep,
// Oct 10; Apple HIG, Alerts: confirm destructive actions that can't be
// undone, and title the cancel button "Cancel"). Same wording as
// contacts/contact-actions.ts.
export async function confirmDelete(
  title: string,
  okLabel: string = t`Delete`,
): Promise<boolean> {
  try {
    return await ask(t`You can't undo this.`, {
      title,
      kind: "warning",
      okLabel,
      cancelLabel: t`Cancel`,
    });
  } catch (error) {
    console.error("[confirm-delete] dialog failed", error);
    return false;
  }
}
