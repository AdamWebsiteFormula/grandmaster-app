import { t } from "@lingui/core/macro";

import { toast } from "@anlg/ui/components/ui/toast";

// Fork: offline, a template switch can't run, so say so and keep the summary
// as it is (journey-meeting P2; NN/g #5 error prevention).
export function refuseTemplateSwitchOffline(enhancedNoteId: string): boolean {
  if (typeof navigator === "undefined" || navigator.onLine !== false) {
    return false;
  }
  toast.error(t`You're offline. Your summary stays as it is.`, {
    id: `template-switch-offline-${enhancedNoteId}`,
  });
  return true;
}
