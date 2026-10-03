import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("~/settings/hydration-boundary", () => ({
  SettingsHydrationBoundary: ({ children }: { children: React.ReactNode }) =>
    children,
}));

vi.mock("./general", () => ({
  SettingsAccount: () => <div>Account settings</div>,
  SettingsApp: () => null,
  SettingsMeetings: () => null,
  SettingsNotifications: () => null,
  SettingsPermissions: () => null,
}));

vi.mock("./todo", () => ({ SettingsTodo: () => null }));
vi.mock("~/settings/ai/llm", () => ({ LLM: () => null }));
vi.mock("~/settings/ai/stt", () => ({ STT: () => null }));
vi.mock("~/settings/appearance", () => ({ SettingsAppearance: () => null }));
vi.mock("~/settings/developers", () => ({ SettingsDevelopers: () => null }));
vi.mock("~/settings/dictionary", () => ({ SettingsDictionary: () => null }));
vi.mock("~/settings/imports", () => ({ SettingsImports: () => null }));
vi.mock("~/settings/privacy", () => ({ SettingsPrivacy: () => null }));
vi.mock("~/settings/general/billing", () => ({
  SettingsBilling: () => <div>Billing settings</div>,
}));
vi.mock("~/settings/stats", () => ({
  SettingsInsights: () => <div>Personal insights</div>,
}));
vi.mock("~/settings/sync", () => ({ SettingsSync: () => null }));
vi.mock("~/settings/calendar", () => ({
  SettingsCalendar: () => <div>Calendar settings</div>,
}));
vi.mock("~/settings/connectors", () => ({
  SettingsConnectors: () => <div>Connectors settings</div>,
}));
vi.mock("~/settings/profile", () => ({
  SettingsProfile: () => <div>Profile settings</div>,
}));
vi.mock("~/settings/plan", () => ({ SettingsPlan: () => null }));
vi.mock("~/settings/team", () => ({ SettingsTeam: () => null }));
vi.mock("~/shared/main", () => ({
  StandardContentWrapper: ({ children }: { children: React.ReactNode }) =>
    children,
}));

import { TabContentSettings } from "./index";

import { createSettingsTab } from "~/store/zustand/tabs/test-utils";

describe("TabContentSettings", () => {
  afterEach(cleanup);

  it.each([
    ["billing", "Billing settings"],
    ["insights", "Personal insights"],
    ["stats", "Personal insights"],
    ["calendars", "Calendar settings"],
    ["connectors", "Connectors settings"],
    ["profile", "Profile settings"],
  ] as const)("opens the %s destination", (destination, heading) => {
    render(
      <TabContentSettings
        tab={createSettingsTab({ state: { tab: destination } })}
      />,
    );
    expect(screen.getByText(heading)).toBeTruthy();
  });

  it("centers the page in one column about 680 px wide", () => {
    render(
      <TabContentSettings
        tab={createSettingsTab({ state: { tab: "insights" } })}
      />,
    );
    const column = screen.getByText("Personal insights").parentElement;
    expect(column?.className).toContain("max-w-[680px]");
    expect(column?.className).toContain("mx-auto");
  });
});
