import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  status: "authorized" as string,
  toggle: vi.fn(async () => {}),
  openNew: vi.fn(),
  scheduleSync: vi.fn(),
  openUrl: vi.fn(async () => ({ status: "ok", data: null })),
  groups: [] as unknown[],
  toastError: vi.fn(),
  rows: [] as unknown[],
  defaultsApplied: false,
  setCalendarEnabled: vi.fn(async () => {}),
  setSettingValue: vi.fn(async (_key: string, value: boolean) => {
    mocks.defaultsApplied = value;
  }),
}));

vi.mock("@anlg/ui/components/ui/toast", () => ({
  toast: { error: mocks.toastError },
}));

const ICLOUD = [
  {
    sourceName: "iCloud",
    calendars: [
      { id: "c1", title: "Work", color: "#3366ff", enabled: true },
      { id: "c2", title: "Family", color: "#ff3366", enabled: false },
    ],
  },
];

vi.mock("~/calendar/components/context", () => ({
  SyncProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useSync: () => ({ scheduleSync: mocks.scheduleSync }),
}));
vi.mock("~/calendar/queries", () => ({
  useCalendarRows: () => mocks.rows,
  setCalendarEnabled: mocks.setCalendarEnabled,
}));
vi.mock("~/settings/queries", () => ({
  useSettingsReady: () => true,
  useStoredSettingValue: () => ({
    value: mocks.defaultsApplied,
    hasValue: true,
  }),
  setSettingValue: mocks.setSettingValue,
}));
vi.mock("~/calendar/components/apple/calendar-selection", () => ({
  useAppleCalendarSelection: () => ({
    groups: mocks.groups,
    handleRefresh: vi.fn(),
    handleToggle: mocks.toggle,
    isLoading: false,
    scheduleSync: mocks.scheduleSync,
  }),
}));
vi.mock("@anlg/plugin-opener2", () => ({
  commands: { openUrl: mocks.openUrl, openPath: vi.fn() },
}));
vi.mock("~/services/calendar", () => ({
  allowReconnectedCalendarConnections: vi.fn(),
}));
vi.mock("~/settings/general/week-start", () => ({
  WeekStartSelector: () => <div>Week starts on</div>,
}));
vi.mock("~/shared/hooks/usePermissions", () => ({
  usePermission: () => ({
    status: mocks.status,
    isPending: false,
    request: vi.fn(),
    open: vi.fn(),
  }),
}));
vi.mock("~/store/zustand/tabs", () => ({
  useTabs: (selector: (state: unknown) => unknown) =>
    selector({ openNew: mocks.openNew }),
}));

import { SettingsCalendar } from "./index";

describe("Settings › Calendar", () => {
  afterEach(cleanup);
  beforeEach(() => {
    mocks.status = "authorized";
    mocks.groups = ICLOUD;
    mocks.rows = [];
    mocks.defaultsApplied = false;
    vi.clearAllMocks();
  });

  it("lists visible calendars with a color dot and a switch", () => {
    render(<SettingsCalendar />);
    expect(
      screen.getByRole("region", { name: "Visible calendars" }),
    ).toBeTruthy();
    const rows = screen.getAllByTestId("visible-calendar");
    expect(rows).toHaveLength(2);
    const dot = rows[0].querySelector("[aria-hidden]") as HTMLElement;
    expect(dot.style.backgroundColor).toBe("rgb(51, 102, 255)");
    expect(
      screen.getByRole("switch", { name: "Work" }).getAttribute("aria-checked"),
    ).toBe("true");

    fireEvent.click(screen.getByRole("switch", { name: "Family" }));
    expect(mocks.toggle).toHaveBeenCalledWith(
      expect.objectContaining({ id: "c2" }),
      true,
    );
  });

  it("keeps the month view one click away", () => {
    render(<SettingsCalendar />);
    fireEvent.click(screen.getByRole("button", { name: /Open calendar/ }));
    expect(mocks.openNew).toHaveBeenCalledWith({ type: "calendar" });
  });

  it("asks for access before listing calendars", () => {
    mocks.status = "notDetermined";
    render(<SettingsCalendar />);
    const allow = screen.getByRole("button", { name: "Allow access" });
    expect(allow.className).toContain("bg-primary");
    expect(screen.queryAllByTestId("visible-calendar")).toHaveLength(0);
    // Fork: the Visible calendars card waits for access (redline-oct3).
    expect(
      screen.queryByRole("region", { name: "Visible calendars" }),
    ).toBeNull();
  });

  it("explains why it asks when there is no access", () => {
    mocks.status = "notDetermined";
    render(<SettingsCalendar />);
    expect(
      screen.getByText(
        "Upshot needs calendar access to show your upcoming meetings and name your notes.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/No calendars yet/)).toBeNull();
  });

  it("offers Add an account when access is on but no calendars came back", () => {
    mocks.groups = [];
    render(<SettingsCalendar />);
    expect(screen.getByText(/^No calendars yet\./)).toBeTruthy();
    expect(screen.queryByText(/Calendar access is off/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Allow access" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add an account" }));
    expect(mocks.openUrl).toHaveBeenCalledWith(
      "x-apple.systempreferences:com.apple.Internet-Accounts-Settings.extension",
      null,
    );
    expect(screen.getByRole("button", { name: "Refresh" })).toBeTruthy();
  });

  // journey-account-settings P3 "Settings › Calendar".
  it("shows a long name on hover and says when a toggle fails", async () => {
    mocks.toggle.mockRejectedValueOnce(new Error("db"));
    render(<SettingsCalendar />);
    expect(screen.getByText("Family").getAttribute("title")).toBe("Family");
    fireEvent.click(screen.getByRole("switch", { name: "Family" }));
    await vi.waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Couldn't update Family. Try again.",
      ),
    );
    expect(
      screen
        .getByRole("switch", { name: "Family" })
        .getAttribute("aria-checked"),
    ).toBe("false");
  });

  // Granola setup "Select all"; the same default as onboarding, once per Mac.
  it("turns calendars on once after access, not after the user turns all off", async () => {
    mocks.rows = [
      { id: "c1", name: "Work", source: "iCloud", enabled: false },
      { id: "c2", name: "Family", source: "iCloud", enabled: false },
      { id: "b", name: "Birthdays", source: "Other", enabled: false },
    ];
    render(<SettingsCalendar />);
    await vi.waitFor(() => expect(mocks.scheduleSync).toHaveBeenCalledTimes(1));
    expect(mocks.setCalendarEnabled.mock.calls).toEqual([
      ["c1", true],
      ["c2", true],
    ]);
    expect(mocks.defaultsApplied).toBe(true);
    cleanup();

    // The user later turned every calendar off and comes back.
    vi.clearAllMocks();
    render(<SettingsCalendar />);
    expect(mocks.setCalendarEnabled).not.toHaveBeenCalled();
    expect(mocks.setSettingValue).not.toHaveBeenCalled();
  });

  it("gives each row its own icon", () => {
    mocks.status = "notDetermined";
    render(<SettingsCalendar />);
    const icons = screen
      .getAllByTestId("setting-icon")
      .map((tile) => tile.innerHTML);
    expect(new Set(icons).size).toBe(icons.length);
  });
});
