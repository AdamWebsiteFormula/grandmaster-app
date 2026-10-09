import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Bell, Gear } from "@anlg/ui/components/icons";

import {
  SettingLinkRow,
  SettingRow,
  SettingsGroup,
  SettingSwitchRow,
} from "./setting-row";

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
    // Fork: inset dividers drawn by each row after the first (Oct 9).
    expect(card?.className).toContain("[&>*+*]:before:inset-x-4");
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

  // Fork: a disabled row dims its title, as macOS dims an unavailable
  // control's label (Apple HIG, Color); the description stays.
  it("dims the title of a row whose switch is disabled", () => {
    render(
      <SettingsGroup title="Meetings">
        <SettingSwitchRow
          title="Join scheduled meetings"
          description="Turn on Start when meeting begins first."
          checked={false}
          onChange={() => {}}
          disabled
        />
        <SettingSwitchRow
          title="Stop when meeting ends"
          checked
          onChange={() => {}}
        />
      </SettingsGroup>,
    );

    const disabledTitle = screen.getByRole("heading", {
      name: "Join scheduled meetings",
    });
    expect(disabledTitle.className).toContain("text-muted-foreground");
    expect(
      (
        screen.getByRole("switch", {
          name: "Join scheduled meetings",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      screen.getByText("Turn on Start when meeting begins first."),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Stop when meeting ends" }).className,
    ).not.toContain("text-muted-foreground");
  });

  // Fork: owner test, Oct 4. In the transcript's 320 px language popover,
  // the label sat beside a 192 px select and wrapped a syllable per line.
  it("stacks the label above a full-width control when asked", () => {
    const { container } = render(
      <SettingRow title="Main language" description="For summaries." stacked>
        {(labelProps) => <select {...labelProps} />}
      </SettingRow>,
    );
    const row = container.firstElementChild as HTMLElement;
    expect(row.className).toContain("flex-col");
    const control = screen.getByRole("combobox").parentElement!;
    expect(control.className).toContain("w-full");
    expect(control.className).not.toContain("w-48");
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
