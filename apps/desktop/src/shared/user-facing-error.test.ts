import { describe, expect, it } from "vitest";

import { UserFacingError, userFacingMessage } from "./user-facing-error";

describe("userFacingMessage", () => {
  it("shows our own words as they are", () => {
    expect(
      userFacingMessage(new UserFacingError("No speech detected."), "Fallback"),
    ).toBe("No speech detected.");
  });

  it("hides raw system text behind the plain line", () => {
    expect(
      userFacingMessage(new Error("503 Service Unavailable"), "Try again."),
    ).toBe("Try again.");
    expect(userFacingMessage("invoke failed: os error 2", "Try again.")).toBe(
      "Try again.",
    );
  });
});
