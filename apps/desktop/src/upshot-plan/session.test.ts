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
  getUpshotAccessToken,
  resetUpshotAccountForTests,
  signInUpshot,
  signOutUpshot,
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
    expect(await getUpshotAccessToken(NOW)).toBeNull();
    expect(useUpshotAccount.getState().session).toBeNull();
    expect(mocks.saved).toBeNull();
  });

  it("keeps the session when the network is down", async () => {
    saveSession(NOW - 10);
    mocks.fetch.mockRejectedValue(new TypeError("offline"));
    expect(await getUpshotAccessToken(NOW)).toBeNull();
    expect(useUpshotAccount.getState().session?.email).toBe(
      "judge@example.com",
    );
  });
});
