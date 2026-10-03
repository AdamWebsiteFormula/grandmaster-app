import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Bell, Gear } from "@anlg/ui/components/icons";

import { SettingLinkRow, SettingsGroup, SettingSwitchRow } from "./setting-row";

describe("Settings card groups", () => {
  afterEach(cleanup);

  it("puts rows in one card under a section heading", () => {
    render(
      <SettingsGroup title="App">
        <SettingSwitchRow
          icon={Gear}
          title="Start at login"
          description="Have it ready."
          checked={false}
          onChange={() => {}}
        />
        <SettingSwitchRow
          icon={Bell}
          title="Show in menu bar"
          checked
          onChange={() => {}}
        />
      </SettingsGroup>,
    );

    const section = screen.getByRole("region", { name: "App" });
    expect(screen.getByRole("heading", { name: "App" }).tagName).toBe("H3");
    const card = section.querySelector("[data-settings-card]");
    expect(card).not.toBeNull();
    expect(card?.className).toContain("rounded-xl");
    expect(card?.className).toContain("divide-y");
    expect(card?.children).toHaveLength(2);
    expect(
      section.querySelectorAll("[data-testid='setting-icon']"),
    ).toHaveLength(2);
    expect(screen.getByRole("switch", { name: "Start at login" })).toBeTruthy();
  });

  it("renders a card without a heading when there is no title", () => {
    const { container } = render(
      <SettingsGroup>
        <p>Only row</p>
      </SettingsGroup>,
    );
    expect(screen.queryByRole("heading")).toBeNull();
    expect(container.querySelector("[data-settings-card]")).not.toBeNull();
  });

  it("link rows open their page", () => {
    const onClick = vi.fn();
    render(
      <SettingsGroup title="Files">
        <SettingLinkRow
          icon={Gear}
          title="Export folder"
          description="Save exports."
          onClick={onClick}
        />
      </SettingsGroup>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Export folder/ }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
