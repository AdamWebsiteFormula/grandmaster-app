import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  state: { email: null as string | null, isSignedIn: false },
  openUpshotSignIn: vi.fn(),
  signOutUpshot: vi.fn(async () => {}),
}));

vi.mock("~/upshot-plan", () => ({
  useUpshotPlan: () => mocks.state,
  openUpshotSignIn: mocks.openUpshotSignIn,
  signOutUpshot: mocks.signOutUpshot,
}));
vi.mock("~/settings/general/account-profile", () => ({
  AccountProfile: () => null,
}));
vi.mock("~/store/zustand/tabs", () => ({
  useTabs: (selector: (state: unknown) => unknown) =>
    selector({ currentTab: null, updateSettingsTabState: vi.fn() }),
}));

import { SettingsProfile } from "./index";

// Fork: Sign in and Sign out moved here from Settings › Plan (redline-oct3).
describe("Settings › Profile account", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.state = { email: null, isSignedIn: false };
  });

  it("signed in: shows the email and signs out", () => {
    mocks.state = { email: "judge@example.com", isSignedIn: true };
    render(<SettingsProfile />);
    expect(screen.getByText("judge@example.com")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(mocks.signOutUpshot).toHaveBeenCalledOnce();
  });

  it("signed out: offers Sign in", () => {
    render(<SettingsProfile />);
    expect(
      screen.getByText("You're on Free. No account needed."),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(mocks.openUpshotSignIn).toHaveBeenCalledOnce();
  });

  it("sets the title in medium weight with tight tracking", () => {
    render(<SettingsProfile />);
    const title = screen.getByRole("heading", { name: "Profile" });
    expect(title.className).toContain("font-medium");
    expect(title.className).toContain("tracking-[-0.02em]");
  });
});
