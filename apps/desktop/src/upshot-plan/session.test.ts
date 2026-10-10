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
  cancelUpshotOAuth,
  completeUpshotOAuth,
  createPkcePair,
  deleteUpshotAccount,
  getUpshotAccessToken,
  getUpshotSttPass,
  getUpshotSttToken,
  isPasswordOnlySession,
  isSignInRequiredError,
  resetUpshotAccountForTests,
  SIGN_IN_REQUIRED,
  startUpshotOAuth,
  signInUpshot,
  upshotAccountProvider,
  signOutUpshot,
  upshotAuthedRequest,
  upshotAuthFetch,
  UpshotRequestError,
  useUpshotAccount,
} from "./session";

const NOW = 1_800_000_000;

// A Supabase-style access token whose app_metadata lists the sign-in methods.
function jwt(providers: string[]) {
  const encode = (value: object) =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${encode({ alg: "HS256" })}.${encode({
    app_metadata: { provider: providers[0], providers },
  })}.signature`;
}

function saveSession(expiresAt: number, accessToken = "old-access") {
  mocks.saved = JSON.stringify({
    access_token: accessToken,
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
    cancelUpshotOAuth();
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

  it("upshotAuthFetch with no network on refresh falls back to a plain request", async () => {
    saveSession(Date.now() / 1000 - 10);
    mocks.fetch
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(Response.json({}));
    await upshotAuthFetch("https://upshot-ai.example.workers.dev/llm/x", {
      headers: { Authorization: "Bearer stale" },
    });
    // Offline: the request goes out the usual way and fails the usual way.
    const [, init] = mocks.fetch.mock.calls[1];
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer stale");
  });

  it("upshotAuthFetch always sends the signed-in token, replacing any other", async () => {
    saveSession(Date.now() / 1000 + 3600);
    mocks.fetch.mockResolvedValue(Response.json({ ok: true }));
    const response = await upshotAuthFetch(
      "https://upshot-ai.example.workers.dev/llm/x",
      { headers: { Authorization: "Bearer stale" } },
    );
    expect(response.status).toBe(200);
    const [, init] = mocks.fetch.mock.calls[0];
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer old-access",
    );
  });

  it("upshotAuthFetch signed out answers 401 sign_in_required with no network call", async () => {
    const response = await upshotAuthFetch(
      "https://upshot-ai.example.workers.dev/llm/x",
      { method: "POST", body: "{}" },
    );
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { message: SIGN_IN_REQUIRED, code: "sign_in_required" },
    });
    expect(SIGN_IN_REQUIRED).toBe("Sign in to use Upshot AI. It's free.");
  });

  it("upshotAuthFetch answers sign_in_required when the refresh token is rejected", async () => {
    saveSession(Date.now() / 1000 - 10);
    mocks.fetch.mockResolvedValue(
      Response.json({ error: { message: "ended" } }, { status: 401 }),
    );
    const response = await upshotAuthFetch(
      "https://upshot-ai.example.workers.dev/llm/x",
    );
    // Only the refresh call went out; the LLM request never did.
    expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("sign_in_required");
  });

  it("upshotAuthFetch replaces a 401 from the Worker with the sign-in answer", async () => {
    saveSession(Date.now() / 1000 + 3600);
    mocks.fetch.mockResolvedValue(
      Response.json({ error: { message: "Update the app." } }, { status: 401 }),
    );
    const response = await upshotAuthFetch(
      "https://upshot-ai.example.workers.dev/llm/x",
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { message: SIGN_IN_REQUIRED, code: "sign_in_required" },
    });
  });

  // Fork (Oct 9 bug sweep): a refused token is refreshed once and retried.
  it("upshotAuthFetch refreshes once after a Worker 401 and retries", async () => {
    saveSession(Date.now() / 1000 + 3600);
    mocks.fetch
      .mockResolvedValueOnce(
        Response.json({ error: { message: "x" } }, { status: 401 }),
      )
      .mockResolvedValueOnce(
        Response.json({
          access_token: "new-access",
          refresh_token: "new-refresh",
          expires_at: Date.now() / 1000 + 3600,
          user: { id: "u", email: "judge@example.com" },
        }),
      )
      .mockResolvedValueOnce(Response.json({ choices: [] }));
    const response = await upshotAuthFetch(
      "https://upshot-ai.example.workers.dev/llm/x",
      { method: "POST", body: "{}" },
    );
    expect(response.status).toBe(200);
    const [, , retry] = mocks.fetch.mock.calls;
    expect(new Headers(retry[1].headers).get("Authorization")).toBe(
      "Bearer new-access",
    );
    expect(useUpshotAccount.getState().session?.access_token).toBe(
      "new-access",
    );
  });

  it("upshotAuthFetch signs out when the account is refused even after a refresh", async () => {
    saveSession(Date.now() / 1000 + 3600);
    mocks.fetch.mockImplementation(async (url: string) =>
      url.endsWith("/auth/refresh")
        ? Response.json({
            access_token: "new-access",
            refresh_token: "new-refresh",
            expires_at: Date.now() / 1000 + 3600,
            user: { id: "u", email: "judge@example.com" },
          })
        : Response.json({ error: { message: "x" } }, { status: 401 }),
    );
    const response = await upshotAuthFetch(
      "https://upshot-ai.example.workers.dev/llm/x",
    );
    expect((await response.json()).error.code).toBe("sign_in_required");
    expect(useUpshotAccount.getState().session).toBeNull();
    expect(useUpshotAccount.getState().sessionEnded).toBe(true);
  });

  it("a Sign out while a refresh runs stays signed out", async () => {
    saveSession(Date.now() / 1000 - 10);
    let answer: (value: Response) => void = () => {};
    mocks.fetch.mockReturnValue(
      new Promise<Response>((resolve) => {
        answer = resolve;
      }),
    );
    const token = getUpshotAccessToken();
    await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalled());
    await signOutUpshot();
    answer(
      Response.json({
        access_token: "new-access",
        refresh_token: "new-refresh",
        expires_at: Date.now() / 1000 + 3600,
        user: { id: "u", email: "judge@example.com" },
      }),
    );
    await expect(token).rejects.toMatchObject({ status: 401 });
    expect(useUpshotAccount.getState().session).toBeNull();
    expect(mocks.saved).toBeNull();
  });

  it("upshotAuthFetch passes other Worker answers through", async () => {
    saveSession(Date.now() / 1000 + 3600);
    mocks.fetch.mockResolvedValue(
      Response.json({ error: { message: "Out of credit." } }, { status: 402 }),
    );
    const response = await upshotAuthFetch(
      "https://upshot-ai.example.workers.dev/llm/x",
    );
    expect(response.status).toBe(402);
  });

  it("recognizes the sign-in error by code and by message", () => {
    expect(
      isSignInRequiredError(
        new UpshotRequestError("x", 401, "sign_in_required"),
      ),
    ).toBe(true);
    expect(isSignInRequiredError(new Error(SIGN_IN_REQUIRED))).toBe(true);
    expect(
      isSignInRequiredError(
        new Error("Sign in to use Upshot transcription. It's free."),
      ),
    ).toBe(true);
    expect(isSignInRequiredError(new Error("Out of credit."))).toBe(false);
    expect(
      isSignInRequiredError(new UpshotRequestError("Down", 503, "down")),
    ).toBe(false);
  });

  it("the transcription token is null signed out and when the session ended", async () => {
    expect(await getUpshotSttToken()).toBeNull();

    resetUpshotAccountForTests();
    saveSession(Date.now() / 1000 - 10);
    mocks.fetch.mockResolvedValue(
      Response.json({ error: { message: "ended" } }, { status: 401 }),
    );
    expect(await getUpshotSttToken()).toBeNull();
  });

  it("the transcription token is the saved one when offline", async () => {
    saveSession(Date.now() / 1000 - 10);
    mocks.fetch.mockRejectedValue(new TypeError("offline"));
    expect(await getUpshotSttToken()).toBe("old-access");
  });

  // Fork (Oct 9 bug sweep): live recording sends a 3-hour pass, so a
  // reconnect after the access token expires still works.
  it("live recording asks the Worker for a transcription pass", async () => {
    saveSession(Date.now() / 1000 + 3600, "fresh-access");
    mocks.fetch.mockResolvedValue(
      Response.json({ pass: "sp1.sealed", expires_at: 1 }),
    );
    expect(await getUpshotSttPass()).toBe("sp1.sealed");
    const [url, init] = mocks.fetch.mock.calls[0]!;
    expect(url).toBe("https://upshot-ai.example.workers.dev/stt/pass");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer fresh-access",
    );
  });

  it("the pass is null signed out, and the access token when the Worker gives none", async () => {
    expect(await getUpshotSttPass()).toBeNull();
    expect(mocks.fetch).not.toHaveBeenCalled();

    resetUpshotAccountForTests();
    saveSession(Date.now() / 1000 + 3600, "fresh-access");
    mocks.fetch.mockResolvedValue(
      Response.json({ error: { message: "Not found" } }, { status: 404 }),
    );
    expect(await getUpshotSttPass()).toBe("fresh-access");

    mocks.fetch.mockResolvedValue(
      Response.json(
        { error: { message: "Sign in", code: "sign_in_required" } },
        { status: 401 },
      ),
    );
    expect(await getUpshotSttPass()).toBeNull();
  });

  describe("password-only sessions", () => {
    it("flags tokens with no Google or Microsoft sign-in method", () => {
      expect(isPasswordOnlySession(jwt(["email"]))).toBe(true);
      expect(isPasswordOnlySession(jwt([]))).toBe(true);
    });

    it("accepts Google and Microsoft (azure), alone or with email", () => {
      expect(isPasswordOnlySession(jwt(["google"]))).toBe(false);
      expect(isPasswordOnlySession(jwt(["azure"]))).toBe(false);
      expect(isPasswordOnlySession(jwt(["email", "google"]))).toBe(false);
    });

    it("keeps a token that does not decode", () => {
      expect(isPasswordOnlySession("not-a-jwt")).toBe(false);
      expect(isPasswordOnlySession("a.%%%.c")).toBe(false);
      expect(isPasswordOnlySession("")).toBe(false);
    });

    it("keeps a token with no provider list", () => {
      const payload = btoa(JSON.stringify({ sub: "u" }));
      expect(isPasswordOnlySession(`h.${payload}.s`)).toBe(false);
    });

    it("drops a saved email-and-password session on load", async () => {
      saveSession(Date.now() / 1000 + 3600, jwt(["email"]));
      expect(await getUpshotAccessToken()).toBeNull();
      expect(useUpshotAccount.getState().session).toBeNull();
      expect(useUpshotAccount.getState().loaded).toBe(true);
    });

    it("keeps a saved Google session on load", async () => {
      const token = jwt(["google"]);
      saveSession(Date.now() / 1000 + 3600, token);
      expect(await getUpshotAccessToken()).toBe(token);
      expect(useUpshotAccount.getState().session?.email).toBe(
        "judge@example.com",
      );
    });

    it("a dropped password session makes Upshot AI ask to sign in", async () => {
      saveSession(Date.now() / 1000 + 3600, jwt(["email"]));
      const response = await upshotAuthFetch(
        "https://upshot-ai.example.workers.dev/llm/x",
      );
      expect(response.status).toBe(401);
      expect(mocks.fetch).not.toHaveBeenCalled();
    });
  });

  describe("Google and Microsoft sign-in", () => {
    it("makes a 43-character PKCE verifier and its S256 challenge", async () => {
      const { verifier, challenge } = await createPkcePair();
      expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(verifier),
      );
      const expected = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      expect(challenge).toBe(expected);
    });

    it("starts at the Worker with the provider, challenge and loopback redirect", async () => {
      const openUrl = vi.fn(async (_url: string) => {});
      await startUpshotOAuth("azure", {
        startCallbackServer: async () => 4321,
        openUrl,
      });
      const url = new URL(openUrl.mock.calls[0][0] as string);
      expect(url.origin + url.pathname).toBe(
        "https://upshot-ai.example.workers.dev/auth/oauth/start",
      );
      expect(url.searchParams.get("provider")).toBe("azure");
      expect(url.searchParams.get("code_challenge")).toMatch(/^[\w-]{43}$/);
      expect(url.searchParams.get("redirect_to")).toBe(
        "http://127.0.0.1:4321/auth/callback",
      );
    });

    it("completing swaps the code and verifier for a session, once", async () => {
      const openUrl = vi.fn(async (_url: string) => {});
      await startUpshotOAuth("google", {
        startCallbackServer: async () => 4321,
        openUrl,
      });
      const challenge = new URL(
        openUrl.mock.calls[0][0] as string,
      ).searchParams.get("code_challenge")!;
      mocks.fetch.mockResolvedValue(
        Response.json({
          access_token: jwt(["google"]),
          refresh_token: "r",
          expires_at: NOW + 3600,
          user: { id: "u", email: "judge@example.com" },
        }),
      );

      expect(await completeUpshotOAuth("the-code")).toBe(true);
      const [url, init] = mocks.fetch.mock.calls[0];
      expect(url).toBe(
        "https://upshot-ai.example.workers.dev/auth/oauth/exchange",
      );
      const body = JSON.parse(init.body);
      expect(body.code).toBe("the-code");
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(body.code_verifier),
      );
      expect(
        btoa(String.fromCharCode(...new Uint8Array(digest)))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, ""),
      ).toBe(challenge);
      expect(useUpshotAccount.getState().session?.email).toBe(
        "judge@example.com",
      );
      expect(JSON.parse(mocks.saved!).refresh_token).toBe("r");

      // The same code arrives again through the upshot:// link.
      expect(await completeUpshotOAuth("the-code")).toBe(false);
      expect(mocks.fetch).toHaveBeenCalledOnce();
    });

    it("Connect calendar asks for calendar=1 and says so at the exchange", async () => {
      const openUrl = vi.fn(async (_url: string) => {});
      await startUpshotOAuth(
        "azure",
        { startCallbackServer: async () => 4321, openUrl },
        { calendar: true },
      );
      expect(
        new URL(openUrl.mock.calls[0][0] as string).searchParams.get(
          "calendar",
        ),
      ).toBe("1");
      mocks.fetch.mockResolvedValue(
        Response.json({
          access_token: jwt(["azure"]),
          refresh_token: "r",
          expires_at: NOW + 3600,
          user: { id: "u", email: "judge@example.com" },
        }),
      );

      expect(await completeUpshotOAuth("the-code")).toBe(true);
      const body = JSON.parse(mocks.fetch.mock.calls[0][1].body);
      expect(body).toMatchObject({ provider: "azure", calendar: true });
      // Remembered, so Connect calendar asks Microsoft again even when the
      // account was first made with email.
      expect(useUpshotAccount.getState().session?.provider).toBe("azure");
      expect(JSON.parse(mocks.saved!).provider).toBe("azure");
    });

    it("Connect calendar with another account keeps the signed-in one", async () => {
      saveSession(NOW + 3600, jwt(["google"]));
      await getUpshotAccessToken(NOW);
      await startUpshotOAuth(
        "google",
        { startCallbackServer: async () => 4321, openUrl: async () => {} },
        { calendar: true },
      );
      mocks.fetch.mockResolvedValue(
        Response.json({
          access_token: jwt(["google"]),
          refresh_token: "other-refresh",
          expires_at: NOW + 3600,
          user: { id: "u2", email: "someone.else@example.com" },
        }),
      );
      await expect(completeUpshotOAuth("the-code")).rejects.toMatchObject({
        code: "calendar_other_account",
      });
      expect(useUpshotAccount.getState().session?.email).toBe(
        "judge@example.com",
      );
      expect(JSON.parse(mocks.saved!).refresh_token).toBe("old-refresh");
    });

    it("plain sign-in asks for no calendar and sends only the code", async () => {
      const openUrl = vi.fn(async (_url: string) => {});
      await startUpshotOAuth("google", {
        startCallbackServer: async () => 4321,
        openUrl,
      });
      expect(
        new URL(openUrl.mock.calls[0][0] as string).searchParams.has(
          "calendar",
        ),
      ).toBe(false);
      mocks.fetch.mockResolvedValue(
        Response.json({
          access_token: jwt(["google"]),
          refresh_token: "r",
          expires_at: NOW + 3600,
          user: { id: "u", email: "judge@example.com" },
        }),
      );

      await completeUpshotOAuth("the-code");
      expect(
        Object.keys(JSON.parse(mocks.fetch.mock.calls[0][1].body)).sort(),
      ).toEqual(["code", "code_verifier"]);
    });

    it("names the account's provider from the token", () => {
      expect(upshotAccountProvider(jwt(["google"]))).toBe("google");
      expect(upshotAccountProvider(jwt(["azure", "email"]))).toBe("azure");
      expect(upshotAccountProvider(jwt(["email"]))).toBeNull();
      expect(upshotAccountProvider("not-a-token")).toBeNull();
    });

    it("completing with no sign-in waiting does nothing", async () => {
      expect(await completeUpshotOAuth("stray")).toBe(false);
      expect(mocks.fetch).not.toHaveBeenCalled();
    });
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
