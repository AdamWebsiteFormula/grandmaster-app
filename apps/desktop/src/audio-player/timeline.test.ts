import { describe, expect, it, vi } from "vitest";

vi.mock("./provider", () => ({
  useAudioPlayer: vi.fn(),
  useAudioTime: vi.fn(),
}));

import { formatTime } from "./timeline";

// Fork tests: journey-meeting P3 (meetings over an hour).
describe("formatTime", () => {
  it("keeps mm:ss under an hour", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(125)).toBe("02:05");
    expect(formatTime(3599)).toBe("59:59");
  });

  it("shows h:mm:ss past an hour", () => {
    expect(formatTime(3600)).toBe("1:00:00");
    expect(formatTime(4512.7)).toBe("1:15:12");
  });

  it("shows 00:00 before the length is known", () => {
    expect(formatTime(Number.NaN)).toBe("00:00");
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe("00:00");
  });
});
