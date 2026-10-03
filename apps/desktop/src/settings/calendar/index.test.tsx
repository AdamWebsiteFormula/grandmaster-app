import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  status: "authorized" as string,
  toggle: vi.fn(async () => {}),
  openNew: vi.fn(),
  scheduleSync: vi.fn(),
}));

vi.mock("~/calendar/components/context", () => ({
  SyncProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("~/calendar/components/apple/calendar-selection", () => ({
  useAppleCalendarSelection: () => ({
    groups: [
      {
        sourceName: "iCloud",
        calendars: [
          { id: "c1", title: "Work", color: "#3366ff", enabled: true },
          { id: "c2", title: "Family", color: "#ff3366", enabled: false },
        ],
      },
    ],
    handleRefresh: vi.fn(),
    handleToggle: mocks.toggle,
    isLoading: false,
    scheduleSync: mocks.scheduleSync,
  }),
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

  it("gives each row its own icon", () => {
    mocks.status = "notDetermined";
    render(<SettingsCalendar />);
    const icons = screen
      .getAllByTestId("setting-icon")
      .map((tile) => tile.innerHTML);
    expect(new Set(icons).size).toBe(icons.length);
  });
});
