import { t } from "@lingui/core/macro";

import { toast } from "@anlg/ui/components/ui/toast";

import { deleteHuman, deleteOrganization } from "./queries";

import { confirmDelete } from "~/shared/confirm-delete";

type ContactKind = "person" | "organization";

// Fork: deleting a contact had no confirmation and failed silently, and it
// can't be undone (task sweep, Oct 9; Apple HIG, Alerts: confirm actions
// people can't undo, title the cancel button "Cancel"; NN/g #5, #9).
// Uses the app's own red dialog, as every other delete does.
export async function confirmContactDelete(kind: ContactKind) {
  return confirmDelete(
    kind === "person" ? t`Delete this contact?` : t`Delete this organization?`,
  );
}

export async function deleteContactOrSay(kind: ContactKind, id: string) {
  try {
    await (kind === "person" ? deleteHuman(id) : deleteOrganization(id));
  } catch (error) {
    console.error(`[contacts] failed to delete ${kind}`, error);
    toast.error(
      kind === "person"
        ? t`Couldn't delete this contact. Try again.`
        : t`Couldn't delete this organization. Try again.`,
    );
  }
}

// Fork: contact fields save as you type, and a failed save said nothing; one
// toast id so typing doesn't stack them (task sweep, Oct 9; NN/g #1, #9).
export function showContactNotSavedToast(error: unknown) {
  console.error("[contacts] failed to save contact", error);
  toast.error(t`Couldn't save this contact. Try again.`, {
    id: "contact-not-saved",
  });
}
