import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  session: null as null | { access_token: string; provider?: string },
}));

vi.mock("~/ai/provider-fetch", () => ({ providerFetch: mocks.fetch }));
vi.mock("~/upshot-plan/session", () => ({
  upshotWorkerOrigin: () => "https://upshotnotes.com",
  upshotAccountProvider: () => null,
  useUpshotAccount: (select: (state: { session: unknown }) => unknown) =>
    select({ session: mocks.session }),
}));
vi.mock("~/upshot-plan/sign-in", () => ({
  beginUpshotSignIn: vi.fn(),
  stopWaitingForSignIn: vi.fn(),
  useUpshotSignIn: (select: (state: object) => unknown) =>
    select({ waitingFor: null, error: null }),
}));

import { useCloudCalendarAccount } from "./cloud-connect";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("calendar on/off switch", () => {
  beforeEach(() => {
    mocks.fetch.mockReset();
    mocks.session = { access_token: "t", provider: "google" };
  });

  it("offers Connect for Google Calendar only once the Worker turns it on", async () => {
    mocks.fetch.mockResolvedValue(
      Response.json({ google: true, outlook: false }),
    );
    const { result } = renderHook(() => useCloudCalendarAccount(), {
      wrapper,
    });

    // Off (coming soon) until the Worker answers.
    expect(result.current?.available).toBe(false);
    await waitFor(() =>
      expect(result.current).toEqual({
        account: "google",
        provider: "google",
        available: true,
      }),
    );
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://upshotnotes.com/calendar/providers",
    );
  });

  it("stays coming soon when the Worker says off", async () => {
    mocks.fetch.mockResolvedValue(
      Response.json({ google: false, outlook: true }),
    );
    const { result } = renderHook(() => useCloudCalendarAccount(), {
      wrapper,
    });

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalled());
    expect(result.current).toEqual({
      account: "google",
      provider: "google",
      available: false,
    });
  });

  it("stays coming soon when the Worker can't be reached", async () => {
    mocks.fetch.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useCloudCalendarAccount(), {
      wrapper,
    });

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalled());
    expect(result.current?.available).toBe(false);
  });

  it("asks nothing while signed out", () => {
    mocks.session = null;
    const { result } = renderHook(() => useCloudCalendarAccount(), {
      wrapper,
    });

    expect(result.current).toBeNull();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
