import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  classifyStartFailure,
  describeStartFailure,
  getMicrophonePermission,
} from "./start-failure";

const mocks = vi.hoisted(() => ({
  platform: vi.fn(() => "macos"),
  checkPermission: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-os", () => ({ platform: mocks.platform }));

vi.mock("@anlg/plugin-permissions", () => ({
  commands: { checkPermission: mocks.checkPermission },
}));

describe("getMicrophonePermission", () => {
  beforeEach(() => {
    mocks.checkPermission.mockReset();
    mocks.checkPermission.mockResolvedValue({ status: "ok", data: "denied" });
  });

  test("reports the macOS permission status", async () => {
    mocks.platform.mockReturnValue("macos");
    await expect(getMicrophonePermission()).resolves.toBe("denied");
  });

  test("ignores the input probe outside macOS", async () => {
    mocks.platform.mockReturnValue("linux");
    await expect(getMicrophonePermission()).resolves.toBeNull();
    expect(mocks.checkPermission).not.toHaveBeenCalled();
  });
});

describe("classifyStartFailure", () => {
  test("treats a recovery-marker failure as storage", () => {
    expect(
      classifyStartFailure({
        stage: "recovery_marker",
        error: null,
        microphonePermission: null,
      }),
    ).toBe("storage");
  });

  test("recognizes native error messages", () => {
    expect(
      classifyStartFailure({
        stage: "capture_rejected",
        error: "session already running",
        microphonePermission: "denied",
      }),
    ).toBe("already_running");
    expect(
      classifyStartFailure({
        stage: "capture_rejected",
        error: "session storage unavailable",
        microphonePermission: "authorized",
      }),
    ).toBe("storage");
  });

  test("blames microphone permission only when it is not granted", () => {
    expect(
      classifyStartFailure({
        stage: "capture_rejected",
        error: "start session failed",
        microphonePermission: "denied",
      }),
    ).toBe("microphone_permission");
    expect(
      classifyStartFailure({
        stage: "capture_start",
        error: "start session failed",
        microphonePermission: "authorized",
      }),
    ).toBe("recorder");
  });

  test("offers the permissions page for a missing microphone grant", () => {
    expect(describeStartFailure("microphone_permission").action?.tab).toBe(
      "permissions",
    );
  });
});

describe("describeStartFailure for a recorder failure", () => {
  const selectionHint =
    "Upshot couldn't open your audio input. Check your microphone selection, then try again.";

  beforeEach(() => {
    mocks.platform.mockReset();
    mocks.platform.mockReturnValue("macos");
  });

  // Fork: Windows can't tell Upshot that a microphone is blocked, so the
  // hint names the page that blocks it (Microsoft Support, "Turn on app
  // permissions for your microphone in Windows"; NN/g #9).
  test("points to the Microphone privacy page on Windows", () => {
    mocks.platform.mockReturnValue("windows");
    expect(describeStartFailure("recorder").description).toBe(
      "Upshot couldn't open your audio input. Check Windows Settings › Privacy & security › Microphone, then try again.",
    );
    expect(describeStartFailure("recorder").action?.tab).toBe("meetings");
  });

  test.each(["macos", "linux"])(
    "keeps the microphone selection hint on %s",
    (os) => {
      mocks.platform.mockReturnValue(os);
      expect(describeStartFailure("recorder").description).toBe(selectionHint);
    },
  );

  test("keeps the microphone selection hint outside the Tauri runtime", () => {
    mocks.platform.mockImplementationOnce(() => {
      throw new Error("no runtime");
    });
    expect(describeStartFailure("recorder").description).toBe(selectionHint);
  });
});
