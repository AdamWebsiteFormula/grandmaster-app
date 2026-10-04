import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  openUrl: vi.fn(),
  openPath: vi.fn(),
}));

vi.mock("@anlg/plugin-opener2", () => ({
  commands: { openUrl: mocks.openUrl, openPath: mocks.openPath },
}));

import {
  AppleCalendarPermissionDialog,
  CalendarAccessNeeded,
  INTERNET_ACCOUNTS_URL,
  NoCalendarsYet,
  openInternetAccounts,
  TroubleShootingLink,
} from "./permission";

describe("calendar states", () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.openUrl.mockResolvedValue({ status: "ok", data: null });
  });

  it("no access: says why and offers Allow access", () => {
    const onAllow = vi.fn();
    render(<CalendarAccessNeeded onAllow={onAllow} />);
    expect(
      screen.getByText(
        "Upshot needs calendar access to show meetings from your Google, Outlook and iCloud calendars and name your notes.",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Allow access" }));
    expect(onAllow).toHaveBeenCalledTimes(1);
  });

  it("granted but empty: Add account opens Internet Accounts, Refresh refreshes", () => {
    const onRefresh = vi.fn();
    render(<NoCalendarsYet onRefresh={onRefresh} />);
    expect(
      screen.getByText(
        "No calendars yet. Add your Google or Outlook account to your Mac, and its calendars show up here.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/access is off/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Add account" }));
    expect(mocks.openUrl).toHaveBeenCalledWith(INTERNET_ACCOUNTS_URL, null);

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  // Owner feedback, Oct 3: access covers every calendar on this Mac.
  it("access off: the dialog says calendar access, not Apple Calendar", () => {
    const onOpenChange = vi.fn();
    const onOpenSettings = vi.fn();
    render(
      <AppleCalendarPermissionDialog
        open
        onOpenChange={onOpenChange}
        onOpenSettings={onOpenSettings}
      />,
    );
    expect(
      screen.getByRole("dialog", { name: "Calendar access is off" }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Turn on Upshot in System Settings › Privacy & Security › Calendars, then return here.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/Apple Calendar/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("falls back to System Settings when the pane will not open", async () => {
    mocks.openUrl.mockResolvedValue({ status: "error", error: "nope" });
    await openInternetAccounts();
    expect(mocks.openPath).toHaveBeenCalledWith(
      "/System/Applications/System Settings.app",
      null,
    );
  });

  it("troubleshooting with access on says quit and reopen, not access is off", () => {
    render(
      <TroubleShootingLink
        isAuthorized
        isPending={false}
        onOpen={vi.fn()}
        onRequest={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Having trouble?" }));
    expect(
      screen.getByText("Quit and reopen Upshot, then click Refresh."),
    ).toBeTruthy();
    expect(screen.queryByText(/Calendar access is off/)).toBeNull();
  });

  it("troubleshooting without access still says access is off", () => {
    render(
      <TroubleShootingLink
        isPending={false}
        onOpen={vi.fn()}
        onRequest={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Having trouble?" }));
    expect(screen.getByText(/Calendar access is off/)).toBeTruthy();
  });
});
