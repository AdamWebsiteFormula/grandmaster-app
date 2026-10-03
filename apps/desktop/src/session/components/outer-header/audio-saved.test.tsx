import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

import { AudioSavedLine } from "./audio-saved";

const renderLine = () => render(<AudioSavedLine />);

describe("AudioSavedLine", () => {
  afterEach(() => {
    cleanup();
    mocks.openNew.mockClear();
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
    renderLine();

    expect(screen.getByRole("button", { name: text })).toBeTruthy();
  });

  it("is an icon button, not a line of text", () => {
    mocks.retention = "forever";
    renderLine();

    const button = screen.getByRole("button");
    expect(button.textContent).toBe("");
    expect(button.querySelector("svg")).toBeTruthy();
  });

  it("opens the retention setting", () => {
    mocks.retention = "oneWeek";
    renderLine();

    fireEvent.click(screen.getByRole("button"));

    expect(mocks.openNew).toHaveBeenCalledWith({
      type: "settings",
      state: { tab: "meetings" },
    });
  });
});
