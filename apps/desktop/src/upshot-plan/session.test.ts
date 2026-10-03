import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saved: null as string | null,
  fetch: vi.fn(),
}));

vi.mock("~/env", () => ({
  env: { VITE_AI_API_URL: "https://upshot-ai.example.workers.dev/" },
}));
vi.mock("~/ai/provider-fetch", () => ({ providerFetch: mocks.fetch }));
vi.mock("@anlg/plugin-store2", () => ({
  commands: {
    getSecret: vi.fn(async () => ({ status: "ok", data: mocks.saved })),
    setSecret: vi.fn(async (_scope: string, _key: string, value: string) => {
      mocks.saved = value;
      return { status: "ok", data: null };
    }),
    deleteSecret: vi.fn(async () => {
      mocks.saved = null;
      return { status: "ok", data: null };
    }),
  },
}));

import {
  deleteUpshotAccount,
  getUpshotAccessToken,
  resetUpshotAccountForTests,
  signInUpshot,
  signOutUpshot,
  upshotAuthedRequest,
  upshotAuthFetch,
  useUpshotAccount,
} from "./session";

const NOW = 1_800_000_000;

function saveSession(expiresAt: number) {
  mocks.saved = JSON.stringify({
    access_token: "old-access",
    refresh_token: "old-refresh",
    expires_at: expiresAt,
    email: "judge@example.com",
  });
}

