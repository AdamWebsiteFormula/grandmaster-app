import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("~/settings/hydration-boundary", () => ({
  SettingsHydrationBoundary: ({ children }: { children: React.ReactNode }) =>
    children,
}));

vi.mock("./general", () => ({
  SettingsAccount: () => <div>Account settings</div>,
  SettingsApp: () => <div>General settings</div>,
  SettingsMeetings: () => null,
  SettingsNotifications: () => null,
}));

vi.mock("./todo", () => ({ SettingsTodo: () => null }));
vi.mock("~/settings/ai/llm", () => ({ LLM: () => null }));
vi.mock("~/settings/ai/stt", () => ({
  STT: () => <div>Transcription settings</div>,
}));
vi.mock("~/settings/developers", () => ({
  SettingsDevelopers: () => <div>Developer settings</div>,
}));
vi.mock("~/settings/imports", () => ({
  SettingsImports: () => <div>Import settings</div>,
}));
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

import type { SettingsTab } from "~/store/zustand/tabs";
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
    // Fork: old ids of pages that became sections open their new page
    // (grandmaster/sops/settings-ia-oct3.md).
    ["appearance", "General settings"],
    ["privacy", "General settings"],
    ["permissions", "General settings"],
    ["dictionary", "Transcription settings"],
    ["personalization", "Transcription settings"],
    ["imports", "Import settings"],
    ["data", "Import settings"],
    ["developers", "Developer settings"],
  ] as const)("opens the %s destination", (destination, heading) => {
    render(
      <TabContentSettings
        // Legacy ids ("data", "personalization") are not SettingsTab
        // members; restored tabs can still carry them.
        tab={createSettingsTab({ state: { tab: destination as SettingsTab } })}
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

  it.each([
    ["insights", "Back to Profile"],
    ["imports", "Back to Connectors"],
    ["developers", "Back to Connectors"],
  ] as const)("gives the %s sub-page a back button", (destination, name) => {
    render(
      <TabContentSettings
        tab={createSettingsTab({ state: { tab: destination } })}
      />,
    );
    expect(screen.getByRole("button", { name })).toBeTruthy();
  });

  it("gives sidebar pages no back button", () => {
    render(
      <TabContentSettings tab={createSettingsTab({ state: { tab: "app" } })} />,
    );
    expect(screen.queryByRole("button", { name: /^Back to/ })).toBeNull();
  });
});
