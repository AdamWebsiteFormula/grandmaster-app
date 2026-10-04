import { t } from "@lingui/core/macro";
import { useEffect } from "react";

import { Button } from "@anlg/ui/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@anlg/ui/components/ui/dialog";

import { TrialDialogIcon } from "./trial-dialog-icon";

import { trackAnalyticsEvent } from "~/analytics";
import {
  GlassDialogCancelButton,
  GlassDialogContent,
} from "~/shared/ui/glass-dialog";

interface TrialEndedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpgrade: () => void;
}

export function TrialEndedDialog({
  open,
  onOpenChange,
  onUpgrade,
}: TrialEndedDialogProps) {
  useEffect(() => {
    if (!open) return;
    trackAnalyticsEvent("paywall_viewed", {
      entry_point: "trial_ended_dialog",
      feature: "pro_plan",
    });
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <GlassDialogContent>
        <DialogHeader className="items-center gap-2 text-center sm:text-center">
          <TrialDialogIcon state="ended" />
          <DialogTitle className="text-foreground text-sm leading-5 font-semibold tracking-normal">
            {t`Your Pro trial has ended`}
          </DialogTitle>
          <DialogDescription className="text-foreground w-full text-center text-sm leading-[1.36]">
            {/* Fork: Upshot transcription is free on every computer, so
                the trial ending changes only the Pro features. */}
            {t`Your notes and recordings are safe, and transcription keeps working. Upgrade anytime to keep Pro features.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:justify-normal">
          <GlassDialogCancelButton onClick={() => onOpenChange(false)}>
            {t`Maybe later`}
          </GlassDialogCancelButton>
          <Button
            className="bg-primary text-primary-foreground h-8 rounded-full px-4 text-xs font-medium shadow-sm hover:brightness-90 dark:bg-white dark:text-black dark:hover:bg-white/90"
            onClick={() => {
              onUpgrade();
              onOpenChange(false);
            }}
          >
            {t`Upgrade to Pro`}
          </Button>
        </DialogFooter>
      </GlassDialogContent>
    </Dialog>
  );
}
