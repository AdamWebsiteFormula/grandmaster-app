import { describe, expect, it } from "vitest";

import {
  chatFloatingPanelClassNames,
  chatFloatingPanelShellClassNames,
} from "./surface";

// Fork: journey-after P3 "Floating chat": tokens and flat in both themes.
describe("floating chat surface", () => {
  it.each([
    ["panel", chatFloatingPanelClassNames()],
    ["shell", chatFloatingPanelShellClassNames()],
  ])("the %s uses the popover token, no hex and no shadow", (_name, value) => {
    expect(value).toContain("bg-popover");
    expect(value).not.toMatch(/#[0-9a-f]{3,6}/i);
    expect(value).not.toContain("shadow");
  });

  it("separates the shell with a hairline", () => {
    expect(chatFloatingPanelShellClassNames()).toContain("border-border");
  });
});
