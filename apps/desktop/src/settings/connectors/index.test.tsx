import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  status: "notDetermined",
  updateSettingsTabState: vi.fn(),
  scrollToSettingsElement: vi.fn(),
}));

vi.mock("~/shared/hooks/usePermissions", () => ({
  usePermission: () => ({ status: mocks.status }),
}));
vi.mock("~/store/zustand/tabs", () => ({
  useTabs: (selector: (state: unknown) => unknown) =>
    selector({
      currentTab: { type: "settings", state: { tab: "connectors" } },
      updateSettingsTabState: mocks.updateSettingsTabState,
    }),
}));
vi.mock("~/settings/sections", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/settings/sections")>()),
  scrollToSettingsElement: mocks.scrollToSettingsElement,
}));

import { SettingsConnectors } from "./index";

import { SETTINGS_ANCHORS } from "~/settings/sections";

// journey-account-settings P3 "Settings › Connectors".
describe("Settings › Connectors", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("says Off for Apple Calendar without access, Connected with it", () => {
    render(<SettingsConnectors />);
    expect(
      screen.getByRole("button", { name: /Apple Calendar/ }).textContent,
    ).toContain("Off");
    cleanup();
    mocks.status = "authorized";
    render(<SettingsConnectors />);
    expect(
      screen.getByRole("button", { name: /Apple Calendar/ }).textContent,
    ).toContain("Connected");
  });

  // Fork: a row opens its page at the matching section (NN/g #4).
  it.each([
    [/Glaido/, "developers", SETTINGS_ANCHORS.glaido],
    [/MCP and CLI/, "developers", SETTINGS_ANCHORS.cli],
    [/Webhooks/, "developers", SETTINGS_ANCHORS.webhooks],
    [/Export folder/, "app", SETTINGS_ANCHORS.storage],
  ])("%s opens %s at its section", (name, tab, anchor) => {
    render(<SettingsConnectors />);
    fireEvent.click(screen.getByRole("button", { name }));
    expect(mocks.updateSettingsTabState).toHaveBeenCalledWith(
      expect.anything(),
      { tab },
    );
    expect(mocks.scrollToSettingsElement).toHaveBeenCalledWith(anchor);
  });
});
