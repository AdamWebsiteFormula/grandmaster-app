import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@anlg/ui/components/ui/dropdown-menu";

const mocks = vi.hoisted(() => ({
  retention: undefined as unknown,
  openNew: vi.fn(),
}));

vi.mock("~/shared/config", () => ({
  useConfigValue: () => mocks.retention,
}));

vi.mock("~/store/zustand/tabs", () => ({
  useTabs: (selector: (state: unknown) => unknown) =>
    selector({ openNew: mocks.openNew }),
}));

import { AudioSavedMenuItem } from "./audio-saved";

const onSelect = vi.fn();
const renderItem = () =>
  render(
    <DropdownMenu open>
      <DropdownMenuTrigger>More</DropdownMenuTrigger>
      <DropdownMenuContent>
        <AudioSavedMenuItem onSelect={onSelect} />
      </DropdownMenuContent>
    </DropdownMenu>,
  );

describe("AudioSavedMenuItem", () => {
  afterEach(() => {
    cleanup();
    mocks.openNew.mockClear();
    onSelect.mockClear();
  });

  it.each([
    [undefined, "Audio saved on this Mac · kept forever"],
    ["forever", "Audio saved on this Mac · kept forever"],
    ["oneDay", "Audio saved on this Mac · kept for 1 day"],
    ["threeDays", "Audio saved on this Mac · kept for 3 days"],
    ["oneWeek", "Audio saved on this Mac · kept for 1 week"],
    ["oneMonth", "Audio saved on this Mac · kept for 1 month"],
    ["none", "Audio saved on this Mac · kept until transcribed"],
    ["bogus", "Audio saved on this Mac · kept forever"],
  ])("describes retention %s in plain words", (retention, text) => {
    mocks.retention = retention;
    renderItem();

    expect(screen.getByRole("menuitem", { name: text })).toBeTruthy();
  });

  it("is a labeled menu row, not an unlabeled icon", () => {
    mocks.retention = "forever";
    renderItem();

    const item = screen.getByRole("menuitem");
    expect(item.textContent).toBe("Audio saved on this Mac · kept forever");
    expect(item.querySelector("svg")).toBeTruthy();
  });

  it("opens the retention setting and closes the menu", () => {
    mocks.retention = "oneWeek";
    renderItem();

    fireEvent.click(screen.getByRole("menuitem"));

    expect(onSelect).toHaveBeenCalled();
    expect(mocks.openNew).toHaveBeenCalledWith({
      type: "settings",
      state: { tab: "meetings" },
    });
  });
});
