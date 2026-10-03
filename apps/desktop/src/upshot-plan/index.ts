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
import { createJSONStorage, persist } from "zustand/middleware";

import { commands as openerCommands } from "@anlg/plugin-opener2";

import {
  ensureUpshotSessionLoaded,
  upshotAuthedRequest,
  UpshotRequestError,
  upshotWorkerOrigin,
  useUpshotAccount,
} from "./session";

export {
  deleteUpshotAccount,
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
  /** HTTP status of the last failure; 0 means offline. */
  errorStatus: number | null;
};

// Fork: the last plan per email is kept on this Mac and shown at launch, so
// a paying user never sees "Free" while /billing/status loads or when the
// Worker is unreachable (journey-account-settings P2; NN/g #1). The Worker
// still checks Pro on every picked-model request.
export const useUpshotPlanStore = create<PlanState>()(
  persist(
    () => ({
      plan: null as UpshotPlanStatus | null,
      email: null as string | null,
      fetchedAt: 0,
      error: null as string | null,
      errorStatus: null as number | null,
    }),
    {
      name: "upshot-plan-cache",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ plan: state.plan, email: state.email }),
    },
  ),
);

// Fork: one fetch per email, so a sign-in during an older account's fetch
// gets its own plan (journey-account-settings P3).
let inFlight: { email: string; promise: Promise<void> } | null = null;

/** Fetch GET /billing/status for the signed-in user (deduplicated). */
export function refreshUpshotPlan(force = false): Promise<void> {
  const session = useUpshotAccount.getState().session;
  if (!session) {
    useUpshotPlanStore.setState({
      plan: null,
      email: null,
      error: null,
      errorStatus: null,
    });
    return Promise.resolve();
  }
  const email = session.email;
  const current = useUpshotPlanStore.getState();
  if (
    !force &&
    current.email === email &&
    Date.now() - current.fetchedAt < FRESH_MS
  ) {
    return Promise.resolve();
  }
  if (inFlight?.email === email) return inFlight.promise;
  const stillSignedIn = () =>
    useUpshotAccount.getState().session?.email === email;
  const promise = upshotAuthedRequest<UpshotPlanStatus>("/billing/status")
    .then((plan) => {
      if (!stillSignedIn()) return;
      useUpshotPlanStore.setState({
        plan,
        email,
        fetchedAt: Date.now(),
        error: null,
        errorStatus: null,
      });
      if (plan.pro) useUpshotAccount.setState({ checkoutPendingSince: null });
    })
    .catch((error: unknown) => {
      if (!stillSignedIn()) return;
      useUpshotPlanStore.setState((state) => ({
        // Keep the last known plan only when it belongs to this account.
        plan: state.email === email ? state.plan : null,
        email,
        fetchedAt: Date.now(),
        error: error instanceof Error ? error.message : String(error),
        errorStatus: error instanceof UpshotRequestError ? error.status : 0,
      }));
    })
    .finally(() => {
      if (inFlight?.promise === promise) inFlight = null;
    });
  inFlight = { email, promise };
  return promise;
}

/** The signed-in user's plan; signed out reads as free. */
export function useUpshotPlan(): {
  plan: UpshotPlanStatus | null;
  email: string | null;
  isSignedIn: boolean;
  isLoading: boolean;
  checkoutPending: boolean;
  error: string | null;
  errorStatus: number | null;
  sessionEnded: boolean;
} {
  const session = useUpshotAccount((state) => state.session);
  const loaded = useUpshotAccount((state) => state.loaded);
  const pendingSince = useUpshotAccount((state) => state.checkoutPendingSince);
  const sessionEnded = useUpshotAccount((state) => state.sessionEnded);
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
  const plan = current ? planState.plan : null;
  return {
    plan,
    email,
    isSignedIn: !!session,
    // Loading only until a plan or an error is known for this account.
    isLoading:
      !loaded || (!!session && (!current || (!plan && !planState.error))),
    checkoutPending,
    error: current ? planState.error : null,
    errorStatus: current ? planState.errorStatus : null,
    sessionEnded: !session && sessionEnded,
  };
}

/** Fork: "Stop waiting" after a checkout canceled in the browser (journey-account-settings P3). */
export function stopWaitingForCheckout(): void {
  useUpshotAccount.setState({ checkoutPendingSince: null });
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
  /** The Worker said this account already has Pro: open on that state. */
  alreadyPro: boolean;
};

export const useUpgradeDialog = create<UpgradeDialogState>(() => ({
  open: false,
  mode: "signup",
  interval: "month",
  checkout: true,
  error: null,
  alreadyPro: false,
}));

/** The Worker's 409 for an account that already has Pro. */
export function isAlreadyPro(error: unknown): boolean {
  return error instanceof UpshotRequestError && error.code === "already_pro";
}

/** Open the account dialog to sign in or sign up only. */
export function openUpshotSignIn(): void {
  useUpgradeDialog.setState({
    open: true,
    mode: "signin",
    interval: "month",
    checkout: false,
    error: null,
    alreadyPro: false,
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

// Fork: the privacy policy is a static page on the Worker
// (grandmaster/worker/public/privacy.html). CalOPPA (Cal. Bus. & Prof. Code
// §22575(a)) asks for it to be conspicuously posted where accounts are made.
const DEFAULT_WORKER_ORIGIN = "https://upshot-ai.adam-694.workers.dev";

export function privacyPolicyUrl(): string {
  return `${upshotWorkerOrigin() ?? DEFAULT_WORKER_ORIGIN}/privacy`;
}

/** Open the privacy policy in the default browser. */
export async function openPrivacyPolicy(): Promise<void> {
  await openInBrowser(privacyPolicyUrl()).catch(() => {});
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
      alreadyPro: false,
    });
    return;
  }
  try {
    await startCheckout(interval);
  } catch (error) {
    // Fork: already Pro (a second Mac, or a stale plan) is a success, not
    // an error (journey-account-settings P2; NN/g #5, #9).
    if (isAlreadyPro(error)) {
      await refreshUpshotPlan(true);
      useUpgradeDialog.setState({
        open: true,
        mode: "signup",
        interval,
        checkout: true,
        error: null,
        alreadyPro: true,
      });
      return;
    }
    // Fork: an ended session means this person already has an account, so
    // the dialog opens on Sign in, not Create account (NN/g heuristic #2,
    // match the real world).
    const sessionEnded =
      error instanceof UpshotRequestError && error.code === "session_ended";
    useUpgradeDialog.setState({
      open: true,
      mode: sessionEnded ? "signin" : "signup",
      interval,
      checkout: true,
      error: error instanceof Error ? error.message : String(error),
      alreadyPro: false,
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
