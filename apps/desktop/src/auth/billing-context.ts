import { createContext, useContext, useMemo } from "react";

import type { BillingInfo } from "@anlg/supabase";

export type BillingAccess = BillingInfo & {
  isReady: boolean;
  canStartTrial: { data: boolean; isPending: boolean };
  upgradeToPro: () => void;
  isUpgradingToPro: boolean;
};

export const BillingContext = createContext<BillingAccess | null>(null);

export function useBillingAccess() {
  const context = useContext(BillingContext);

  // Fork (blueprint section 5): no plans or plan gates. Pro features are
  // local and always on; isPaid (cloud models, sharing) stays as reported.
  const access = useMemo(
    () => (context ? { ...context, isPro: true } : null),
    [context],
  );

  if (!access) {
    throw new Error("useBillingAccess must be used within BillingProvider");
  }

  return access;
}
