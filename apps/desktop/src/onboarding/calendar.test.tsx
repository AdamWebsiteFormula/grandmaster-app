import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
vi.mock("~/calendar/components/apple/permission", () => ({
  TroubleShootingLink: () => <p>Troubleshooting</p>,
}));
vi.mock("~/calendar/components/calendar-selection", () => ({
  CalendarSelection: () => <p>Calendar list</p>,
}));

import { CalendarSection } from "./calendar";

beforeEach(() => {
  mocks.permission.status = "denied";
  mocks.enabled = [];
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

it("offers only the local Apple Calendar, no cloud sign-in", () => {
  render(<CalendarSection onContinue={vi.fn()} />);

  expect(screen.getByRole("button", { name: "Connect calendar" })).toBeTruthy();
  expect(screen.getAllByRole("button")).toHaveLength(1);
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
