import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { copyTextToClipboard, markdownToClipboardHtml } from "./header-shared";

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@anlg/ui/components/ui/toast", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

function readBlob(blob: Blob) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });
}

class FakeClipboardItem {
  constructor(public items: Record<string, Blob>) {}
}

describe("markdownToClipboardHtml", () => {
  it("renders headings, lists and emphasis as HTML", () => {
    const html = markdownToClipboardHtml(
      "# Plan\n\n- **Ship** the build\n- Test it",
    );

    expect(html).toContain("<h1>Plan</h1>");
    expect(html).toContain("<ul");
    expect(html).toContain("<strong>Ship</strong>");
    expect(html).toContain("Test it");
  });

  it("returns null for empty notes", () => {
    expect(markdownToClipboardHtml("  ")).toBeNull();
  });
});

describe("copyTextToClipboard", () => {
  const write = vi.fn();
  const writeText = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("ClipboardItem", FakeClipboardItem);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { write, writeText },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writes text/html next to text/plain when asked", async () => {
    write.mockResolvedValue(undefined);

    await copyTextToClipboard("# Plan", undefined, { html: true });

    const item = write.mock.calls[0][0][0] as FakeClipboardItem;
    expect(Object.keys(item.items)).toEqual(
      expect.arrayContaining(["text/plain", "text/html"]),
    );
    expect(await readBlob(item.items["text/plain"])).toBe("# Plan");
    expect(await readBlob(item.items["text/html"])).toContain("<h1>Plan</h1>");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("drops text/markdown when the clipboard rejects it, keeping HTML", async () => {
    write
      .mockRejectedValueOnce(new Error("NotAllowedError"))
      .mockResolvedValueOnce(undefined);

    await copyTextToClipboard("# Plan", undefined, { html: true });

    const item = write.mock.calls[1][0][0] as FakeClipboardItem;
    expect(Object.keys(item.items).sort()).toEqual(["text/html", "text/plain"]);
  });

  it("falls back to plain text when rich types fail", async () => {
    write.mockRejectedValue(new Error("NotAllowedError"));
    writeText.mockResolvedValue(undefined);

    const copied = await copyTextToClipboard(
      "# Plan",
      { success: "Notes copied to clipboard", error: "No" },
      { html: true },
    );

    expect(copied).toBe(true);
    expect(writeText).toHaveBeenCalledWith("# Plan");
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Notes copied to clipboard",
    );
  });

  it("does not add HTML for plain copies such as the transcript", async () => {
    write.mockResolvedValue(undefined);

    await copyTextToClipboard("Ada: hello");

    const item = write.mock.calls[0][0][0] as FakeClipboardItem;
    expect(item.items["text/html"]).toBeUndefined();
  });
});
