import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ status: "notDetermined" }));

vi.mock("~/shared/hooks/usePermissions", () => ({
  usePermission: () => ({ status: mocks.status }),
}));
vi.mock("~/store/zustand/tabs", () => ({
  useTabs: (selector: (state: unknown) => unknown) =>
    selector({ currentTab: null, updateSettingsTabState: vi.fn() }),
}));

import { SettingsConnectors } from "./index";

// journey-account-settings P3 "Settings › Connectors".
describe("Settings › Connectors", () => {
  afterEach(cleanup);

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
});
