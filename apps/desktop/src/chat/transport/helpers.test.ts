import { afterEach, describe, expect, it, vi } from "vitest";

import { describeChatStreamError } from "./helpers";

const OFFLINE_TEXT =
  "Upshot AI can't be reached. Check your internet connection, then click Retry.";

describe("describeChatStreamError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("explains a plain-string network failure without the Worker URL", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const text = describeChatStreamError(
      "error sending request for url (https://upshot.example.workers.dev/v1/chat/completions)",
    );
    expect(text).toBe(OFFLINE_TEXT);
    expect(text).not.toContain("workers.dev");
  });

  it("explains an Error network failure", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(describeChatStreamError(new TypeError("Load failed"))).toBe(
      OFFLINE_TEXT,
    );
    expect(describeChatStreamError(new Error("Request timed out"))).toBe(
      OFFLINE_TEXT,
    );
  });

  it("says offline whenever the Mac has no connection", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    expect(describeChatStreamError({ message: "anything" })).toBe(OFFLINE_TEXT);
  });

  it("keeps the plain message for other errors", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      describeChatStreamError(new Error("Upshot AI is busy. Try again.")),
    ).toBe("Upshot AI is busy. Try again.");
    expect(spy).toHaveBeenCalled();
    expect(describeChatStreamError({ message: "Bad model" })).toBe("Bad model");
    expect(describeChatStreamError({ code: 1 })).toBe('{"code":1}');
  });
});
