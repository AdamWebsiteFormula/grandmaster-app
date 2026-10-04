import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  state: { email: null as string | null, isSignedIn: false },
  openUpshotSignIn: vi.fn(),
  signOutUpshot: vi.fn(async () => {}),
  deleteUpshotAccount: vi.fn(async () => {}),
  platform: "macos",
}));

vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => mocks.platform }));

vi.mock("~/upshot-plan", () => ({
  useUpshotPlan: () => mocks.state,
  openUpshotSignIn: mocks.openUpshotSignIn,
  signOutUpshot: mocks.signOutUpshot,
  deleteUpshotAccount: mocks.deleteUpshotAccount,
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
    mocks.platform = "macos";
  });

  // Fork: "this computer" off a Mac (NN/g #2).
  it("says this computer off a Mac", async () => {
    mocks.platform = "windows";
    mocks.state = { email: "judge@example.com", isSignedIn: true };
    render(<SettingsProfile />);

    expect(
      screen.getByText(
        "Your contact card in Upshot. It stays on this computer.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Ends Pro and deletes your account. Notes stay on this computer.",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete account…" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Your notes stay on this computer.");
    expect(document.body.textContent).not.toContain("this Mac");
  });

  it("signed in: shows the email and signs out", () => {
    mocks.state = { email: "judge@example.com", isSignedIn: true };
    render(<SettingsProfile />);
    expect(screen.getByText("judge@example.com")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(mocks.signOutUpshot).toHaveBeenCalledOnce();
  });

  // Fork: Import notes is on Connectors only, so its "‹ Connectors" back
  // button matches where it opened from.
  it("has Insights but no Import notes row", () => {
    render(<SettingsProfile />);
    expect(screen.getByRole("button", { name: /Insights/ })).not.toBeNull();
    expect(screen.queryByRole("button", { name: /Import notes/ })).toBeNull();
  });

  it("signed out: offers Sign in", () => {
    render(<SettingsProfile />);
    expect(
      screen.getByText("You're on Free. No account needed."),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(mocks.openUpshotSignIn).toHaveBeenCalledOnce();
  });

  // journey-account-settings P3 "Account removal".
  it("signed in: Delete account asks first, then deletes", async () => {
    mocks.state = { email: "judge@example.com", isSignedIn: true };
    render(<SettingsProfile />);
    fireEvent.click(screen.getByRole("button", { name: "Delete account…" }));
    expect(mocks.deleteUpshotAccount).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Your notes stay on this Mac.");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete account" }),
    );
    await waitFor(() =>
      expect(mocks.deleteUpshotAccount).toHaveBeenCalledOnce(),
    );
  });

  it("signed in: a failed delete says why, next to the button", async () => {
    mocks.state = { email: "judge@example.com", isSignedIn: true };
    mocks.deleteUpshotAccount.mockRejectedValueOnce(
      new Error(
        "Could not cancel your subscription, so your account was kept. Try again.",
      ),
    );
    render(<SettingsProfile />);
    fireEvent.click(screen.getByRole("button", { name: "Delete account…" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete account" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "account was kept",
    );
  });

  it("signed out: no Delete account", () => {
    render(<SettingsProfile />);
    expect(
      screen.queryByRole("button", { name: "Delete account…" }),
    ).toBeNull();
  });

  it("sets the title in the semibold display face with tight tracking", () => {
    render(<SettingsProfile />);
    const title = screen.getByRole("heading", { name: "Profile" });
    expect(title.className).toContain("font-display");
    expect(title.className).toContain("font-semibold");
    expect(title.className).toContain("tracking-[-0.01em]");
  });
});
