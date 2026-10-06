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
    CloudCalendarName: actual.CloudCalendarName,
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

it("signed in with Google, Google Calendar and Apple Calendar are equal rows", () => {
  render(<CalendarSection onContinue={vi.fn()} />);

  expect(screen.getByText("Google Calendar")).toBeTruthy();
  expect(screen.getByText("Apple Calendar")).toBeTruthy();
  const [google, apple] = screen.getAllByRole("button", { name: "Connect" });
  expect(google.className).toBe(apple.className);
  // No "instead" choice and no Internet Accounts detour.
  expect(screen.queryByText(/instead/)).toBeNull();
  expect(screen.queryByText(/Internet Accounts/)).toBeNull();
  expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();

  fireEvent.click(google);
  expect(mocks.cloud.connect).toHaveBeenCalledOnce();
  fireEvent.click(apple);
  expect(mocks.permission.request).toHaveBeenCalledOnce();
});

it("names Outlook for a Microsoft account", () => {
  mocks.cloud.provider = "outlook";
  render(<CalendarSection onContinue={vi.fn()} />);

  expect(screen.getByText("Outlook calendar")).toBeTruthy();
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

it("once connected, says so, lists the calendars and continues", () => {
  mocks.cloud.connected = true;
  mocks.enabled = [{ id: "cal-1", provider: "google" }];
  const onContinue = vi.fn();
  render(<CalendarSection onContinue={onContinue} />);

  expect(screen.getByText("Connected")).toBeTruthy();
  expect(screen.getByText("google calendar list")).toBeTruthy();
  // Apple Calendar can still be added next to it.
  expect(screen.getByRole("button", { name: "Connect" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(onContinue).toHaveBeenCalledWith(true);
});

it("Apple Calendar denied points to System Settings", () => {
  mocks.permission.status = "denied";
  render(<CalendarSection onContinue={vi.fn()} />);

  const apple = screen.getAllByRole("button", { name: "Connect" })[1];
  fireEvent.click(apple);
  expect(mocks.permission.open).toHaveBeenCalledOnce();
});

it("on Windows and Linux, there is no Apple Calendar row", () => {
  mocks.platform = "windows";
  render(<CalendarSection onContinue={vi.fn()} />);

  expect(screen.queryByText("Apple Calendar")).toBeNull();
  expect(screen.getAllByRole("button", { name: "Connect" })).toHaveLength(1);
});

it("signed out, the step keeps the calendars on this Mac", () => {
  mocks.cloud.provider = null;
  render(<CalendarSection onContinue={vi.fn()} />);

  expect(screen.getByRole("button", { name: "Connect calendar" })).toBeTruthy();
  expect(screen.queryByText(/Google Calendar/)).toBeNull();
});
