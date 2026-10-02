import { describe, expect, it } from "vitest";

import { isSafeImageSrc, stripRemoteMarkdownImages } from "./safe-image";

describe("isSafeImageSrc", () => {
  it.each([
    "data:image/png;base64,AAAA",
    "blob:http://localhost/123",
    "asset://localhost/Users/me/a.png",
    "http://asset.localhost/Users/me/a.png",
    "attachments/a.png",
  ])("allows local %s", (src) => {
    expect(isSafeImageSrc(src)).toBe(true);
  });

  it.each([
    "https://evil.example/x.png?q=secret",
    "http://evil.example/x.png",
    "//evil.example/x.png",
    "HTTPS://EVIL.EXAMPLE/x.png",
    "",
    undefined,
  ])("blocks remote or empty %s", (src) => {
    expect(isSafeImageSrc(src)).toBe(false);
  });
});

describe("stripRemoteMarkdownImages", () => {
  it("drops remote images and keeps their alt text", () => {
    expect(
      stripRemoteMarkdownImages(
        'Plan ![chart](https://evil.example/c.png?d=pricing+is+%2410 "t") done',
      ),
    ).toBe("Plan chart done");
  });

  it("keeps local images and normal links", () => {
    const text =
      "![a](asset://localhost/a.png) and [docs](https://example.com/page)";
    expect(stripRemoteMarkdownImages(text)).toBe(text);
  });
});
