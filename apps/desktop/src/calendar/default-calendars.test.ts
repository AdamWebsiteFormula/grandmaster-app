import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: [] as unknown[],
  applied: false as boolean | undefined,
  settingsReady: true,
  setCalendarEnabled: vi.fn(async () => {}),
  setSettingValue: vi.fn(async () => {}),
  scheduleSync: vi.fn(),
}));

vi.mock("~/calendar/components/context", () => ({
  useSync: () => ({ scheduleSync: mocks.scheduleSync }),
}));
vi.mock("~/calendar/queries", () => ({
  useCalendarRows: () => mocks.rows,
  setCalendarEnabled: mocks.setCalendarEnabled,
}));
vi.mock("~/settings/queries", () => ({
  useSettingsReady: () => mocks.settingsReady,
  useStoredSettingValue: () => ({
    value: mocks.applied,
    hasValue: mocks.applied !== undefined,
  }),
  setSettingValue: mocks.setSettingValue,
}));

import {
  getCalendarsToTurnOn,
  isSkippedCalendar,
  useTurnOnCalendarsByDefault,
} from "./default-calendars";

const ROWS = [
  { id: "work", name: "Work", source: "iCloud", enabled: false },
  { id: "bday", name: "Birthdays", source: "Other", enabled: false },
  { id: "hol", name: "US Holidays", source: "Other", enabled: false },
  { id: "sub", name: "Team", source: "Subscribed Calendars", enabled: false },
  { id: "siri", name: "Siri Suggestions", source: "Other", enabled: false },
  { id: "home", name: "Home", source: "iCloud", enabled: false },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rows = [];
  mocks.applied = undefined;
  mocks.settingsReady = true;
});

describe("default calendars", () => {
  it("skips feeds no one meets from", () => {
    expect(isSkippedCalendar({ name: "Work", source: "Google" })).toBe(false);
    expect(isSkippedCalendar({ name: "Birthdays", source: "Other" })).toBe(
      true,
    );
    expect(
      isSkippedCalendar({ name: "Holidays in United States", source: "G" }),
    ).toBe(true);
    expect(getCalendarsToTurnOn(ROWS, null)).toEqual(["work", "home"]);
  });

  it("turns on only newly added calendars after the first pass", () => {
    expect(
      getCalendarsToTurnOn(
        [
          { id: "work", name: "Work", source: "iCloud", enabled: false },
          {
            id: "gmail",
            name: "me@gmail.com",
            source: "Google",
            enabled: false,
          },
        ],
        new Set(["work"]),
      ),
    ).toEqual(["gmail"]);
  });

  it("turns calendars on once, saves the flag and syncs Coming up", async () => {
    mocks.rows = ROWS;
    renderHook(() => useTurnOnCalendarsByDefault(false));

    await waitFor(() => expect(mocks.scheduleSync).toHaveBeenCalledTimes(1));
    expect(mocks.setCalendarEnabled.mock.calls).toEqual([
      ["work", true],
      ["home", true],
    ]);
    expect(mocks.setSettingValue).toHaveBeenCalledWith(
      "calendar_defaults_applied",
      true,
    );
  });

  it("saves the flag without changes when a calendar is already on", () => {
    mocks.rows = [
      { id: "work", name: "Work", source: "iCloud", enabled: true },
      { id: "home", name: "Home", source: "iCloud", enabled: false },
    ];
    renderHook(() => useTurnOnCalendarsByDefault(false));

    expect(mocks.setCalendarEnabled).not.toHaveBeenCalled();
    expect(mocks.setSettingValue).toHaveBeenCalledWith(
      "calendar_defaults_applied",
      true,
    );
  });

  it("does nothing once the defaults were applied on this Mac", () => {
    mocks.rows = ROWS;
    mocks.applied = true;
    renderHook(() => useTurnOnCalendarsByDefault(false));

    expect(mocks.setCalendarEnabled).not.toHaveBeenCalled();
    expect(mocks.setSettingValue).not.toHaveBeenCalled();
  });

  it("waits for settings, a finished sync and at least one calendar", () => {
    const { rerender } = renderHook(
      ({ loading }) => useTurnOnCalendarsByDefault(loading),
      { initialProps: { loading: false } },
    );
    mocks.rows = ROWS;
    rerender({ loading: true });
    mocks.settingsReady = false;
    rerender({ loading: false });

    expect(mocks.setCalendarEnabled).not.toHaveBeenCalled();
    expect(mocks.setSettingValue).not.toHaveBeenCalled();
  });
});
