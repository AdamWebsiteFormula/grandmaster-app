import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
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
  activity: null as unknown[] | null,
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

vi.mock("~/settings/stats/queries", () => ({
  useActivity: () => ({
    data: mocks.activity ?? [
      {
        session_id: "a",
        started_at_ms: Date.parse("2026-10-01T15:00:00Z"),
        created_at: "2026-10-01T15:00:00Z",
        duration_ms: 90 * 60_000,
      },
      {
        session_id: "b",
        started_at_ms: Date.parse("2026-06-01T15:00:00Z"),
        created_at: "2026-06-01T15:00:00Z",
        duration_ms: 30 * 60_000,
      },
    ],
    isLoading: false,
    error: null,
  }),
}));
vi.mock("~/calendar/hooks", () => ({
  useNow: () => new Date("2026-10-03T12:00:00Z"),
  useTimezone: () => "UTC",
  useWeekStartsOn: () => 0,
}));

import { DEFAULT_BILLING_INTERVAL, SettingsPlan } from "./plan";

describe("Settings › Plan", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.activity = null;
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

  it("pro: shows the status, renewal date and manage", () => {
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

    expect(screen.getByText(/Active, renews Nov 3, 2026/)).not.toBeNull();
    expect(screen.getByText("a month, billed $132 yearly")).not.toBeNull();
    expect(screen.queryByText("or $14 billed monthly")).toBe(null);
    expect(screen.queryByRole("button", { name: "Upgrade to Pro" })).toBe(null);

    fireEvent.click(
      screen.getByRole("button", { name: "Manage subscription" }),
    );
    expect(mocks.openManageSubscription).toHaveBeenCalledOnce();
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
    expect(
      screen.getByText(/Canceled. Pro stays on until Nov 3, 2026./),
    ).not.toBeNull();
  });

  // Fork: Sign in and Sign out moved to Settings › Profile (redline-oct3).
  it("leaves Sign in and Sign out to Profile", () => {
    mocks.state = { ...mocks.state, isSignedIn: true, email: "a@b.co" };
    render(<SettingsPlan />);
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
  });

  it("says None yet instead of zeros for a new user", () => {
    mocks.activity = [];
    render(<SettingsPlan />);
    const usage = screen.getByTestId("plan-usage");
    expect(usage.textContent).toContain("None yet");
    expect(within(usage).queryByText("0")).toBeNull();
  });

  it("shows a short meeting as under 0.1 hours, not 0", () => {
    mocks.activity = [
      {
        session_id: "a",
        started_at_ms: Date.parse("2026-10-01T15:00:00Z"),
        created_at: "2026-10-01T15:00:00Z",
        duration_ms: 2 * 60_000,
      },
    ];
    render(<SettingsPlan />);
    expect(
      within(screen.getByTestId("plan-usage")).getByText("<0.1"),
    ).not.toBeNull();
  });

  it("puts the compare table in a card and the plan names on one baseline", () => {
    render(<SettingsPlan />);
    const table = screen.getByTestId("plan-comparison");
    expect(table.parentElement?.hasAttribute("data-settings-card")).toBe(true);
    for (const header of within(table).getAllByRole("columnheader").slice(1)) {
      expect(header.className).toContain("align-top");
    }
  });

  it("shows usage from local activity: last 30 days and total", () => {
    render(<SettingsPlan />);
    const usage = screen.getByTestId("plan-usage");
    expect(within(usage).getByText("Meetings, last 30 days")).not.toBeNull();
    expect(within(usage).getByText("Hours, last 30 days")).not.toBeNull();
    expect(within(usage).getByText("1.5")).not.toBeNull();
    expect(within(usage).getByText("Meetings in total")).not.toBeNull();
    expect(within(usage).getByText("2")).not.toBeNull();
  });

  it("compares Free and Pro in a table with the current column marked", () => {
    render(<SettingsPlan />);
    const table = screen.getByTestId("plan-comparison");
    expect(
      within(table).getByRole("columnheader", { name: /Free.*Current plan/ }),
    ).not.toBeNull();
    expect(
      within(table).getByRole("columnheader", { name: /Pro.*Upgrade to Pro/ }),
    ).not.toBeNull();

    const autoRow = within(table).getByRole("row", {
      name: /AI notes and chat with Auto/,
    });
    expect(
      within(autoRow).getAllByRole("img", { name: "Included" }),
    ).toHaveLength(2);

    const modelsRow = within(table).getByRole("row", {
      name: /Pick this week's models/,
    });
    expect(
      within(modelsRow).getByRole("img", { name: "Not included" }),
    ).not.toBeNull();
    expect(
      within(modelsRow).getByRole("img", { name: "Included" }),
    ).not.toBeNull();

    const priceRow = within(table).getByRole("row", { name: /^Price/ });
    expect(within(priceRow).getByText("$0")).not.toBeNull();
    expect(within(priceRow).getByText("$11")).not.toBeNull();
    expect(
      within(priceRow).getByText("a month, billed $132 yearly"),
    ).not.toBeNull();
    expect(within(priceRow).getByText("or $14 billed monthly")).not.toBeNull();
  });

  it("pro: the Pro column is current and the toggle is gone", () => {
    mocks.state = {
      ...mocks.state,
      isSignedIn: true,
      email: "judge@example.com",
      plan: {
        pro: true,
        status: "active",
        current_period_end: "2026-11-03T12:00:00.000Z",
        interval: "month",
      },
    };
    render(<SettingsPlan />);
    const table = screen.getByTestId("plan-comparison");
    expect(
      within(table).getByRole("columnheader", { name: /Pro.*Current plan/ }),
    ).not.toBeNull();
    expect(screen.queryByRole("group", { name: "Billing period" })).toBe(null);
  });
});
