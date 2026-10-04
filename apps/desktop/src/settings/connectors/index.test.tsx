import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  platform: "macos",
  status: "notDetermined",
  updateSettingsTabState: vi.fn(),
  scrollToSettingsElement: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => mocks.platform }));
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
    mocks.platform = "macos";
    mocks.status = "notDetermined";
  });

  // Fork: "Calendar", not "Apple Calendar": it reads every account in the
  // Mac's Calendar (Google, Outlook, iCloud).
  it("says Off for Calendar without access, Connected with it", () => {
    render(<SettingsConnectors />);
    expect(screen.getByText("On this Mac")).toBeTruthy();
    expect(screen.queryByText("Apple Calendar")).toBeNull();
    expect(
      screen.getByRole("button", { name: /^Calendar/ }).textContent,
    ).toContain("Off");
    cleanup();
    mocks.status = "authorized";
    render(<SettingsConnectors />);
    expect(
      screen.getByRole("button", { name: /^Calendar/ }).textContent,
    ).toContain("Connected");
  });

  // Fork: the calendar and Glaido are Mac only (NN/g heuristic #5); MCP,
  // the CLI and webhooks work everywhere.
  it.each(["windows", "linux"])(
    "leaves out Calendar and Glaido on %s",
    (os) => {
      mocks.platform = os;
      render(<SettingsConnectors />);

      expect(screen.queryByText("On this Mac")).toBeNull();
      expect(screen.getByText("On this computer")).toBeTruthy();
      expect(screen.queryByRole("button", { name: /^Calendar/ })).toBeNull();
      expect(screen.queryByRole("button", { name: /Glaido/ })).toBeNull();
      expect(screen.getByRole("button", { name: /MCP and CLI/ })).toBeTruthy();
      expect(screen.getByRole("button", { name: /Webhooks/ })).toBeTruthy();
    },
  );

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
