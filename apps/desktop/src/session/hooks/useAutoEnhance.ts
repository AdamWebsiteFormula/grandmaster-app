import { useLingui } from "@lingui/react/macro";
import { useEffect } from "react";

import { toast } from "@anlg/ui/components/ui/toast";

import { getEnhancerService } from "~/services/enhancer";
import { type Tab, useTabs } from "~/store/zustand/tabs";

export function useAutoEnhance(tab: Extract<Tab, { type: "sessions" }>) {
  const { t } = useLingui();
  const sessionId = tab.id;

  useEffect(() => {
    const service = getEnhancerService();
    if (!service) return;
    return service.on((event) => {
      if (event.sessionId !== sessionId) return;
      if (event.type === "auto-enhance-skipped") {
        if (event.reasonCode === "transcript_too_short") {
          toast.warning(t`Summary wasn't generated`, {
            id: `auto-summary-too-short-${sessionId}`,
            description: event.reason,
          });
        }
        // Fork: a failed automatic summary says so and how to recover,
        // instead of nothing (journey-meeting P2; NN/g #1, #9).
        if (event.reasonCode === "error") {
          toast.error(t`Summary wasn't generated`, {
            id: `auto-summary-failed-${sessionId}`,
            description: t`Upshot couldn't reach Upshot AI. Open the Summary and click Generate summary.`,
          });
        }
      }
      if (event.type === "auto-enhance-started") {
        const tabsState = useTabs.getState();
        const sessionTab = tabsState.tabs.find(
          (t): t is Extract<Tab, { type: "sessions" }> =>
            t.type === "sessions" && t.id === sessionId,
        );
        if (sessionTab) {
          tabsState.updateSessionTabState(sessionTab, {
            ...sessionTab.state,
            view: { type: "enhanced", id: event.noteId },
          });
        }
      }
      if (event.type === "auto-enhance-no-model") {
        toast.error(t`Summary wasn't generated`, {
          id: `auto-summary-failed-${sessionId}`,
          description: t`Upshot AI is getting ready. Try again in a minute.`,
        });
      }
    });
  }, [sessionId, t]);
}
