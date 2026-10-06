import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resourceDir: vi.fn(),
  ask: vi.fn(),
  exit: vi.fn(),
  openPath: vi.fn(),
  revealItemInDir: vi.fn(),
  platform: "macos",
}));

vi.mock("@tauri-apps/api/path", () => ({ resourceDir: mocks.resourceDir }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ ask: mocks.ask }));
vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => mocks.platform }));
vi.mock("@tauri-apps/plugin-process", () => ({ exit: mocks.exit }));
vi.mock("@anlg/plugin-opener2", () => ({
  commands: {
    openPath: mocks.openPath,
    revealItemInDir: mocks.revealItemInDir,
  },
}));

import {
  getBundlePath,
  isRunningFromDiskImage,
  promptMoveToApplications,
  resetMoveToApplicationsCheckForTests,
} from "./move-to-applications";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.platform = "macos";
  resetMoveToApplicationsCheckForTests();
});

describe("move to Applications (journey-first-run P3)", () => {
  it("finds the bundle and spots disk image and translocated paths", () => {
    expect(getBundlePath("/Volumes/Upshot/Upshot.app/Contents/Resources")).toBe(
      "/Volumes/Upshot/Upshot.app",
    );
    expect(getBundlePath("/Users/me/target/debug")).toBeNull();
    expect(isRunningFromDiskImage("/Volumes/Upshot/Upshot.app")).toBe(true);
    expect(
      isRunningFromDiskImage(
        "/private/var/folders/x/T/AppTranslocation/ABC/d/Upshot.app",
      ),
    ).toBe(true);
    expect(isRunningFromDiskImage("/Applications/Upshot.app")).toBe(false);
  });

  it("does not ask when Upshot is already in Applications", async () => {
    mocks.resourceDir.mockResolvedValue(
      "/Applications/Upshot.app/Contents/Resources",
    );
    await promptMoveToApplications();
    expect(mocks.ask).not.toHaveBeenCalled();
  });

  it("asks once from the disk image; Move quits and shows Applications", async () => {
    mocks.resourceDir.mockResolvedValue(
      "/Volumes/Upshot/Upshot.app/Contents/Resources",
    );
    mocks.ask.mockResolvedValue(true);

    await promptMoveToApplications();
    await promptMoveToApplications();

    expect(mocks.ask).toHaveBeenCalledTimes(1);
    expect(mocks.ask.mock.calls[0]![1]).toMatchObject({
      title: "Move Upshot to Applications",
      okLabel: "Move",
      cancelLabel: "Cancel",
    });
    expect(mocks.openPath).toHaveBeenCalledWith("/Applications", null);
    expect(mocks.revealItemInDir).toHaveBeenCalledWith(
      "/Volumes/Upshot/Upshot.app",
    );
    expect(mocks.exit).toHaveBeenCalledWith(0);
  });

  it("Cancel keeps Upshot running", async () => {
    mocks.resourceDir.mockResolvedValue(
      "/private/var/folders/x/T/AppTranslocation/ABC/d/Upshot.app/Contents/Resources",
    );
    mocks.ask.mockResolvedValue(false);

    await promptMoveToApplications();

    expect(mocks.exit).not.toHaveBeenCalled();
    expect(mocks.openPath).not.toHaveBeenCalled();
  });

  it("skips the check on other platforms", async () => {
    mocks.platform = "windows";
    await promptMoveToApplications();
    expect(mocks.resourceDir).not.toHaveBeenCalled();
  });
});
