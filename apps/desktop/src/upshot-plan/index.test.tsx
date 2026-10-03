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
  useUpgradeDialog,
  useUpshotAccount,
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
    });
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

describe("openUpgrade", () => {
  beforeEach(() => {
    mocks.saved = null;
    mocks.fetch.mockReset();
    mocks.openUrl.mockClear();
    resetUpshotAccountForTests();
    useUpgradeDialog.setState({ open: false, error: null });
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
