import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getStoredSettingValues: vi.fn(),
  play: vi.fn(),
}));

vi.mock("cuelume", () => ({
  play: mocks.play,
}));

vi.mock("~/settings/queries", () => ({
  getStoredSettingValues: mocks.getStoredSettingValues,
}));

import { playCompletionSound } from "./completion-sound";

function stored(values: Record<string, boolean | string> = {}) {
  return {
    values,
    hasValues: new Set(Object.keys(values)),
  };
}

// Fork: Upshot is silent; no completion sound plays, whatever is stored.
describe("completion sounds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStoredSettingValues.mockResolvedValue(stored());
  });

  it.each<Record<string, boolean | string>>([
    {},
    { notification_completion_sound: true },
    {
      notification_completion_sound: true,
      notification_completion_sound_name: "sparkle",
    },
  ])("never plays a sound", async (values) => {
    mocks.getStoredSettingValues.mockResolvedValue(stored(values));

    await expect(playCompletionSound()).resolves.toBeUndefined();

    expect(mocks.play).not.toHaveBeenCalled();
    expect(mocks.getStoredSettingValues).not.toHaveBeenCalled();
  });
});
