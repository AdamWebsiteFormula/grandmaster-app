// Fork: Upshot's own plan, separate from the upstream billing context (whose
// isPro stays forced on for upstream features). Free is "Auto" only; Pro
// picks a model in the chat composer, as in Granola
// (docs.granola.ai/help-center/getting-more-from-your-notes/understanding-model-selection-in-granola-chat).
//
// Upgrade follows Granola (docs.granola.ai/help-center/managing-your-account/subscriptions-and-billing):
// click Upgrade, finish Stripe Checkout in the browser, and the plan changes
// once payment lands. Stripe Checkout in subscription mode, provisioned by
// webhooks (docs.stripe.com/billing/subscriptions/build-subscriptions); the
// Worker writes the plan, the app only reads GET /billing/status.
import { useEffect } from "react";
import { create } from "zustand";

import { commands as openerCommands } from "@anlg/plugin-opener2";

import {
  ensureUpshotSessionLoaded,
  upshotAuthedRequest,
  UpshotRequestError,
  useUpshotAccount,
} from "./session";

export {
  signInUpshot,
  signOutUpshot,
  upshotAuthFetch,
  useUpshotAccount,
} from "./session";

export type PlanInterval = "month" | "year";

export type UpshotPlanStatus = {
  pro: boolean;
  status: string | null;
  current_period_end: string | null;
  interval: PlanInterval | null;
  /** Canceled in the portal; Pro stays on until the period ends. */
  cancel_at_period_end?: boolean;
};

// Polling stops after this long without Pro showing (checkout abandoned).
const PENDING_CHECKOUT_MS = 30 * 60_000;
const PENDING_POLL_MS = 60_000;
// Many components read the plan; one fetch serves them for this long.
const FRESH_MS = 30_000;

// Kept in a plain store, not React Query, so every hook caller (chat, the
// LLM connection) works without a QueryClientProvider.
type PlanState = {
  /** The plan for `email`; null until fetched. */
  plan: UpshotPlanStatus | null;
  email: string | null;
  fetchedAt: number;
  error: string | null;
};

export const useUpshotPlanStore = create<PlanState>(() => ({
  plan: null,
  email: null,
  fetchedAt: 0,
  error: null,
}));

let inFlight: Promise<void> | null = null;

/** Fetch GET /billing/status for the signed-in user (deduplicated). */
export function refreshUpshotPlan(force = false): Promise<void> {
  const session = useUpshotAccount.getState().session;
  if (!session) {
    useUpshotPlanStore.setState({ plan: null, email: null, error: null });
    return Promise.resolve();
  }
  const current = useUpshotPlanStore.getState();
  if (
    !force &&
    current.email === session.email &&
    Date.now() - current.fetchedAt < FRESH_MS
  ) {
    return Promise.resolve();
  }
  inFlight ??= upshotAuthedRequest<UpshotPlanStatus>("/billing/status")
    .then((plan) => {
      useUpshotPlanStore.setState({
        plan,
        email: session.email,
        fetchedAt: Date.now(),
        error: null,
      });
      if (plan.pro) useUpshotAccount.setState({ checkoutPendingSince: null });
    })
    .catch((error: unknown) => {
      useUpshotPlanStore.setState({
        email: session.email,
        fetchedAt: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      });
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** The signed-in user's plan; signed out reads as free. */
export function useUpshotPlan(): {
  plan: UpshotPlanStatus | null;
  email: string | null;
  isSignedIn: boolean;
  isLoading: boolean;
  checkoutPending: boolean;
  error: string | null;
} {
  const session = useUpshotAccount((state) => state.session);
  const loaded = useUpshotAccount((state) => state.loaded);
  const pendingSince = useUpshotAccount((state) => state.checkoutPendingSince);
  const planState = useUpshotPlanStore();
  const checkoutPending =
    pendingSince !== null && Date.now() - pendingSince < PENDING_CHECKOUT_MS;
  const email = session?.email ?? null;

  useEffect(() => {
    void ensureUpshotSessionLoaded();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void refreshUpshotPlan();
  }, [loaded, email]);

  // Refetch when the window regains focus (back from the browser checkout).
  useEffect(() => {
    if (!email) return;
    const onFocus = () => void refreshUpshotPlan(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [email]);

  // And every 60 s while a checkout is pending: Pro can take a moment.
  useEffect(() => {
    if (!email || !checkoutPending) return;
    const timer = window.setInterval(
      () => void refreshUpshotPlan(true),
      PENDING_POLL_MS,
    );
    return () => window.clearInterval(timer);
  }, [email, checkoutPending]);

  const current = email !== null && planState.email === email;
  return {
    plan: current ? planState.plan : null,
    email,
    isSignedIn: !!session,
    isLoading: !loaded || (!!session && !current),
    checkoutPending,
    error: current ? planState.error : null,
  };
}

/** Whether this user has Upshot Pro. */
export function useUpshotPro(): boolean {
  return useUpshotPlan().plan?.pro ?? false;
}

// ---------- the account dialog (sign up or sign in, then checkout) ----------

export type AccountMode = "signup" | "signin";

type UpgradeDialogState = {
  open: boolean;
  /** Fork: "Sign in" opens the sign-in form, Upgrade the sign-up form (ux-audit-oct3 D). */
  mode: AccountMode;
  interval: PlanInterval;
  /** Go on to checkout after sign-in (false for a plain "Sign in"). */
  checkout: boolean;
  error: string | null;
};

export const useUpgradeDialog = create<UpgradeDialogState>(() => ({
  open: false,
  mode: "signup",
  interval: "month",
  checkout: true,
  error: null,
}));

/** Open the account dialog to sign in or sign up only. */
export function openUpshotSignIn(): void {
  useUpgradeDialog.setState({
    open: true,
    mode: "signin",
    interval: "month",
    checkout: false,
    error: null,
  });
}

export function closeUpgradeDialog(): void {
  useUpgradeDialog.setState({ open: false, error: null });
}

async function openInBrowser(url: string): Promise<void> {
  const result = await openerCommands.openUrl(url, null);
  if (result.status === "error") {
    throw new UpshotRequestError("Could not open your browser.", 0);
  }
}

/** Create a Checkout Session on the Worker and open it in the browser. */
export async function startCheckout(interval: PlanInterval): Promise<void> {
  const { url } = await upshotAuthedRequest<{ url: string }>(
    "/billing/checkout",
    { body: { interval } },
  );
  await openInBrowser(url);
  useUpshotAccount.setState({ checkoutPendingSince: Date.now() });
}

/**
 * Start the Upshot Pro upgrade. Signed out: the account dialog opens first,
 * then checkout. Errors show in that dialog.
 */
export async function openUpgrade(interval: PlanInterval = "month") {
  await ensureUpshotSessionLoaded();
  if (!useUpshotAccount.getState().session) {
    useUpgradeDialog.setState({
      open: true,
      mode: "signup",
      interval,
      checkout: true,
      error: null,
    });
    return;
  }
  try {
    await startCheckout(interval);
  } catch (error) {
    useUpgradeDialog.setState({
      open: true,
      mode: "signup",
      interval,
      checkout: true,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Open the Stripe customer portal (docs.stripe.com/customer-management/integrate-customer-portal). */
export async function openManageSubscription(): Promise<void> {
  const { url } = await upshotAuthedRequest<{ url: string }>(
    "/billing/portal",
    { method: "POST", body: {} },
  );
  await openInBrowser(url);
}
