import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { UpshotPlanStatus } from "~/upshot-plan";

const mocks = vi.hoisted(() => ({
  state: {
    plan: null as UpshotPlanStatus | null,
    email: null as string | null,
    isSignedIn: false,
    isLoading: false,
    checkoutPending: false,
    error: null as string | null,
  },
  openUpgrade: vi.fn(async () => {}),
  openManageSubscription: vi.fn(async () => {}),
  openUpshotSignIn: vi.fn(),
  signOutUpshot: vi.fn(async () => {}),
}));

vi.mock("~/upshot-plan", () => ({
  useUpshotPlan: () => mocks.state,
  openUpgrade: mocks.openUpgrade,
  openManageSubscription: mocks.openManageSubscription,
  openUpshotSignIn: mocks.openUpshotSignIn,
  signOutUpshot: mocks.signOutUpshot,
  refreshUpshotPlan: vi.fn(),
}));
vi.mock("~/upshot-plan/upgrade-dialog", () => ({
  TestCardNote: () => (
    <p>
      Test mode: use card 4242 4242 4242 4242, any future date, any CVC. No real
      money is charged.
    </p>
  ),
}));

import { DEFAULT_BILLING_INTERVAL, SettingsPlan } from "./plan";

describe("Settings › Plan", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.state = {
      plan: null,
      email: null,
      isSignedIn: false,
      isLoading: false,
      checkoutPending: false,
      error: null,
    };
  });

  it("free: yearly first, big price over the total, test card, Upgrade", () => {
    render(<SettingsPlan />);

    expect(screen.getByRole("heading", { name: "Plan" })).not.toBeNull();
    expect(
      screen
        .getByRole("button", { name: "Yearly save 21%" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByText("$11")).not.toBeNull();
    expect(screen.getByText("a month, billed $132 yearly")).not.toBeNull();
    expect(screen.getByText("or $14 billed monthly")).not.toBeNull();
    expect(screen.getByText(/4242 4242 4242 4242/)).not.toBeNull();
    expect(
      screen.getByText("You're on Free. No account needed."),
    ).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Upgrade to Pro" }));
    expect(mocks.openUpgrade).toHaveBeenLastCalledWith("year");
    expect(screen.queryByRole("button", { name: "Manage subscription" })).toBe(
      null,
    );
  });

  it("checkout follows the toggle: Monthly sends month", () => {
    render(<SettingsPlan />);
    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    expect(screen.getByText("$14")).not.toBeNull();
    expect(screen.getByText("a month")).not.toBeNull();
    expect(screen.queryByText("or $14 billed monthly")).toBe(null);

    fireEvent.click(screen.getByRole("button", { name: "Upgrade to Pro" }));
    expect(mocks.openUpgrade).toHaveBeenLastCalledWith("month");
  });

  it("DEFAULT_BILLING_INTERVAL is the toggle's first value", () => {
    expect(DEFAULT_BILLING_INTERVAL).toBe("year");
  });

  it("pro: shows the status, renewal date, manage and sign out", () => {
    mocks.state = {
      ...mocks.state,
      isSignedIn: true,
      email: "judge@example.com",
      plan: {
        pro: true,
        status: "active",
        current_period_end: "2026-11-03T12:00:00.000Z",
        interval: "year",
      },
    };
    render(<SettingsPlan />);

    expect(screen.getByText("Signed in as judge@example.com")).not.toBeNull();
    expect(screen.getByText(/Active, renews Nov 3, 2026/)).not.toBeNull();
    expect(screen.getByText("a month, billed $132 yearly")).not.toBeNull();
    expect(screen.queryByText("or $14 billed monthly")).toBe(null);
    expect(screen.queryByRole("button", { name: "Upgrade to Pro" })).toBe(null);

    fireEvent.click(
      screen.getByRole("button", { name: "Manage subscription" }),
    );
    expect(mocks.openManageSubscription).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(mocks.signOutUpshot).toHaveBeenCalledOnce();
  });

  it("canceled at period end says when Pro ends", () => {
    mocks.state = {
      ...mocks.state,
      isSignedIn: true,
      email: "judge@example.com",
      plan: {
        pro: true,
        status: "active",
        current_period_end: "2026-11-03T12:00:00.000Z",
        interval: "month",
        cancel_at_period_end: true,
      },
    };
    render(<SettingsPlan />);
    expect(screen.getByText(/Active, ends Nov 3, 2026/)).not.toBeNull();
  });

  it("signed out offers Sign in", () => {
    render(<SettingsPlan />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(mocks.openUpshotSignIn).toHaveBeenCalledOnce();
  });
});
