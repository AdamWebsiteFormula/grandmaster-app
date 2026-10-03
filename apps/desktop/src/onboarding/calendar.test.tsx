import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  permission: {
    status: "denied" as string,
    isPending: false,
    request: vi.fn(),
    reset: vi.fn(),
    open: vi.fn(),
  },
  enabled: [] as unknown[],
  rows: [] as unknown[],
  openInternetAccounts: vi.fn(),
  setCalendarEnabled: vi.fn(),
  scheduleSync: vi.fn(),
  handleRefresh: vi.fn(),
  isLoading: false,
  groups: [] as unknown[],
  emptyStateProps: null as null | Record<string, unknown>,
}));

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
  useSync: () => ({ scheduleSync: mocks.scheduleSync }),
}));
vi.mock("~/calendar/components/apple/calendar-selection", () => ({
  useAppleCalendarSelection: () => ({
    groups: mocks.groups,
    handleRefresh: mocks.handleRefresh,
    handleToggle: vi.fn(),
    isLoading: mocks.isLoading,
  }),
}));
vi.mock("~/calendar/queries", () => ({
  useCalendarRows: () => mocks.rows,
  setCalendarEnabled: mocks.setCalendarEnabled,
}));
vi.mock("~/settings/queries", () => ({
  useSettingsReady: () => true,
  useStoredSettingValue: () => ({ value: false, hasValue: false }),
  setSettingValue: vi.fn(async () => {}),
}));
vi.mock("~/calendar/components/apple/permission", () => ({
  TroubleShootingLink: () => <p>Troubleshooting</p>,
  NoCalendarsYet: (props: Record<string, unknown>) => {
    mocks.emptyStateProps = props;
    return <p>No calendars yet</p>;
  },
  openInternetAccounts: mocks.openInternetAccounts,
}));
vi.mock("~/calendar/components/calendar-selection", () => ({
  CalendarSelection: ({ emptyState }: { emptyState: React.ReactNode }) => (
    <div>
      <p>Calendar list</p>
      {emptyState}
    </div>
  ),
}));

import { CalendarSection } from "./calendar";

beforeEach(() => {
  mocks.permission.status = "denied";
  mocks.enabled = [];
  mocks.rows = [];
  mocks.groups = [];
  mocks.isLoading = false;
  mocks.emptyStateProps = null;
  vi.clearAllMocks();
  mocks.setCalendarEnabled.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

it("offers only the local Apple Calendar, no cloud sign-in", () => {
  render(<CalendarSection onContinue={vi.fn()} />);

  expect(screen.getByRole("button", { name: "Connect calendar" })).toBeTruthy();
  expect(screen.getAllByRole("button")).toHaveLength(2);
  expect(screen.queryByText(/Google Calendar/)).toBeNull();
  expect(screen.queryByText(/Connect Outlook/)).toBeNull();
  expect(screen.queryByText(/Sign in/)).toBeNull();
  expect(screen.getByText(/Internet Accounts show up here too/)).toBeTruthy();
});

it("asks macOS for calendar permission when clicked", () => {
  render(<CalendarSection onContinue={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Connect calendar" }));

  expect(mocks.permission.request).toHaveBeenCalledTimes(1);
});

it("shows the calendar list and Continue once a calendar is on", () => {
  mocks.permission.status = "authorized";
  mocks.enabled = [{ id: "work" }];
  const onContinue = vi.fn();
  render(<CalendarSection onContinue={onContinue} />);

  expect(screen.getByText("Calendar list")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(onContinue).toHaveBeenCalledTimes(1);
});

it("says Add an account once access is on, and opens Internet Accounts", () => {
  mocks.permission.status = "authorized";
  render(<CalendarSection onContinue={vi.fn()} />);

  expect(screen.queryByRole("button", { name: "Connect calendar" })).toBeNull();
  expect(screen.queryByText("Open Calendar settings")).toBeNull();
  const buttons = screen.getAllByRole("button", { name: "Add an account" });
  expect(buttons).toHaveLength(1);
  fireEvent.click(buttons[0]!);
  expect(mocks.openInternetAccounts).toHaveBeenCalledTimes(1);
  expect(mocks.permission.open).not.toHaveBeenCalled();
});

it("always shows Continue once access is on, even with every calendar off", () => {
  mocks.permission.status = "authorized";
  const onContinue = vi.fn();
  render(<CalendarSection onContinue={onContinue} />);

  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(onContinue).toHaveBeenCalledTimes(1);
});

it("has no Continue before access is allowed", () => {
  render(<CalendarSection onContinue={vi.fn()} />);
  expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
});

it("uses the shared empty state without a second Add an account", () => {
  mocks.permission.status = "authorized";
  render(<CalendarSection onContinue={vi.fn()} />);

  expect(screen.getByText("No calendars yet")).toBeTruthy();
  expect(mocks.emptyStateProps).toMatchObject({ showAddAccount: false });
});

it("turns on every calendar except feeds the first time they arrive", async () => {
  mocks.permission.status = "authorized";
  mocks.rows = [
    { id: "work", name: "Work", source: "iCloud", enabled: false },
    { id: "bday", name: "Birthdays", source: "Other", enabled: false },
    { id: "hol", name: "US Holidays", source: "Other", enabled: false },
    { id: "sub", name: "Team", source: "Subscribed Calendars", enabled: false },
    { id: "siri", name: "Siri Suggestions", source: "Other", enabled: false },
    { id: "home", name: "Home", source: "iCloud", enabled: false },
  ];
  render(<CalendarSection onContinue={vi.fn()} />);

  await waitFor(() => expect(mocks.scheduleSync).toHaveBeenCalledTimes(2));
  expect(mocks.setCalendarEnabled.mock.calls).toEqual([
    ["work", true],
    ["home", true],
  ]);
  expect(
    screen.getByText("Turn off any calendar you don't meet from."),
  ).toBeTruthy();
});

it("leaves calendars alone when one is already on, or while syncing", () => {
  mocks.permission.status = "authorized";
  mocks.rows = [
    { id: "work", name: "Work", source: "iCloud", enabled: true },
    { id: "home", name: "Home", source: "iCloud", enabled: false },
  ];
  render(<CalendarSection onContinue={vi.fn()} />);
  expect(mocks.setCalendarEnabled).not.toHaveBeenCalled();
  cleanup();

  mocks.rows = [{ id: "work", name: "Work", source: "iCloud", enabled: false }];
  mocks.isLoading = true;
  render(<CalendarSection onContinue={vi.fn()} />);
  expect(mocks.setCalendarEnabled).not.toHaveBeenCalled();
});

it("re-syncs calendars when the window gets focus back", () => {
  mocks.permission.status = "authorized";
  render(<CalendarSection onContinue={vi.fn()} />);

  window.dispatchEvent(new Event("focus"));
  expect(mocks.handleRefresh).toHaveBeenCalledTimes(1);
});

it("opens Internet Accounts from under the accounts line", () => {
  render(<CalendarSection onContinue={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Add an account" }));
  expect(mocks.openInternetAccounts).toHaveBeenCalledTimes(1);
});

it("hides the accounts line when access is on and no calendars came back", () => {
  mocks.permission.status = "authorized";
  render(<CalendarSection onContinue={vi.fn()} />);
  expect(screen.queryByText(/Internet Accounts show up here too/)).toBeNull();
  // Only the main button offers it; the empty state doesn't repeat it.
  expect(
    screen.getAllByRole("button", { name: "Add an account" }),
  ).toHaveLength(1);
});
