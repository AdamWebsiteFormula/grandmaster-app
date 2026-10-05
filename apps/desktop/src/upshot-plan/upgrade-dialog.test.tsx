import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  openUrl: vi.fn(async (_url: string, _app: string | null) => ({
    status: "ok",
    data: null,
  })),
  startCallbackServer: vi.fn(async () => ({ status: "ok", data: 4321 })),
  stopCallbackServer: vi.fn(async () => ({ status: "ok", data: null })),
  pro: false,
}));

vi.mock("./index", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./index")>()),
  useUpshotPro: () => mocks.pro,
}));

vi.mock("~/env", () => ({
  env: { VITE_AI_API_URL: "https://upshot-ai.example.workers.dev" },
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
    getSecret: vi.fn(async () => ({ status: "ok", data: null })),
    setSecret: vi.fn(async () => ({ status: "ok", data: null })),
    deleteSecret: vi.fn(async () => ({ status: "ok", data: null })),
  },
}));

import { openUpgrade, openUpshotSignIn, useUpgradeDialog } from "./index";
import {
  cancelUpshotOAuth,
  resetUpshotAccountForTests,
  useUpshotAccount,
} from "./session";
import { finishUpshotSignIn, useUpshotSignIn } from "./sign-in";
import { UpshotUpgradeDialog } from "./upgrade-dialog";

const SESSION = {
  access_token: "a",
  refresh_token: "r",
  expires_at: Date.now() / 1000 + 3600,
  email: "judge@example.com",
};

/** The Worker's answers: the code exchange, checkout and plan status. */
function workerAnswers(
  overrides: Partial<Record<string, () => Response>> = {},
) {
  mocks.fetch.mockImplementation(async (url: string) => {
    const path = new URL(url).pathname;
    const override = overrides[path];
    if (override) return override();
    if (path === "/auth/oauth/exchange") {
      return Response.json({
        access_token: "a",
        refresh_token: "r",
        expires_at: Date.now() / 1000 + 3600,
        user: { id: "u", email: "judge@example.com" },
      });
    }
    return Response.json({ url: "https://checkout.stripe.com/c/pay/cs_test" });
  });
}

/** Click a provider button, then hand back the code the browser would. */
async function signInWith(button: string) {
  fireEvent.click(screen.getByRole("button", { name: button }));
  await waitFor(() =>
    expect(useUpshotSignIn.getState().waitingFor).not.toBe(null),
  );
  await waitFor(() => expect(mocks.openUrl).toHaveBeenCalled());
  await act(() => finishUpshotSignIn("the-code"));
}

