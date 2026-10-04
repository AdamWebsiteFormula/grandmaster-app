import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  classifyStartFailure,
  describeStartFailure,
  ensureMicrophoneBeforeStart,
  getMicrophonePermission,
} from "./start-failure";

const mocks = vi.hoisted(() => ({
  platform: vi.fn(() => "macos"),
  checkPermission: vi.fn(),
  requestPermission: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-os", () => ({ platform: mocks.platform }));

vi.mock("@anlg/plugin-permissions", () => ({
  commands: {
    checkPermission: mocks.checkPermission,
    requestPermission: mocks.requestPermission,
  },
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

// Owner test, Oct 4: a recording started while macOS still asked for the
// microphone stayed silent after Allow.
describe("ensureMicrophoneBeforeStart", () => {
  beforeEach(() => {
    mocks.platform.mockReturnValue("macos");
    mocks.checkPermission.mockReset();
    mocks.requestPermission.mockReset();
    mocks.requestPermission.mockResolvedValue({ status: "ok", data: null });
  });

  test("starts at once when the microphone is allowed", async () => {
    mocks.checkPermission.mockResolvedValue({
      status: "ok",
      data: "authorized",
    });
    await expect(ensureMicrophoneBeforeStart()).resolves.toBe(true);
    expect(mocks.requestPermission).not.toHaveBeenCalled();
  });

  test("asks first, then starts after Allow", async () => {
    mocks.checkPermission
      .mockResolvedValueOnce({ status: "ok", data: "neverRequested" })
      .mockResolvedValueOnce({ status: "ok", data: "authorized" });
    await expect(ensureMicrophoneBeforeStart()).resolves.toBe(true);
    expect(mocks.requestPermission).toHaveBeenCalledWith("microphone");
  });

  test("does not start after Don't Allow", async () => {
    mocks.checkPermission
      .mockResolvedValueOnce({ status: "ok", data: "neverRequested" })
      .mockResolvedValueOnce({ status: "ok", data: "denied" });
    await expect(ensureMicrophoneBeforeStart()).resolves.toBe(false);
  });

  test("does not start when the microphone was turned off", async () => {
    mocks.checkPermission.mockResolvedValue({ status: "ok", data: "denied" });
    await expect(ensureMicrophoneBeforeStart()).resolves.toBe(false);
    expect(mocks.requestPermission).not.toHaveBeenCalled();
  });

  test("never blocks outside macOS", async () => {
    mocks.platform.mockReturnValue("windows");
    await expect(ensureMicrophoneBeforeStart()).resolves.toBe(true);
    expect(mocks.checkPermission).not.toHaveBeenCalled();
  });

  test("never blocks when the check fails", async () => {
    mocks.checkPermission.mockRejectedValue(new Error("no plugin"));
    await expect(ensureMicrophoneBeforeStart()).resolves.toBe(true);
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