describe("Upshot account session", () => {
  beforeEach(() => {
    mocks.saved = null;
    mocks.fetch.mockReset();
    resetUpshotAccountForTests();
  });

  it("signs in through the Worker and keeps the session in the Keychain", async () => {
    mocks.fetch.mockResolvedValue(
      Response.json({
        access_token: "a",
        refresh_token: "r",
        expires_at: NOW + 3600,
        user: { id: "u", email: "judge@example.com" },
      }),
    );
    await signInUpshot("signup", "judge@example.com", "password123");

    const [url, init] = mocks.fetch.mock.calls[0];
    expect(url).toBe("https://upshot-ai.example.workers.dev/auth/signup");
    expect(JSON.parse(init.body)).toEqual({
      email: "judge@example.com",
      password: "password123",
    });
    expect(JSON.parse(mocks.saved!)).toEqual({
      access_token: "a",
      refresh_token: "r",
      expires_at: NOW + 3600,
      email: "judge@example.com",
    });
    expect(useUpshotAccount.getState().session?.email).toBe(
      "judge@example.com",
    );

    await signOutUpshot();
    expect(mocks.saved).toBeNull();
    expect(useUpshotAccount.getState().session).toBeNull();
  });

  it("shows the Worker's error message", async () => {
    mocks.fetch.mockResolvedValue(
      Response.json(
        { error: { message: "Wrong email or password." } },
        { status: 400 },
      ),
    );
    await expect(
      signInUpshot("signin", "judge@example.com", "password123"),
    ).rejects.toThrow("Wrong email or password.");
    expect(useUpshotAccount.getState().session).toBeNull();
  });

  it("returns a fresh token without a network call", async () => {
    saveSession(NOW + 3600);
    expect(await getUpshotAccessToken(NOW)).toBe("old-access");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("refreshes a token about to expire, once for parallel callers", async () => {
    saveSession(NOW + 30);
    mocks.fetch.mockResolvedValue(
      Response.json({
        access_token: "new-access",
        refresh_token: "new-refresh",
        expires_at: NOW + 3600,
        user: { id: "u", email: "judge@example.com" },
      }),
    );

    const tokens = await Promise.all([
      getUpshotAccessToken(NOW),
      getUpshotAccessToken(NOW),
    ]);
    expect(tokens).toEqual(["new-access", "new-access"]);
    expect(mocks.fetch).toHaveBeenCalledOnce();
    const [url, init] = mocks.fetch.mock.calls[0];
    expect(url).toBe("https://upshot-ai.example.workers.dev/auth/refresh");
    expect(JSON.parse(init.body)).toEqual({ refresh_token: "old-refresh" });
    expect(JSON.parse(mocks.saved!).refresh_token).toBe("new-refresh");
  });

  it("signs out when the refresh token is rejected", async () => {
    saveSession(NOW - 10);
    mocks.fetch.mockResolvedValue(
      Response.json({ error: { message: "ended" } }, { status: 401 }),
    );
    // journey-account-settings P2: only a rejected refresh token reads
    // "Your session ended" and signs out.
    await expect(getUpshotAccessToken(NOW)).rejects.toMatchObject({
      message: "Your session ended. Sign in again.",
      status: 401,
      code: "session_ended",
    });
    expect(useUpshotAccount.getState().session).toBeNull();
    expect(useUpshotAccount.getState().sessionEnded).toBe(true);
    expect(mocks.saved).toBeNull();
  });

  it("keeps the session when the network is down", async () => {
    saveSession(NOW - 10);
    mocks.fetch.mockRejectedValue(new TypeError("offline"));
    await expect(getUpshotAccessToken(NOW)).rejects.toMatchObject({
      message: "Could not reach Upshot. Check your connection.",
      status: 0,
    });
    expect(useUpshotAccount.getState().session?.email).toBe(
      "judge@example.com",
    );
    expect(useUpshotAccount.getState().sessionEnded).toBe(false);
  });

  // journey-account-settings P2: offline after sleep is not "Sign in".
  it("an authed request offline says Could not reach, not Sign in", async () => {
    saveSession(Date.now() / 1000 - 10);
    mocks.fetch.mockRejectedValue(new TypeError("offline"));
    await expect(upshotAuthedRequest("/billing/status")).rejects.toMatchObject({
      message: "Could not reach Upshot. Check your connection.",
      status: 0,
    });
  });

  it("a Worker 5xx on refresh keeps the session and its message", async () => {
    saveSession(Date.now() / 1000 - 10);
    mocks.fetch.mockResolvedValue(
      Response.json({ error: { message: "Down" } }, { status: 503 }),
    );
    await expect(upshotAuthedRequest("/billing/status")).rejects.toMatchObject({
      message: "Down",
      status: 503,
    });
    expect(useUpshotAccount.getState().session).not.toBeNull();
  });

  it("signed out, an authed request still says Sign in to continue", async () => {
    await expect(upshotAuthedRequest("/billing/status")).rejects.toMatchObject({
      message: "Sign in to continue.",
      status: 401,
    });
  });

  it("upshotAuthFetch falls back to no token when the refresh fails", async () => {
    saveSession(Date.now() / 1000 - 10);
    mocks.fetch
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(Response.json({}));
    await upshotAuthFetch("https://upshot-ai.example.workers.dev/llm/x", {
      headers: { Authorization: "Bearer stale" },
    });
    const [, init] = mocks.fetch.mock.calls[1];
    expect(new Headers(init.headers).get("Authorization")).toBeNull();
  });

  it("signing in again clears the session-ended note", async () => {
    useUpshotAccount.setState({ sessionEnded: true });
    mocks.fetch.mockResolvedValue(
      Response.json({
        access_token: "a",
        refresh_token: "r",
        expires_at: NOW + 3600,
        user: { id: "u", email: "judge@example.com" },
      }),
    );
    await signInUpshot("signin", "judge@example.com", "password123");
    expect(useUpshotAccount.getState().sessionEnded).toBe(false);
  });

  // journey-account-settings P3: account deletion.
  it("deletes the account on the Worker, then signs out", async () => {
    saveSession(Date.now() / 1000 + 3600);
    mocks.fetch.mockResolvedValue(Response.json({ deleted: true }));
    await deleteUpshotAccount();
    const [url, init] = mocks.fetch.mock.calls[0];
    expect(url).toBe("https://upshot-ai.example.workers.dev/account/delete");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer old-access",
    );
    expect(useUpshotAccount.getState().session).toBeNull();
    expect(mocks.saved).toBeNull();
  });

  it("keeps the session when deletion fails", async () => {
    saveSession(Date.now() / 1000 + 3600);
    mocks.fetch.mockResolvedValue(
      Response.json(
        { error: { message: "Could not cancel your subscription." } },
        { status: 502 },
      ),
    );
    await expect(deleteUpshotAccount()).rejects.toThrow(
      "Could not cancel your subscription.",
    );
    expect(useUpshotAccount.getState().session).not.toBeNull();
  });
});
