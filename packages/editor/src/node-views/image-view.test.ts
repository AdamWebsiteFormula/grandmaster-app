import { describe, expect, it, vi } from "vitest";

import { getDisplayImageSrc, listenForImageResize } from "./image-view";

describe("listenForImageResize", () => {
  it("releases every listener after pointer cancellation", () => {
    const onMove = vi.fn();
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    listenForImageResize({ onMove, onCommit, onCancel });

    window.dispatchEvent(new Event("pointermove"));
    window.dispatchEvent(new Event("pointercancel"));
    window.dispatchEvent(new Event("pointermove"));
    window.dispatchEvent(new Event("pointerup"));

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("returned cleanup releases listeners without committing", () => {
    const onMove = vi.fn();
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    const cleanup = listenForImageResize({ onMove, onCommit, onCancel });

    cleanup();
    window.dispatchEvent(new Event("pointermove"));
    window.dispatchEvent(new Event("pointerup"));

    expect(onMove).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe("getDisplayImageSrc", () => {
  it("keeps images stored on this Mac", () => {
    expect(getDisplayImageSrc("asset://localhost/Users/me/a.png")).toBe(
      "asset://localhost/Users/me/a.png",
    );
    expect(getDisplayImageSrc("data:image/png;base64,AAAA")).toBe(
      "data:image/png;base64,AAAA",
    );
  });

  it("never loads a remote image", () => {
    expect(
      getDisplayImageSrc("https://evil.example/?d=secret"),
    ).toBeUndefined();
    expect(getDisplayImageSrc("//evil.example/x.png")).toBeUndefined();
    expect(getDisplayImageSrc(null)).toBeUndefined();
  });
});
