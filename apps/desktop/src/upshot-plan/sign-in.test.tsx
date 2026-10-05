import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saved: null as string | null,
  fetch: vi.fn(),
  openUrl: vi.fn(
    async (
      _url: string,
      _app: string | null,
    ): Promise<{ status: string; data?: null; error?: string }> => ({
      status: "ok",
      data: null,
    }),
  ),
  startCallbackServer: vi.fn(
    async (
      _scheme: string,
      _port: number | null,
    ): Promise<{ status: string; data?: number; error?: string }> => ({
      status: "ok",
      data: 4321,
    }),
  ),
  stopCallbackServer: vi.fn(async () => ({ status: "ok", data: null })),
}));

vi.mock("~/env", () => ({
  env: { VITE_AI_API_URL: "https://upshot-ai.example.workers.dev/" },
}));
vi.mock("~/ai/provider-fetch", () => ({ providerFetch: mocks.fetch }));
vi.mock("@anlg/plugin-opener2", () => ({
  commands: { openUrl: mocks.openUrl },
}));
vi.mock("@anlg/plugin-deeplink2", () => ({
  commands: {
    startCallbackServer: mocks.startCallbackServer,
    stopCallbackServer: mocks.stopCallbackServer,
  },
}));
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
  isUpshotOAuthPending,
  resetUpshotAccountForTests,
  useUpshotAccount,
} from "./session";
import {
  beginUpshotSignIn,
  finishUpshotSignIn,
  stopWaitingForSignIn,
  UpshotSignInChoices,
  useUpshotSignIn,
} from "./sign-in";

function startedUrl() {
  return new URL(mocks.openUrl.mock.calls[0][0]);
}

function exchangeAnswer() {
  mocks.fetch.mockResolvedValue(
    Response.json({
      access_token: "access-1",
      refresh_token: "refresh-1",
      expires_at: Date.now() / 1000 + 3600,
      user: { id: "u", email: "judge@example.com" },
    }),
  );
}

