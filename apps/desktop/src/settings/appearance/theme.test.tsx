import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setTheme: vi.fn(),
  applyThemePreference: vi.fn(),
  theme: "system",
  appIcon: "default",
  platform: "macos",
}));

vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => mocks.platform }));

vi.mock("~/settings/queries", () => ({
  useSetSettingValue: () => mocks.setTheme,
}));

vi.mock("~/shared/config", () => ({
  useConfigValue: (key: string) =>
    key === "theme" ? mocks.theme : mocks.appIcon,
}));

vi.mock("~/shared/theme/provider", () => ({
  applyThemePreference: mocks.applyThemePreference,
}));

import { ThemeSelector } from "./theme";

describe("ThemeSelector", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.theme = "system";
    mocks.appIcon = "default";
    mocks.platform = "macos";
  });

  // Fork: off a Mac the option that follows the OS says "System".
  it.each(["windows", "linux"])("says System and your computer on %s", (os) => {
    mocks.platform = os;
    render(<ThemeSelector />);

    expect(
      screen
        .getByRole("radio", { name: "System" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen.getByText("Light, dark, or the same as your computer."),
    ).toBeTruthy();
    expect(screen.queryByText(/Mac/)).toBeNull();
  });

  it("applies the selected theme with the current app icon", () => {
    mocks.appIcon = "anagram";
    render(<ThemeSelector />);

    expect(
      screen.getByRole("radio", { name: /Auto/ }).getAttribute("aria-checked"),
    ).toBe("true");

    fireEvent.click(screen.getByRole("radio", { name: /Dark/ }));

    expect(mocks.applyThemePreference).toHaveBeenCalledWith("dark", "anagram");
    expect(mocks.setTheme).toHaveBeenCalledWith("dark");
  });

  // grandmaster/sops/settings-ia-oct3.md Q1: one compact row with text
  // segments, Auto by default (macOS System Settings › Appearance).
  it("is one Theme row with three text segments", () => {
    render(<ThemeSelector />);
    const group = screen.getByRole("radiogroup", { name: "Theme" });
    expect(
      Array.from(group.querySelectorAll("[role=radio]")).map(
        (radio) => radio.textContent,
      ),
    ).toEqual(["Light", "Dark", "Auto"]);
  });

  it("marks the choice with a light bordered tile in light and a gray fill in dark", () => {
    mocks.theme = "dark";
    render(<ThemeSelector />);
    const selected = screen.getByRole("radio", { name: "Dark" });
    expect(selected.className).toContain("bg-card");
    expect(selected.className).toContain("border-input");
    expect(selected.className).toContain("dark:bg-[hsl(0_0%_24%)]");
    const idle = screen.getByRole("radio", { name: "Light" });
    expect(idle.className).toContain("border-transparent");
    expect(idle.className).not.toContain("bg-card");
  });

  it("moves and selects with the arrow keys", () => {
    render(<ThemeSelector />);
    const system = screen.getByRole("radio", { name: "Auto" });
    expect(system.getAttribute("tabindex")).toBe("0");

    fireEvent.keyDown(system, { key: "ArrowRight" });

    expect(mocks.setTheme).toHaveBeenCalledWith("light");
  });
});
