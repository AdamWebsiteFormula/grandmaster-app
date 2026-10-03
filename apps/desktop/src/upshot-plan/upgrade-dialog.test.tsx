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
  openUrl: vi.fn(async () => ({ status: "ok", data: null })),
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
vi.mock("@anlg/plugin-store2", () => ({
  commands: {
    getSecret: vi.fn(async () => ({ status: "ok", data: null })),
    setSecret: vi.fn(async () => ({ status: "ok", data: null })),
    deleteSecret: vi.fn(async () => ({ status: "ok", data: null })),
  },
}));

import { openUpgrade, openUpshotSignIn, useUpgradeDialog } from "./index";
import { resetUpshotAccountForTests } from "./session";
import { UpshotUpgradeDialog } from "./upgrade-dialog";

describe("UpshotUpgradeDialog", () => {
  afterEach(() => {
    cleanup();
    mocks.fetch.mockReset();
    mocks.openUrl.mockClear();
    resetUpshotAccountForTests();
    useUpgradeDialog.setState({ open: false, error: null, alreadyPro: false });
    mocks.pro = false;
  });

  it("signs up, then opens checkout in the browser", async () => {
    mocks.fetch.mockImplementation(async (url: string) =>
      new URL(url).pathname === "/auth/signup"
        ? Response.json({
            access_token: "a",
            refresh_token: "r",
            expires_at: Date.now() / 1000 + 3600,
            user: { id: "u", email: "judge@example.com" },
          })
        : Response.json({ url: "https://checkout.stripe.com/c/pay/cs_test" }),
    );
    render(<UpshotUpgradeDialog />);
    await act(() => openUpgrade("month"));

    expect(screen.getByText("Create your Upshot account")).not.toBeNull();
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "judge@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Create account and continue" }),
    );

    await waitFor(() =>
      expect(
        screen.getByText("Finish checkout in your browser"),
      ).not.toBeNull(),
    );
    expect(mocks.openUrl).toHaveBeenCalledWith(
      "https://checkout.stripe.com/c/pay/cs_test",
      null,
    );
    expect(screen.getByText(/4242 4242 4242 4242/)).not.toBeNull();
  });

  it("shows a sign-in error and stays on the form", async () => {
    mocks.fetch.mockResolvedValue(
      Response.json(
        { error: { message: "Invalid login credentials" } },
        { status: 400 },
      ),
    );
    render(<UpshotUpgradeDialog />);
    await act(() => openUpgrade());

    fireEvent.click(
      screen.getByRole("button", { name: "Already have an account? Sign in" }),
    );
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "judge@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Sign in and continue" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "Invalid login credentials",
      ),
    );
    expect(mocks.openUrl).not.toHaveBeenCalled();
  });

  it("labels the fields, shows the password rule, can show the password and cancel", async () => {
    render(<UpshotUpgradeDialog />);
    await act(() => openUpgrade("year"));

    const password = screen.getByLabelText("Password") as HTMLInputElement;
    expect(screen.getByText("Email").tagName).toBe("LABEL");
    expect(password.placeholder).toBe("");
    expect(password.type).toBe("password");
    const hint = screen.getByText("8 or more characters");
    expect(password.getAttribute("aria-describedby")).toBe(hint.id);

    fireEvent.click(screen.getByRole("checkbox", { name: "Show password" }));
    expect(password.type).toBe("text");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(useUpgradeDialog.getState().open).toBe(false);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("says Pro is on once payment goes through", async () => {
    mocks.fetch.mockImplementation(async (url: string) =>
      new URL(url).pathname === "/auth/signup"
        ? Response.json({
            access_token: "a",
            refresh_token: "r",
            expires_at: Date.now() / 1000 + 3600,
            user: { id: "u", email: "judge@example.com" },
          })
        : Response.json({ url: "https://checkout.stripe.com/c/pay/cs_test" }),
    );
    const { rerender } = render(<UpshotUpgradeDialog />);
    await act(() => openUpgrade("year"));
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "judge@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Create account and continue" }),
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
    mocks.fetch.mockImplementation(async (url: string) => {
      const path = new URL(url).pathname;
      if (path === "/auth/login") {
        return Response.json({
          access_token: "a",
          refresh_token: "r",
          expires_at: Date.now() / 1000 + 3600,
          user: { id: "u", email: "judge@example.com" },
        });
      }
      if (path === "/billing/checkout") {
        return Response.json(
          {
            error: {
              message: "You already have Upshot Pro.",
              code: "already_pro",
            },
          },
          { status: 409 },
        );
      }
      return Response.json({
        pro: true,
        status: "active",
        current_period_end: null,
        interval: "year",
      });
    });
    render(<UpshotUpgradeDialog />);
    await act(() => openUpgrade("year"));
    fireEvent.click(
      screen.getByRole("button", { name: "Already have an account? Sign in" }),
    );
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "judge@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Sign in and continue" }),
    );
    await waitFor(() =>
      expect(screen.getByText("You're on Upshot Pro")).not.toBeNull(),
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(mocks.openUrl).not.toHaveBeenCalled();
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

  // journey-account-settings P3: Esc mid sign-in can't strand a checkout.
  it("Esc while signing in keeps the dialog open", async () => {
    let answer!: (response: Response) => void;
    mocks.fetch.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );
    render(<UpshotUpgradeDialog />);
    await act(() => openUpgrade("month"));
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "judge@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Create account and continue" }),
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
  });

  // Fork: "Sign in" opens the sign-in form, and an existing email switches
  // sign-up to sign-in (ux-audit-oct3 D).
  it("opens on sign-in for Sign in, and switches there for an existing email", async () => {
    render(<UpshotUpgradeDialog />);
    act(() => openUpshotSignIn());
    expect(screen.getByText("Sign in to Upshot")).not.toBeNull();
    act(() => useUpgradeDialog.setState({ open: false }));

    mocks.fetch.mockResolvedValue(
      Response.json(
        {
          error: {
            message:
              "An account with this email already exists. Sign in instead.",
            code: "account_exists",
          },
        },
        { status: 409 },
      ),
    );
    await act(() => openUpgrade("month"));
    expect(screen.getByText("Create your Upshot account")).not.toBeNull();
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "judge@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Create account and continue" }),
    );

    await waitFor(() =>
      expect(screen.getByText("Sign in to Upshot")).not.toBeNull(),
    );
    expect(screen.getByRole("alert").textContent).toBe(
      "An account with this email already exists. Sign in instead.",
    );
  });

  it("sign-up links the privacy policy and opens it in the browser", async () => {
    render(<UpshotUpgradeDialog />);
    await act(() => openUpgrade("month"));

    expect(
      screen.getByText(/By creating an account you agree to the/),
    ).not.toBeNull();
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

    fireEvent.click(
      screen.getByRole("button", { name: "Already have an account? Sign in" }),
    );
    expect(screen.queryByRole("button", { name: "privacy policy" })).toBeNull();
  });
});
