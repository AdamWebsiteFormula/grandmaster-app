import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  platform: vi.fn((): string => "macos"),
}));

vi.mock("@tauri-apps/plugin-os", () => ({ platform: mocks.platform }));

import {
  ariaKeyShortcut,
  isMac,
  kbdLabel,
  runtimePlatform,
  shortcutLabel,
} from "./shortcut-label";

// Apple HIG, Keyboards (⌘ glyphs, Shift before Command); Microsoft Writing
// Style Guide, Keys and keyboard shortcuts (Ctrl+Shift+N, never ⌘).
describe("shortcut labels", () => {
  afterEach(() => {
    mocks.platform.mockReset();
    mocks.platform.mockReturnValue("macos");
  });

  it("writes Mac glyphs in Apple's order", () => {
    expect(shortcutLabel(["mod", "N"], "macos")).toBe("⌘N");
    expect(shortcutLabel(["shift", "mod", "N"], "macos")).toBe("⇧⌘N");
    expect(shortcutLabel(["mod", "shift", "N"], "macos")).toBe("⇧⌘N");
    expect(kbdLabel(["mod", "J"], "macos")).toBe("⌘J");
    expect(kbdLabel(["mod", "alt", "F"], "macos")).toBe("⌥⌘F");
    expect(kbdLabel(["shift", "enter"], "macos")).toBe("⇧↵");
  });

  it.each(["windows", "linux"] as const)(
    "names the keys with + on %s, never ⌘",
    (os) => {
      expect(shortcutLabel(["mod", "N"], os)).toBe("Ctrl+N");
      expect(shortcutLabel(["shift", "mod", "N"], os)).toBe("Ctrl+Shift+N");
      expect(kbdLabel(["mod", "K"], os)).toBe("Ctrl+K");
      expect(kbdLabel(["alt", "mod", "F"], os)).toBe("Ctrl+Alt+F");
      expect(kbdLabel(["shift", "enter"], os)).toBe("Shift+Enter");
      expect(kbdLabel(["mod", "enter"], os)).toBe("Ctrl+Enter");
      expect(kbdLabel(["enter"], os)).toBe("Enter");
    },
  );

  it("announces Control off a Mac and Meta on one", () => {
    expect(ariaKeyShortcut(["mod", "J"], "macos")).toBe("Meta+J");
    expect(ariaKeyShortcut(["mod", ","], "macos")).toBe("Meta+,");
    expect(ariaKeyShortcut(["mod", "J"], "windows")).toBe("Control+J");
    expect(ariaKeyShortcut(["shift", "mod", "N"], "linux")).toBe(
      "Control+Shift+N",
    );
  });

  it("reads the OS when no platform is passed", () => {
    mocks.platform.mockReturnValue("windows");
    expect(kbdLabel(["mod", "J"])).toBe("Ctrl+J");
    expect(isMac()).toBe(false);

    mocks.platform.mockReturnValue("macos");
    expect(kbdLabel(["mod", "J"])).toBe("⌘J");
    expect(isMac()).toBe(true);
  });

  it("keeps the Mac labels when the runtime is unavailable", () => {
    mocks.platform.mockImplementation(() => {
      throw new Error("Tauri runtime unavailable");
    });

    expect(runtimePlatform()).toBeNull();
    expect(isMac()).toBe(true);
    expect(shortcutLabel(["mod", "N"])).toBe("⌘N");
  });
});