describe("UpshotUpgradeDialog", () => {
  afterEach(() => {
    cleanup();
    mocks.fetch.mockReset();
    mocks.openUrl.mockClear();
    mocks.startCallbackServer.mockClear();
    mocks.stopCallbackServer.mockClear();
    cancelUpshotOAuth();
    useUpshotSignIn.setState({ waitingFor: null, error: null });
    resetUpshotAccountForTests();
    useUpgradeDialog.setState({
      open: false,
      error: null,
      alreadyPro: false,
      reason: "account",
    });
    mocks.pro = false;
  });

  it("signed out, Upgrade asks for Google or Microsoft, with no email or password form", async () => {
    render(<UpshotUpgradeDialog />);
    await act(() => openUpgrade("month"));

    expect(screen.getByText("Sign in to Upshot")).not.toBeNull();
    expect(
      screen.getByText("Pro needs an account so your plan follows you."),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Continue with Microsoft" }),
    ).not.toBeNull();
    expect(screen.queryByLabelText("Email")).toBeNull();
    expect(screen.queryByLabelText("Password")).toBeNull();
    expect(screen.queryByText("Continue to checkout")).toBeNull();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("signs in with Google, then opens checkout in the browser", async () => {
    workerAnswers();
    render(<UpshotUpgradeDialog />);
    await act(() => openUpgrade("month"));

    await signInWith("Continue with Google");
    const start = new URL(mocks.openUrl.mock.calls[0][0]);
    expect(start.pathname).toBe("/auth/oauth/start");
    expect(start.searchParams.get("provider")).toBe("google");

    // Checkout dialogs stay open after sign-in and offer the next step.
    await waitFor(() =>
      expect(screen.getByText("Upgrade to Pro")).not.toBeNull(),
    );
    expect(screen.getByText("Checkout opens in your browser.")).not.toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Continue to checkout" }),
    );

    await waitFor(() =>
      expect(
        screen.getByText("Finish checkout in your browser"),
      ).not.toBeNull(),
    );
    expect(mocks.openUrl).toHaveBeenLastCalledWith(
      "https://checkout.stripe.com/c/pay/cs_test",
      null,
    );
    expect(screen.getByText(/4242 4242 4242 4242/)).not.toBeNull();
  });

  it("signs in with Microsoft by asking the Worker for azure", async () => {
    workerAnswers();
    render(<UpshotUpgradeDialog />);
    await act(() => openUpgrade("month"));

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Microsoft" }),
    );
    await waitFor(() => expect(mocks.openUrl).toHaveBeenCalled());
    expect(
      new URL(mocks.openUrl.mock.calls[0][0]).searchParams.get("provider"),
    ).toBe("azure");
    expect(
      screen.getByText("Finish signing in with Microsoft in your browser."),
    ).not.toBeNull();
  });

  it("says what it is waiting for and Cancel inside it stops the wait", async () => {
    render(<UpshotUpgradeDialog />);
    await act(() => openUpgrade("month"));

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );
    await waitFor(() =>
      expect(
        screen.getByText("Finish signing in with Google in your browser."),
      ).not.toBeNull(),
    );
    expect(screen.queryByRole("button", { name: "Continue with Google" })).toBe(
      null,
    );

    // The dialog has its own Cancel; the one in the waiting line is first.
    const [waitingCancel] = screen.getAllByRole("button", { name: "Cancel" });
    fireEvent.click(waitingCancel);
    expect(useUpshotSignIn.getState().waitingFor).toBeNull();
    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).not.toBeNull();
    expect(useUpgradeDialog.getState().open).toBe(true);
  });

  it("Cancel closes the dialog and stops waiting for the browser", async () => {
    render(<UpshotUpgradeDialog />);
    await act(() => openUpgrade("year"));
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );
    await waitFor(() =>
      expect(useUpshotSignIn.getState().waitingFor).toBe("google"),
    );

    const cancels = screen.getAllByRole("button", { name: "Cancel" });
    fireEvent.click(cancels[cancels.length - 1]);
    expect(useUpgradeDialog.getState().open).toBe(false);
    expect(useUpshotSignIn.getState().waitingFor).toBeNull();
    expect(mocks.stopCallbackServer).toHaveBeenCalled();
  });

  it("says Pro is on once payment goes through", async () => {
    workerAnswers();
    const { rerender } = render(<UpshotUpgradeDialog />);
    await act(() => openUpgrade("year"));
    await signInWith("Continue with Google");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Continue to checkout" }),
      ).not.toBeNull(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Continue to checkout" }),
    );
    await waitFor(() =>
      expect(
        screen.getByText("Finish checkout in your browser"),
      ).not.toBeNull(),
    );

    mocks.pro = true;
    rerender(<UpshotUpgradeDialog />);
    expect(screen.getByText("You're on Upshot Pro")).not.toBeNull();
    expect(screen.queryByText(/4242 4242 4242 4242/)).toBeNull();
  });

  // journey-account-settings P2: a second Mac signs in and is already Pro.
  it("already Pro after sign-in shows You're on Upshot Pro, not an error", async () => {
    workerAnswers({
      "/billing/checkout": () =>
        Response.json(
          {
            error: {
              message: "You already have Upshot Pro.",
              code: "already_pro",
            },
          },
          { status: 409 },
        ),
      "/billing/status": () =>
        Response.json({
          pro: true,
          status: "active",
          current_period_end: null,
          interval: "year",
        }),
    });
    render(<UpshotUpgradeDialog />);
    await act(() => openUpgrade("year"));
    await signInWith("Continue with Google");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Continue to checkout" }),
      ).not.toBeNull(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Continue to checkout" }),
    );
    await waitFor(() =>
      expect(screen.getByText("You're on Upshot Pro")).not.toBeNull(),
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(mocks.openUrl).toHaveBeenCalledTimes(1);
  });

  it("opens straight on You're on Upshot Pro when openUpgrade found Pro", () => {
    render(<UpshotUpgradeDialog />);
    act(() =>
      useUpgradeDialog.setState({
        open: true,
        mode: "signup",
        checkout: true,
        error: null,
        alreadyPro: true,
      }),
    );
    expect(screen.getByText("You're on Upshot Pro")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(useUpgradeDialog.getState().open).toBe(false);
  });

  // journey-account-settings P3: Esc mid checkout can't strand a checkout.
  it("Esc while the checkout call runs keeps the dialog open", async () => {
    let answer!: (response: Response) => void;
    mocks.fetch.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );
    useUpshotAccount.setState({ session: SESSION, loaded: true });
    render(<UpshotUpgradeDialog />);
    act(() =>
      useUpgradeDialog.setState({
        open: true,
        checkout: true,
        error: null,
        alreadyPro: false,
        reason: "account",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Continue to checkout" }),
    );
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalled());
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    expect(useUpgradeDialog.getState().open).toBe(true);
    expect(
      screen.getByRole("button", { name: "Cancel" }).hasAttribute("disabled"),
    ).toBe(true);
    await act(async () => {
      answer(Response.json({ error: { message: "Nope" } }, { status: 400 }));
    });
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("Nope"),
    );
  });

  it("a plain Sign in from a hosted feature says why an account is needed", async () => {
    render(<UpshotUpgradeDialog />);
    act(() => openUpshotSignIn("hosted"));
    expect(screen.getByText("Sign in to Upshot")).not.toBeNull();
    expect(
      screen.getByText(
        "Upshot AI and Upshot transcription need a free account. Your notes stay on this computer.",
      ),
    ).not.toBeNull();
    expect(
      screen.queryByText("Pro needs an account so your plan follows you."),
    ).toBeNull();
  });

  it("a plain Sign in with no reason offers the free account", () => {
    render(<UpshotUpgradeDialog />);
    act(() => openUpshotSignIn());
    expect(screen.getByText("Sign in to Upshot")).not.toBeNull();
    expect(
      screen.getByText(
        "A free account turns on Upshot AI and Upshot transcription. Your notes stay on this computer.",
      ),
    ).not.toBeNull();
  });

  it("a plain Sign in closes itself when the session appears", async () => {
    workerAnswers();
    render(<UpshotUpgradeDialog />);
    act(() => openUpshotSignIn("hosted"));
    expect(useUpgradeDialog.getState().open).toBe(true);

    await signInWith("Continue with Microsoft");
    await waitFor(() => expect(useUpgradeDialog.getState().open).toBe(false));
    expect(useUpshotAccount.getState().session?.email).toBe(
      "judge@example.com",
    );
    // Nothing went to checkout.
    expect(mocks.openUrl).toHaveBeenCalledTimes(1);
  });

  it("shows why sign-in did not finish and stays on the buttons", async () => {
    render(<UpshotUpgradeDialog />);
    act(() => openUpshotSignIn("hosted"));
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );
    await waitFor(() =>
      expect(useUpshotSignIn.getState().waitingFor).toBe("google"),
    );
    // The browser came back with no code: the person canceled there.
    await act(() => finishUpshotSignIn(null));

    expect(screen.getByRole("alert").textContent).toBe(
      "Sign-in didn't finish. Try again.",
    );
    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).not.toBeNull();
    expect(useUpgradeDialog.getState().open).toBe(true);
  });

  it("links the privacy policy and opens it in the browser", async () => {
    render(<UpshotUpgradeDialog />);
    await act(() => openUpgrade("month"));

    expect(screen.getByText(/By continuing you agree to the/)).not.toBeNull();
    const link = screen.getByRole("button", { name: "privacy policy" });
    // Fork: muted, underlined, 4.5:1 or more (redline5-oct3).
    expect(link.className).toContain("text-muted-foreground");
    expect(link.className).toContain("underline");
    fireEvent.click(link);
    await waitFor(() =>
      expect(mocks.openUrl).toHaveBeenCalledWith(
        "https://upshot-ai.example.workers.dev/privacy",
        null,
      ),
    );
  });

  it("signed in, the dialog shows no sign-in buttons or privacy line", () => {
    useUpshotAccount.setState({ session: SESSION, loaded: true });
    render(<UpshotUpgradeDialog />);
    act(() =>
      useUpgradeDialog.setState({
        open: true,
        checkout: true,
        error: null,
        alreadyPro: false,
      }),
    );
    expect(screen.getByText("Upgrade to Pro")).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: "Continue with Google" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "privacy policy" })).toBeNull();
  });
});
