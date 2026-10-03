import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saved: null as string | null,
  fetch: vi.fn(),
  openUrl: vi.fn(async () => ({ status: "ok", data: null })),
}));

vi.mock("~/env", () => ({
  env: { VITE_AI_API_URL: "https://upshot-ai.example.workers.dev" },
}));
vi.mock("~/ai/provider-fetch", () => ({ providerFetch: mocks.fetch }));
vi.mock("@anlg/plugin-opener2", () => ({
  commands: { openUrl: mocks.openUrl },
}));
vi.mock("@anlg/plugin-store2", () => ({
  commands: {
    getSecret: vi.fn(async () => ({ status: "ok", data: mocks.saved })),
    setSecret: vi.fn(async () => ({ status: "ok", data: null })),
    deleteSecret: vi.fn(async () => ({ status: "ok", data: null })),
  },
}));

import {
  openUpgrade,
  refreshUpshotPlan,
  stopWaitingForCheckout,
  useUpgradeDialog,
  useUpshotAccount,
  useUpshotPlan,
  useUpshotPlanStore,
  useUpshotPro,
} from "./index";
import { resetUpshotAccountForTests } from "./session";

function signedIn() {
  mocks.saved = JSON.stringify({
    access_token: "token-1",
    refresh_token: "refresh-1",
    expires_at: Date.now() / 1000 + 3600,
    email: "judge@example.com",
  });
}

function respondWith(routes: Record<string, unknown>) {
  mocks.fetch.mockImplementation(async (url: string) => {
    const path = new URL(url).pathname;
    if (!(path in routes)) throw new Error(`unexpected ${path}`);
    return Response.json(routes[path]);
  });
}

afterEach(() => cleanup());

describe("useUpshotPro", () => {
  beforeEach(() => {
    mocks.saved = null;
    mocks.fetch.mockReset();
    mocks.openUrl.mockClear();
    resetUpshotAccountForTests();
    useUpshotPlanStore.setState({
      plan: null,
      email: null,
      fetchedAt: 0,
      error: null,
      errorStatus: null,
    });
    localStorage.clear();
    useUpgradeDialog.setState({ open: false, error: null });
  });

  it("is false when signed out, with no network call", async () => {
    const { result } = renderHook(() => useUpshotPro());
    await waitFor(() => expect(useUpshotAccount.getState().loaded).toBe(true));
    expect(result.current).toBe(false);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("is true when /billing/status says pro, sent with the token", async () => {
    signedIn();
    respondWith({
      "/billing/status": {
        pro: true,
        status: "active",
        current_period_end: null,
        interval: "month",
      },
    });
    const { result } = renderHook(() => useUpshotPro());
    await waitFor(() => expect(result.current).toBe(true));
    const init = mocks.fetch.mock.calls[0][1];
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer token-1",
    );
  });

  it("is false for a past-due subscription", async () => {
    signedIn();
    respondWith({
      "/billing/status": {
        pro: false,
        status: "past_due",
        current_period_end: null,
        interval: null,
      },
    });
    const { result } = renderHook(() => useUpshotPro());
    await waitFor(() =>
      expect(useUpshotPlanStore.getState().plan).not.toBe(null),
    );
    expect(result.current).toBe(false);
  });

  it("refetches when the window regains focus", async () => {
    signedIn();
    let pro = false;
    mocks.fetch.mockImplementation(async () =>
      Response.json({
        pro,
        status: pro ? "active" : null,
        current_period_end: null,
        interval: null,
      }),
    );
    const { result } = renderHook(() => useUpshotPro());
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
    expect(result.current).toBe(false);

    pro = true;
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(result.current).toBe(true));
  });
});

