import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
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
    errorStatus: null as number | null,
    sessionEnded: false,
  },
  openUpgrade: vi.fn(async () => {}),
  refreshUpshotPlan: vi.fn(async () => {}),
  stopWaitingForCheckout: vi.fn(),
  openManageSubscription: vi.fn(async () => {}),
  openUpshotSignIn: vi.fn(),
  openPrivacyPolicy: vi.fn(),
  signOutUpshot: vi.fn(async () => {}),
  activity: null as unknown[] | null,
}));

vi.mock("~/upshot-plan", () => ({
  useUpshotPlan: () => mocks.state,
  openUpgrade: mocks.openUpgrade,
  openManageSubscription: mocks.openManageSubscription,
  openUpshotSignIn: mocks.openUpshotSignIn,
  signOutUpshot: mocks.signOutUpshot,
  refreshUpshotPlan: mocks.refreshUpshotPlan,
  stopWaitingForCheckout: mocks.stopWaitingForCheckout,
}));
vi.mock("~/upshot-plan/upgrade-dialog", () => ({
  PrivacyPolicyLink: ({ children }: { children: ReactNode }) => (
    <button type="button" onClick={mocks.openPrivacyPolicy}>
      {children}
    </button>
  ),
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
      errorStatus: null,
      sessionEnded: false,
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

  it("shows time under an hour as minutes, not 0.1 hours", () => {
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
      within(screen.getByTestId("plan-usage")).getByText("2 min"),
    ).not.toBeNull();
  });

  it("rounds a recording under 30 seconds up to 1 min, as Home rows do", () => {
    mocks.activity = [
      {
        session_id: "a",
        started_at_ms: Date.parse("2026-10-01T15:00:00Z"),
        created_at: "2026-10-01T15:00:00Z",
        duration_ms: 20_000,
      },
    ];
    render(<SettingsPlan />);
    const usage = screen.getByTestId("plan-usage");
    expect(within(usage).getByText("1 min")).not.toBeNull();
    expect(within(usage).queryByText("<1 min")).toBeNull();
  });

  it("ends the current column tint inside the card padding", () => {
    render(<SettingsPlan />);
    const card = screen
      .getByTestId("plan-comparison")
      .closest("[data-settings-card]")!;
    expect(card.className).toContain("py-3");
    expect(card.className).not.toContain("pb-1");
  });

  it("puts the compare table in a card and the plan names on one baseline", () => {
    render(<SettingsPlan />);
    const table = screen.getByTestId("plan-comparison");
    expect(table.closest("[data-settings-card]")).not.toBeNull();
    for (const header of within(table).getAllByRole("columnheader").slice(1)) {
      expect(header.className).toContain("align-top");
    }
  });

  it("shows usage from local activity: last 30 days and total", () => {
    render(<SettingsPlan />);
    const usage = screen.getByTestId("plan-usage");
    expect(within(usage).getByText("Meetings, last 30 days")).not.toBeNull();
    expect(
      within(usage).getByText("Time recorded, last 30 days"),
    ).not.toBeNull();
    expect(within(usage).getByText("1.5 hr")).not.toBeNull();
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
      name: /AI notes and chat \(best model picked for you\)/,
    });
    expect(
      within(autoRow).getAllByRole("img", { name: "Included" }),
    ).toHaveLength(2);

    const modelsRow = within(table).getByRole("row", {
      name: /Pick this week's models/,
    });
    // Free gets Auto, so the cell says so instead of a dash.
    expect(within(modelsRow).getByText("Auto only")).not.toBeNull();
    expect(
      within(modelsRow).queryByRole("img", { name: "Not included" }),
    ).toBeNull();
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

  // ---- journey-account-settings (Oct 3) ----

  const signedInPro = (extra: Partial<UpshotPlanStatus> = {}) => {
    mocks.state = {
      ...mocks.state,
      isSignedIn: true,
      email: "judge@example.com",
      plan: {
        pro: true,
        status: "active",
        current_period_end: "2026-11-03T12:00:00.000Z",
        interval: "year",
        ...extra,
      },
    };
  };
  const currentPlanCard = () =>
    screen.getByRole("region", { name: "Current plan" });

  it("P2 loading: says Checking your plan…, never Free, and holds Upgrade", () => {
    mocks.state = {
      ...mocks.state,
      isSignedIn: true,
      email: "judge@example.com",
      isLoading: true,
    };
    render(<SettingsPlan />);
    const card = currentPlanCard();
    expect(within(card).getByRole("status").textContent).toBe(
      "Checking your plan…",
    );
    expect(within(card).queryByText("Free")).toBeNull();
    expect(within(card).queryByText(/for \$0/)).toBeNull();
    const upgrade = screen.getByRole("button", { name: "Upgrade to Pro" });
    expect(upgrade.hasAttribute("disabled")).toBe(true);
    const table = screen.getByTestId("plan-comparison");
    expect(within(table).queryByText("Current plan")).toBeNull();
  });

  it("P2 offline with no plan: says so, retries, and holds Upgrade", () => {
    mocks.state = {
      ...mocks.state,
      isSignedIn: true,
      email: "judge@example.com",
      error: "Could not reach Upshot. Check your connection.",
      errorStatus: 0,
    };
    render(<SettingsPlan />);
    const card = currentPlanCard();
    expect(within(card).getByRole("alert").textContent).toBe(
      "Couldn't check your plan. Check your connection.",
    );
    expect(within(card).queryByText("Free")).toBeNull();
    fireEvent.click(within(card).getByRole("button", { name: "Try again" }));
    expect(mocks.refreshUpshotPlan).toHaveBeenCalledWith(true);
    expect(
      screen
        .getByRole("button", { name: "Upgrade to Pro" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("P2 Worker down with no plan: asks to try again in a minute", () => {
    mocks.state = {
      ...mocks.state,
      isSignedIn: true,
      email: "judge@example.com",
      error: "Billing is not available right now.",
      errorStatus: 503,
    };
    render(<SettingsPlan />);
    expect(within(currentPlanCard()).getByRole("alert").textContent).toBe(
      "Couldn't check your plan. Try again in a minute.",
    );
  });

  it("P2 a cached Pro plan shows Pro even when the refresh failed", () => {
    signedInPro();
    mocks.state.error = "Could not reach Upshot. Check your connection.";
    mocks.state.errorStatus = 0;
    render(<SettingsPlan />);
    expect(within(currentPlanCard()).getByText("Pro")).not.toBeNull();
    expect(within(currentPlanCard()).queryByRole("alert")).toBeNull();
  });

  it("P2 signed out: offers Sign in to restore Pro", () => {
    render(<SettingsPlan />);
    fireEvent.click(
      within(currentPlanCard()).getByRole("button", {
        name: "Already have Pro? Sign in",
      }),
    );
    expect(mocks.openUpshotSignIn).toHaveBeenCalledOnce();
    expect(
      screen
        .getByRole("button", { name: "Upgrade to Pro" })
        .hasAttribute("disabled"),
    ).toBe(false);
  });

  it("P2 session ended: says so and offers Sign in", () => {
    mocks.state.sessionEnded = true;
    render(<SettingsPlan />);
    const card = currentPlanCard();
    expect(
      within(card).getByText("Your session ended. Sign in again."),
    ).not.toBeNull();
    fireEvent.click(within(card).getByRole("button", { name: "Sign in" }));
    expect(mocks.openUpshotSignIn).toHaveBeenCalledOnce();
  });

  it.each(["past_due", "unpaid", "incomplete"])(
    "P2 %s: says payment failed and offers Update payment",
    (status) => {
      mocks.state = {
        ...mocks.state,
        isSignedIn: true,
        email: "judge@example.com",
        plan: {
          pro: false,
          status,
          current_period_end: null,
          interval: null,
        },
      };
      render(<SettingsPlan />);
      const card = currentPlanCard();
      expect(
        within(card).getByText(
          "Payment didn't go through. Update your card to keep Pro.",
        ),
      ).not.toBeNull();
      expect(within(card).queryByText(/for \$0/)).toBeNull();
      fireEvent.click(
        within(card).getByRole("button", { name: "Update payment" }),
      );
      expect(mocks.openManageSubscription).toHaveBeenCalledOnce();
    },
  );

  it("P2 a Manage error shows inside the Current plan card", async () => {
    signedInPro();
    mocks.openManageSubscription.mockRejectedValueOnce(
      new Error("Could not open subscription settings. Try again."),
    );
    render(<SettingsPlan />);
    fireEvent.click(
      screen.getByRole("button", { name: "Manage subscription" }),
    );
    const alert = await within(currentPlanCard()).findByRole("alert");
    expect(alert.textContent).toBe(
      "Could not open subscription settings. Try again.",
    );
  });

  it("P2 an Upgrade error shows right under the plan header row", async () => {
    mocks.openUpgrade.mockRejectedValueOnce(new Error("Could not start."));
    render(<SettingsPlan />);
    fireEvent.click(screen.getByRole("button", { name: "Upgrade to Pro" }));
    const table = screen.getByTestId("plan-comparison");
    const alert = await within(table).findByRole("alert");
    expect(alert.textContent).toBe("Could not start.");
    expect(alert.closest("thead")).not.toBeNull();
    expect(within(currentPlanCard()).queryByRole("alert")).toBeNull();
  });

  it("P2 narrow: the toggle is in the title row, columns shrink, table scrolls", () => {
    render(<SettingsPlan />);
    const table = screen.getByTestId("plan-comparison");
    const toggle = screen.getByRole("group", { name: "Billing period" });
    expect(table.contains(toggle)).toBe(false);
    const section = screen.getByRole("region", { name: /Compare plans/ });
    expect(section.contains(toggle)).toBe(true);
    const cols = table.querySelectorAll("col");
    expect(cols[1].className).toContain("@max-[520px]:w-24");
    expect(cols[2].className).toContain("@max-[520px]:w-36");
    expect(table.parentElement?.className).toContain("overflow-x-auto");
    expect(table.closest("[data-settings-card]")?.className).toContain(
      "@container",
    );
  });

  it("P3 canceled with no period end never reads Active", () => {
    signedInPro({ current_period_end: null, cancel_at_period_end: true });
    render(<SettingsPlan />);
    expect(
      screen.getByText(
        "Canceled. Pro stays on until the end of this billing period.",
      ),
    ).not.toBeNull();
    expect(screen.queryByText("Active")).toBeNull();
  });

  it("tints the current column with no outline and keeps the tag", () => {
    render(<SettingsPlan />);
    const table = screen.getByTestId("plan-comparison");
    const header = within(table).getByRole("columnheader", {
      name: /Free.*Current plan/,
    });
    expect(header.className).toContain("bg-accent");
    expect(header.className).not.toContain("border-input");
    expect(header.className).not.toContain("border-x");
    for (const cell of table.querySelectorAll("td, th")) {
      expect(cell.className).not.toContain("border-input");
    }
  });

  it("puts white cards on the canvas in light and keeps room under the footer", () => {
    render(<SettingsPlan />);
    const card = screen
      .getByTestId("plan-comparison")
      .closest("[data-settings-card]");
    expect(card?.className).toContain("bg-card");
    expect(card?.className).toContain("dark:bg-muted");
    const privacy = screen.getByText("Privacy policy");
    expect(privacy.closest(".pb-6")).not.toBeNull();
  });

  it("selects a billing period with a light tile in light and a pill in dark", () => {
    render(<SettingsPlan />);
    const group = screen.getByRole("group", { name: "Billing period" });
    const pressed = within(group)
      .getAllByRole("button")
      .find((button) => button.getAttribute("aria-pressed") === "true");
    expect(pressed?.className).toContain("bg-card");
    expect(pressed?.className).toContain("border-input");
    expect(pressed?.className).toContain("dark:bg-foreground");
  });

  it("P3 Pro shows the price and who is billed", () => {
    signedInPro();
    render(<SettingsPlan />);
    expect(screen.getByTestId("plan-billing").textContent).toBe(
      "$132 a year · billed to judge@example.com",
    );
    cleanup();
    signedInPro({ interval: "month" });
    render(<SettingsPlan />);
    expect(screen.getByTestId("plan-billing").textContent).toBe(
      "$14 a month · billed to judge@example.com",
    );
  });

  it("P3 busy buttons say what they are doing", async () => {
    let finish!: () => void;
    mocks.openUpgrade.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(<SettingsPlan />);
    fireEvent.click(screen.getByRole("button", { name: "Upgrade to Pro" }));
    const busy = screen.getByRole("button", { name: "Opening checkout…" });
    expect(busy.hasAttribute("disabled")).toBe(true);
    finish();
    expect(
      await screen.findByRole("button", { name: "Upgrade to Pro" }),
    ).not.toBeNull();

    cleanup();
    signedInPro();
    mocks.openManageSubscription.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(<SettingsPlan />);
    fireEvent.click(
      screen.getByRole("button", { name: "Manage subscription" }),
    );
    expect(screen.getByRole("button", { name: "Opening…" })).not.toBeNull();
    finish();
  });

  it("P3 pending checkout: Stop waiting ends the wait", () => {
    mocks.state.checkoutPending = true;
    render(<SettingsPlan />);
    fireEvent.click(screen.getByRole("button", { name: "Stop waiting" }));
    expect(mocks.stopWaitingForCheckout).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("button", { name: "Reopen checkout" }),
    ).not.toBeNull();
  });

  it("P3 usage stacks in one column when narrow", () => {
    render(<SettingsPlan />);
    const usage = screen.getByTestId("plan-usage");
    expect(usage.className).toContain("grid-cols-1");
    expect(usage.className).toContain("min-[480px]:grid-cols-3");
  });

  it("footer links the privacy policy, free or Pro", () => {
    render(<SettingsPlan />);
    fireEvent.click(screen.getByRole("button", { name: "Privacy policy" }));
    expect(mocks.openPrivacyPolicy).toHaveBeenCalledTimes(1);
  });
});
