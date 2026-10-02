import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const openNew = vi.hoisted(() => vi.fn());

vi.mock("~/store/zustand/tabs", () => ({
  useTabs: (selector: (state: { openNew: typeof openNew }) => unknown) =>
    selector({ openNew }),
}));

import { ConfigError } from "./config-error";

describe("ConfigError", () => {
  afterEach(() => {
    cleanup();
    openNew.mockReset();
  });

  it("sends you to choose a model from the empty summary state", () => {
    render(<ConfigError />);

    expect(screen.getByRole("alert")).not.toBeNull();
    expect(screen.getByText("Choose an AI model")).not.toBeNull();
    expect(
      screen.getByText(
        "Pick a model in Settings to turn this transcript into a summary.",
      ),
    ).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Get Pro" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Choose a model" }));
    expect(openNew).toHaveBeenCalledWith({
      type: "settings",
      state: { tab: "intelligence" },
    });
  });
});