describe("Upshot sign-in with Google or Microsoft", () => {
  beforeEach(() => {
    mocks.saved = null;
    mocks.fetch.mockReset();
    mocks.openUrl.mockClear();
    mocks.startCallbackServer.mockClear();
    mocks.stopCallbackServer.mockClear();
    cancelUpshotOAuth();
    useUpshotSignIn.setState({ waitingFor: null, error: null });
    resetUpshotAccountForTests();
  });
  afterEach(() => cleanup());

  describe("beginUpshotSignIn", () => {
    it("starts the loopback server and opens the Worker's start URL in the browser", async () => {
      await beginUpshotSignIn("google");

      expect(mocks.startCallbackServer).toHaveBeenCalledWith("upshot", null);
      expect(mocks.openUrl).toHaveBeenCalledOnce();
      expect(mocks.openUrl.mock.calls[0][1]).toBeNull();
      const url = startedUrl();
      expect(url.origin + url.pathname).toBe(
        "https://upshot-ai.example.workers.dev/auth/oauth/start",
      );
      expect(url.searchParams.get("provider")).toBe("google");
      expect(url.searchParams.get("code_challenge")).toMatch(
        /^[A-Za-z0-9_-]{43}$/,
      );
      expect(url.searchParams.get("redirect_to")).toBe(
        "http://127.0.0.1:4321/auth/callback",
      );
      expect(useUpshotSignIn.getState()).toEqual({
        waitingFor: "google",
        error: null,
      });
      expect(isUpshotOAuthPending()).toBe(true);
    });

    it("asks for azure when the person picks Microsoft", async () => {
      await beginUpshotSignIn("azure");
      expect(startedUrl().searchParams.get("provider")).toBe("azure");
      expect(useUpshotSignIn.getState().waitingFor).toBe("azure");
    });

    it("uses a new challenge every time", async () => {
      await beginUpshotSignIn("google");
      await beginUpshotSignIn("google");
      const first = new URL(mocks.openUrl.mock.calls[0][0]);
      const second = new URL(mocks.openUrl.mock.calls[1][0]);
      expect(first.searchParams.get("code_challenge")).not.toBe(
        second.searchParams.get("code_challenge"),
      );
    });

    it("says so and stops waiting when the browser can't open", async () => {
      mocks.openUrl.mockResolvedValueOnce({ status: "error", error: "no" });
      await beginUpshotSignIn("google");
      expect(useUpshotSignIn.getState()).toEqual({
        waitingFor: null,
        error: "Could not open your browser.",
      });
      expect(isUpshotOAuthPending()).toBe(false);
    });

    it("says sign-in didn't finish when the callback server won't start", async () => {
      mocks.startCallbackServer.mockResolvedValueOnce({
        status: "error",
        error: "port busy",
      });
      await beginUpshotSignIn("google");
      expect(useUpshotSignIn.getState()).toEqual({
        waitingFor: null,
        error: "Sign-in didn't finish. Try again.",
      });
      expect(mocks.openUrl).not.toHaveBeenCalled();
    });
  });

  describe("finishUpshotSignIn", () => {
    it("posts the code and verifier to the exchange and saves the session", async () => {
      await beginUpshotSignIn("google");
      const challenge = startedUrl().searchParams.get("code_challenge")!;
      exchangeAnswer();

      await finishUpshotSignIn("the-code");

      expect(mocks.fetch).toHaveBeenCalledOnce();
      const [url, init] = mocks.fetch.mock.calls[0];
      expect(url).toBe(
        "https://upshot-ai.example.workers.dev/auth/oauth/exchange",
      );
      expect(init.method).toBe("POST");
      const body = JSON.parse(init.body);
      expect(body.code).toBe("the-code");
      // The verifier hashes to the challenge sent to the browser (PKCE S256).
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

      expect(JSON.parse(mocks.saved!)).toEqual({
        access_token: "access-1",
        refresh_token: "refresh-1",
        expires_at: expect.any(Number),
        email: "judge@example.com",
        // Remembered for Connect calendar.
        provider: "google",
      });
      expect(useUpshotAccount.getState().session?.email).toBe(
        "judge@example.com",
      );
      expect(useUpshotSignIn.getState()).toEqual({
        waitingFor: null,
        error: null,
      });
    });

    it("a second call with the same code does nothing", async () => {
      await beginUpshotSignIn("google");
      exchangeAnswer();
      await finishUpshotSignIn("the-code");
      await finishUpshotSignIn("the-code");
      expect(mocks.fetch).toHaveBeenCalledOnce();
    });

    it("two calls at once exchange the code only once", async () => {
      await beginUpshotSignIn("google");
      exchangeAnswer();
      await Promise.all([
        finishUpshotSignIn("the-code"),
        finishUpshotSignIn("the-code"),
      ]);
      expect(mocks.fetch).toHaveBeenCalledOnce();
    });

    it("does nothing when no sign-in is waiting", async () => {
      await finishUpshotSignIn("stray-code");
      expect(mocks.fetch).not.toHaveBeenCalled();
      expect(useUpshotAccount.getState().session).toBeNull();
      expect(useUpshotSignIn.getState().error).toBeNull();
    });

    it("no code says sign-in didn't finish", async () => {
      await beginUpshotSignIn("google");
      await finishUpshotSignIn(null);
      expect(useUpshotSignIn.getState()).toEqual({
        waitingFor: null,
        error: "Sign-in didn't finish. Try again.",
      });
      expect(isUpshotOAuthPending()).toBe(false);
      expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it("an empty code counts as no code", async () => {
      await beginUpshotSignIn("azure");
      await finishUpshotSignIn("");
      expect(useUpshotSignIn.getState().error).toBe(
        "Sign-in didn't finish. Try again.",
      );
    });

    it("shows the Worker's message when the exchange fails", async () => {
      await beginUpshotSignIn("google");
      mocks.fetch.mockResolvedValue(
        Response.json(
          { error: { message: "That sign-in expired. Try again." } },
          { status: 400 },
        ),
      );
      await finishUpshotSignIn("old-code");
      expect(useUpshotSignIn.getState()).toEqual({
        waitingFor: null,
        error: "That sign-in expired. Try again.",
      });
      expect(useUpshotAccount.getState().session).toBeNull();
    });
  });

  describe("stopWaitingForSignIn", () => {
    it("clears waiting, forgets the pending sign-in and stops the server", async () => {
      await beginUpshotSignIn("google");
      stopWaitingForSignIn();
      expect(useUpshotSignIn.getState()).toEqual({
        waitingFor: null,
        error: null,
      });
      expect(isUpshotOAuthPending()).toBe(false);
      expect(mocks.stopCallbackServer).toHaveBeenCalled();

      // A late code from the browser is ignored.
      await finishUpshotSignIn("late-code");
      expect(mocks.fetch).not.toHaveBeenCalled();
    });
  });

  describe("UpshotSignInChoices", () => {
    it("offers Continue with Google and Continue with Microsoft", () => {
      render(<UpshotSignInChoices />);
      expect(
        screen.getByRole("button", { name: "Continue with Google" }),
      ).not.toBeNull();
      expect(
        screen.getByRole("button", { name: "Continue with Microsoft" }),
      ).not.toBeNull();
      expect(screen.queryByLabelText("Email")).toBeNull();
      expect(screen.queryByLabelText("Password")).toBeNull();
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("Continue with Google opens the browser and shows the waiting line", async () => {
      render(<UpshotSignInChoices />);
      fireEvent.click(
        screen.getByRole("button", { name: "Continue with Google" }),
      );
      await waitFor(() =>
        expect(
          screen.getByText("Finish signing in with Google in your browser."),
        ).not.toBeNull(),
      );
      await waitFor(() => expect(mocks.openUrl).toHaveBeenCalled());
      expect(startedUrl().searchParams.get("provider")).toBe("google");
      expect(screen.getByRole("button", { name: "Cancel" })).not.toBeNull();
      expect(
        screen.queryByRole("button", { name: "Continue with Microsoft" }),
      ).toBeNull();
    });

    it("Continue with Microsoft shows the Microsoft waiting line", async () => {
      render(<UpshotSignInChoices />);
      fireEvent.click(
        screen.getByRole("button", { name: "Continue with Microsoft" }),
      );
      await waitFor(() =>
        expect(
          screen.getByText("Finish signing in with Microsoft in your browser."),
        ).not.toBeNull(),
      );
      await waitFor(() => expect(mocks.openUrl).toHaveBeenCalled());
      expect(startedUrl().searchParams.get("provider")).toBe("azure");
    });

    it("Cancel clears the waiting line and brings the buttons back", async () => {
      render(<UpshotSignInChoices />);
      fireEvent.click(
        screen.getByRole("button", { name: "Continue with Google" }),
      );
      await waitFor(() => expect(mocks.openUrl).toHaveBeenCalled());
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(useUpshotSignIn.getState().waitingFor).toBeNull();
      expect(
        screen.queryByText("Finish signing in with Google in your browser."),
      ).toBeNull();
      expect(
        screen.getByRole("button", { name: "Continue with Google" }),
      ).not.toBeNull();
    });

    it("shows the error line under the buttons", async () => {
      render(<UpshotSignInChoices />);
      fireEvent.click(
        screen.getByRole("button", { name: "Continue with Google" }),
      );
      await waitFor(() => expect(mocks.openUrl).toHaveBeenCalled());
      await act(() => finishUpshotSignIn(null));

      expect(screen.getByRole("alert").textContent).toBe(
        "Sign-in didn't finish. Try again.",
      );
      expect(
        screen.getByRole("button", { name: "Continue with Google" }),
      ).not.toBeNull();
    });

    it("trying again clears the old error", async () => {
      useUpshotSignIn.setState({ error: "Sign-in didn't finish. Try again." });
      render(<UpshotSignInChoices />);
      fireEvent.click(
        screen.getByRole("button", { name: "Continue with Microsoft" }),
      );
      await waitFor(() => expect(mocks.openUrl).toHaveBeenCalled());
      expect(useUpshotSignIn.getState().error).toBeNull();
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });
});
