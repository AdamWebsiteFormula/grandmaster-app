import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ platform: "macos" }));

vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => mocks.platform }));

vi.mock("~/settings/team/mirror", () => ({
  useMyWorkspacesWithMirror: () => ({ data: [], isLoading: false }),
}));

import { useSettingsNavGroups } from "./settings-nav-groups";

function items() {
  const { result } = renderHook(() => useSettingsNavGroups());
  return result.current.flatMap((group) => group.items);
}

function keywords() {
  return items()
    .map((item) => item.keywords ?? "")
    .join(", ");
}

describe("useSettingsNavGroups", () => {
  afterEach(() => {
    mocks.platform = "macos";
  });

  // Fork: the Mac's Calendar holds every account, so people search for them.
  it("lists Calendar on a Mac, found by Google, Outlook and iCloud", () => {
    const calendar = items().find((item) => item.id === "calendars");

    expect(calendar?.keywords).toContain("Google, Outlook, iCloud");
    expect(items().some((item) => item.id === "calendar")).toBe(true);
    expect(keywords()).toContain("Match my Mac");
    expect(keywords()).toContain("Glaido");
  });

  // Fork: NN/g heuristic #5, no page or search word that leads to a Mac-only
  // row off a Mac.
  it.each(["windows", "linux"])(
    "drops Calendar and Mac-only search words on %s",
    (os) => {
      mocks.platform = os;
      const ids = items().map((item) => item.id);

      expect(ids).not.toContain("calendars");
      expect(ids).not.toContain("calendar");
      expect(ids).toContain("connectors");
      for (const word of [
        "Match my Mac",
        "Dock",
        "menu bar",
        "Apple Calendar",
        "Glaido",
        "bounce",
      ]) {
        expect(keywords()).not.toContain(word);
      }
      expect(keywords()).toContain("Use system setting");
      expect(keywords()).toContain("tray icon");
    },
  );
});
