import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cloud: {
    provider: "google" as "google" | "outlook" | null,
    connected: false,
    waiting: false,
    error: null as string | null,
    connect: vi.fn(),
    cancel: vi.fn(),
  },
  permission: {
    status: "neverRequested" as string,
    isPending: false,
    request: vi.fn(),
    reset: vi.fn(),
    open: vi.fn(),
  },
  enabled: [] as unknown[],
  platform: "macos",
}));

vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => mocks.platform }));
vi.mock("~/calendar/components/cloud-connect", async () => {
  const actual = await vi.importActual<
    typeof import("~/calendar/components/cloud-connect")
  >("~/calendar/components/cloud-connect");
  return {
    ConnectCloudCalendarLabel: actual.ConnectCloudCalendarLabel,
    useCloudCalendar: () => mocks.cloud,
    CloudCalendarList: ({ provider }: { provider: string }) => (
      <p>{`${provider} calendar list`}</p>
    ),
  };
});
vi.mock("~/shared/hooks/usePermissions", () => ({
  usePermission: () => mocks.permission,
}));
vi.mock("~/calendar/hooks", () => ({
  useEnabledCalendars: () => mocks.enabled,
}));
vi.mock("~/calendar/components/context", () => ({
  SyncProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useSync: () => ({ scheduleSync: vi.fn() }),
}));
vi.mock("~/calendar/components/apple/calendar-selection", () => ({
  useAppleCalendarSelection: () => ({
    groups: [],
    handleRefresh: vi.fn(),
    handleToggle: vi.fn(),
    isLoading: false,
  }),
}));
vi.mock("~/calendar/default-calendars", () => ({
  useTurnOnCalendarsByDefault: () => 0,
}));
vi.mock("~/calendar/queries", () => ({
  useCalendarRows: () => [],
}));
vi.mock("~/calendar/components/apple/permission", () => ({
  TroubleShootingLink: () => null,
  NoCalendarsYet: () => <p>No calendars yet</p>,
  openInternetAccounts: vi.fn(),
}));
vi.mock("~/calendar/components/calendar-selection", () => ({
  CalendarSelection: () => <p>Mac calendar list</p>,
}));

import { CalendarSection } from "./calendar";

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(mocks.cloud, {
    provider: "google",
    connected: false,
    waiting: false,
    error: null,
  });
  mocks.permission.status = "neverRequested";
  mocks.enabled = [];
  mocks.platform = "macos";
});

afterEach(() => {
  cleanup();
});

it("signed in with Google, the step's one action connects Google Calendar", () => {
  render(<CalendarSection onContinue={vi.fn()} />);

  fireEvent.click(
    screen.getByRole("button", { name: "Connect Google Calendar" }),
  );
  expect(mocks.cloud.connect).toHaveBeenCalledOnce();
  // No Internet Accounts detour and no Continue until a calendar is there.
  expect(screen.queryByText(/Internet Accounts/)).toBeNull();
  expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
});

it("names Outlook for a Microsoft account", () => {
  mocks.cloud.provider = "outlook";
  render(<CalendarSection onContinue={vi.fn()} />);

  expect(
    screen.getByRole("button", { name: "Connect Outlook calendar" }),
  ).toBeTruthy();
});

it("while the browser is open, says so and offers Cancel", () => {
  mocks.cloud.waiting = true;
  render(<CalendarSection onContinue={vi.fn()} />);

  expect(
    screen
      .getByRole("button", { name: "Finish in your browser…" })
      .hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(mocks.cloud.cancel).toHaveBeenCalledOnce();
});

it("shows why it failed", () => {
  mocks.cloud.error = "Sign-in didn't finish. Try again.";
  render(<CalendarSection onContinue={vi.fn()} />);

  expect(screen.getByRole("alert").textContent).toBe(
    "Sign-in didn't finish. Try again.",
  );
});

it("once connected, lists the calendars and continues", () => {
  mocks.cloud.connected = true;
  mocks.enabled = [{ id: "cal-1", provider: "google" }];
  const onContinue = vi.fn();
  render(<CalendarSection onContinue={onContinue} />);

  expect(screen.getByText("google calendar list")).toBeTruthy();
  expect(screen.queryByText(/calendars on this Mac/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(onContinue).toHaveBeenCalledWith(true);
});

it("on a Mac, calendars on this Mac are the second choice", () => {
  render(<CalendarSection onContinue={vi.fn()} />);

  fireEvent.click(
    screen.getByRole("button", { name: "Use calendars on this Mac instead" }),
  );
  expect(mocks.permission.request).toHaveBeenCalledOnce();
});

it("on Windows and Linux, there is no Mac choice", () => {
  mocks.platform = "windows";
  render(<CalendarSection onContinue={vi.fn()} />);

  expect(screen.queryByText(/calendars on this Mac/)).toBeNull();
});

it("signed out, the step keeps the calendars on this Mac", () => {
  mocks.cloud.provider = null;
  render(<CalendarSection onContinue={vi.fn()} />);

  expect(screen.getByRole("button", { name: "Connect calendar" })).toBeTruthy();
  expect(screen.queryByText(/Google Calendar/)).toBeNull();
});