// journey-account-settings P2 "plan cache", P3 "switching accounts".
describe("plan cache and fetch", () => {
  beforeEach(() => {
    mocks.saved = null;
    mocks.fetch.mockReset();
    resetUpshotAccountForTests();
    useUpshotPlanStore.setState({
      plan: null,
      email: null,
      fetchedAt: 0,
      error: null,
      errorStatus: null,
    });
    localStorage.clear();
  });

  const PRO = {
    pro: true,
    status: "active",
    current_period_end: null,
    interval: "year",
  };

  it("keeps the last plan per email on this Mac", async () => {
    signedIn();
    respondWith({ "/billing/status": PRO });
    renderHook(() => useUpshotPro());
    await waitFor(() =>
      expect(useUpshotPlanStore.getState().plan?.pro).toBe(true),
    );
    const saved = JSON.parse(localStorage.getItem("upshot-plan-cache")!);
    expect(saved.state).toEqual({ plan: PRO, email: "judge@example.com" });
  });

  it("offline at launch, a cached Pro plan still shows Pro, not loading", async () => {
    localStorage.setItem(
      "upshot-plan-cache",
      JSON.stringify({
        state: { plan: PRO, email: "judge@example.com" },
        version: 1,
      }),
    );
    await useUpshotPlanStore.persist.rehydrate();
    signedIn();
    mocks.fetch.mockRejectedValue(new TypeError("offline"));
    const { result } = renderHook(() => useUpshotPlan());
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalled());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.plan?.pro).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.errorStatus).toBe(0);
  });

  it("a cached plan for another email is never shown", async () => {
    localStorage.setItem(
      "upshot-plan-cache",
      JSON.stringify({
        state: { plan: PRO, email: "someone@example.com" },
        version: 1,
      }),
    );
    await useUpshotPlanStore.persist.rehydrate();
    signedIn();
    mocks.fetch.mockRejectedValue(new TypeError("offline"));
    const { result } = renderHook(() => useUpshotPlan());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.plan).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("is loading until the first answer, with no cache", async () => {
    signedIn();
    let answer!: (response: Response) => void;
    mocks.fetch.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );
    const { result } = renderHook(() => useUpshotPlan());
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalled());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.plan).toBeNull();
    answer(Response.json(PRO));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.plan?.pro).toBe(true);
  });

  it("a sign-in during an older account's fetch gets its own plan", async () => {
    const answers: Array<(response: Response) => void> = [];
    mocks.fetch.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          answers.push(resolve);
        }),
    );
    const session = (email: string) => ({
      access_token: `token-${email}`,
      refresh_token: "refresh",
      expires_at: Date.now() / 1000 + 3600,
      email,
    });
    useUpshotAccount.setState({
      session: session("a@example.com"),
      loaded: true,
    });
    const first = refreshUpshotPlan(true);
    await waitFor(() => expect(answers).toHaveLength(1));
    useUpshotAccount.setState({ session: session("b@example.com") });
    const second = refreshUpshotPlan(true);
    await waitFor(() => expect(answers).toHaveLength(2));
    answers[1](Response.json(PRO));
    await second;
    answers[0](Response.json({ ...PRO, pro: false, status: null }));
    await first;
    expect(useUpshotPlanStore.getState()).toMatchObject({
      email: "b@example.com",
      plan: { pro: true },
    });
  });

  it("Stop waiting clears a pending checkout", () => {
    useUpshotAccount.setState({ checkoutPendingSince: Date.now() });
    stopWaitingForCheckout();
    expect(useUpshotAccount.getState().checkoutPendingSince).toBeNull();
  });
});

describe("openUpgrade", () => {
  beforeEach(() => {
    mocks.saved = null;
    mocks.fetch.mockReset();
    mocks.openUrl.mockClear();
    resetUpshotAccountForTests();
    useUpgradeDialog.setState({ open: false, error: null });
  });

  // journey-account-settings P2 "already_pro".
  it("already Pro on the Worker opens the You're on Upshot Pro state", async () => {
    signedIn();
    mocks.fetch.mockImplementation(async (url: string) =>
      new URL(url).pathname === "/billing/checkout"
        ? Response.json(
            {
              error: {
                message: "You already have Upshot Pro.",
                code: "already_pro",
              },
            },
            { status: 409 },
          )
        : Response.json({
            pro: true,
            status: "active",
            current_period_end: null,
            interval: "year",
          }),
    );
    await openUpgrade("year");
    expect(useUpgradeDialog.getState()).toMatchObject({
      open: true,
      error: null,
      alreadyPro: true,
    });
    expect(useUpshotPlanStore.getState().plan?.pro).toBe(true);
    expect(mocks.openUrl).not.toHaveBeenCalled();
  });

  it("opens the account dialog when signed out", async () => {
    await openUpgrade("year");
    expect(useUpgradeDialog.getState()).toMatchObject({
      open: true,
      interval: "year",
      checkout: true,
    });
    expect(mocks.openUrl).not.toHaveBeenCalled();
  });

  it("opens Stripe Checkout in the browser when signed in", async () => {
    signedIn();
    respondWith({
      "/billing/checkout": { url: "https://checkout.stripe.com/c/pay/cs_test" },
    });
    await openUpgrade("year");

    const [url, init] = mocks.fetch.mock.calls[0];
    expect(url).toBe("https://upshot-ai.example.workers.dev/billing/checkout");
    expect(JSON.parse(init.body)).toEqual({ interval: "year" });
    expect(mocks.openUrl).toHaveBeenCalledWith(
      "https://checkout.stripe.com/c/pay/cs_test",
      null,
    );
    expect(useUpshotAccount.getState().checkoutPendingSince).not.toBeNull();
    expect(useUpgradeDialog.getState().open).toBe(false);
  });

  it("shows a checkout error in the dialog", async () => {
    signedIn();
    mocks.fetch.mockResolvedValue(
      Response.json(
        { error: { message: "You already have Upshot Pro." } },
        { status: 409 },
      ),
    );
    await openUpgrade();
    expect(useUpgradeDialog.getState()).toMatchObject({
      open: true,
      error: "You already have Upshot Pro.",
    });
  });
});
