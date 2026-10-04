import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  platform: vi.fn(() => "macos"),
}));

vi.mock("@tauri-apps/plugin-os", () => ({
  platform: mocks.platform,
}));

import { AppSettingsView } from "./app-settings";

function setting(value = true) {
  return {
    value,
    onChange: vi.fn(),
  };
}

function renderAppSettings({
  appStoreBuild = false,
  automaticUpdates = setting(),
} = {}) {
  return {
    ...render(
      <AppSettingsView
        appStoreBuild={appStoreBuild}
        autostart={setting()}
        automaticUpdates={automaticUpdates}
        showAppInDock={setting()}
        showTrayIcon={setting()}
      />,
    ),
    automaticUpdates,
  };
}

describe("AppSettingsView", () => {
  afterEach(() => {
    cleanup();
    mocks.platform.mockReturnValue("macos");
  });

  // Fork: "your computer" off a Mac (NN/g #2).
  it.each([
    ["macos", "Have Upshot ready when you log in to your Mac."],
    ["windows", "Have Upshot ready when you log in to your computer."],
    ["linux", "Have Upshot ready when you log in to your computer."],
  ])("says where login starts Upshot on %s", (os, text) => {
    mocks.platform.mockReturnValue(os);
    renderAppSettings();

    expect(screen.getByText(text)).toBeTruthy();
  });

  it("does not offer automatic updates (the updater is off in this fork)", () => {
    renderAppSettings();

    expect(
      screen.queryByRole("switch", { name: "Automatically install updates" }),
    ).toBeNull();
  });

  it("hides direct-distribution controls in App Store builds", () => {
    renderAppSettings({ appStoreBuild: true });

    expect(
      screen.queryByRole("switch", { name: "Start Anarlog at login" }),
    ).toBeNull();
    expect(
      screen.queryByRole("switch", { name: "Automatically install updates" }),
    ).toBeNull();
  });
});
