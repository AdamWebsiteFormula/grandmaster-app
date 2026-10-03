import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ConfigError } from "./config-error";

describe("ConfigError", () => {
  afterEach(() => {
    cleanup();
  });

  it("says Upshot AI is getting ready, with no settings or key links", () => {
    render(<ConfigError />);

    expect(screen.getByRole("alert")).not.toBeNull();
    expect(screen.getByText("Upshot AI is getting ready")).not.toBeNull();
    expect(
      screen.getByText(
        "Try again in a minute to turn this transcript into a summary.",
      ),
    ).not.toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
