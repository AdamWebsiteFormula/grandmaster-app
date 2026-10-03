import { t } from "@lingui/core/macro";

import { toast } from "@anlg/ui/components/ui/toast";

// Fork: Generate summary, Retry and Try again stay enabled while Upshot AI is
// briefly unavailable, and a click says why nothing happens instead of a
// silent disabled button (journey-meeting P3; NN/g #1).
export function showModelNotReadyToast() {
  toast(t`Upshot AI is getting ready. Try again in a minute.`, {
    id: "summary-model-not-ready",
  });
}

export type EnhanceErrorKind = "too_long" | "out_of_credit" | "other";

// Fork: the worker's 413 and 402 messages get their own recovery advice
// (journey-meeting P3; NN/g #9; grandmaster/worker/src/index.js).
export function getEnhanceErrorKind(
  error: Error | undefined,
): EnhanceErrorKind {
  const message = error?.message ?? "";
  if (/too long/i.test(message)) return "too_long";
  if (/out of credit/i.test(message)) return "out_of_credit";
  return "other";
}
