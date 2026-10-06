import { beforeEach, expect, it, vi } from "vitest";

const os = vi.hoisted(() => ({ name: "windows" }));
vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => os.name }));

import { getOnboardingSteps } from "./config";

beforeEach(() => {
  os.name = "windows";
});

it("skips the calendar step on Windows and Linux until the account calendar is on", () => {
  expect(getOnboardingSteps()).not.toContain("calendar");
  expect(getOnboardingSteps({ cloudCalendar: true })).toEqual([
    "login",
    "calendar",
    "imports",
    "final",
  ]);
});

it("always has the calendar step on a Mac (Apple Calendar)", () => {
  os.name = "macos";
  expect(getOnboardingSteps()).toContain("calendar");
  expect(getOnboardingSteps({ cloudCalendar: true })).toContain("calendar");
});
