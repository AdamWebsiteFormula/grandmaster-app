import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setTheme: vi.fn(),
  applyThemePreference: vi.fn(),
  theme: "system",
  appIcon: "default",
}));

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
  });

  it("applies the selected theme with the current app icon", () => {
    mocks.appIcon = "anagram";
    render(<ThemeSelector />);

    expect(
      screen
        .getByRole("radio", { name: /Match my Mac/ })
        .getAttribute("aria-checked"),
    ).toBe("true");

    fireEvent.click(screen.getByRole("radio", { name: /Dark/ }));

    expect(mocks.applyThemePreference).toHaveBeenCalledWith("dark", "anagram");
    expect(mocks.setTheme).toHaveBeenCalledWith("dark");
  });

  // grandmaster/sops/settings-ia-oct3.md Q1: one compact row with text
  // segments, Match my Mac by default.
  it("is one Theme row with three text segments", () => {
    render(<ThemeSelector />);
    const group = screen.getByRole("radiogroup", { name: "Theme" });
    expect(
      Array.from(group.querySelectorAll("[role=radio]")).map(
        (radio) => radio.textContent,
      ),
    ).toEqual(["Light", "Dark", "Match my Mac"]);
  });

  it("marks the choice with a light bordered tile in light and a pill in dark", () => {
    mocks.theme = "dark";
    render(<ThemeSelector />);
    const selected = screen.getByRole("radio", { name: "Dark" });
    expect(selected.className).toContain("bg-card");
    expect(selected.className).toContain("border-input");
    expect(selected.className).toContain("dark:bg-foreground");
    const idle = screen.getByRole("radio", { name: "Light" });
    expect(idle.className).toContain("border-transparent");
    expect(idle.className).not.toContain("bg-card");
  });

  it("moves and selects with the arrow keys", () => {
    render(<ThemeSelector />);
    const system = screen.getByRole("radio", { name: "Match my Mac" });
    expect(system.getAttribute("tabindex")).toBe("0");

    fireEvent.keyDown(system, { key: "ArrowRight" });

    expect(mocks.setTheme).toHaveBeenCalledWith("light");
  });
});
