import { describe, expect, it } from "vitest";

import { detectMeetingImportProviders } from "./providers";

describe("meeting import providers", () => {
  it("detects exact native names and bundle identifiers", () => {
    const providers = detectMeetingImportProviders([
      { id: "com.granola.app", name: "Granola" },
      { id: "ai.plaud.desktop.plaud", name: "Plaud Desktop" },
      { id: "com.microsoft.teams2", name: "Microsoft Teams" },
      { id: "com.openvisionengineering.pocket-desktop-app", name: "Pocket" },
    ]);

    expect(providers.map((provider) => provider.id)).toEqual([
      "granola",
      "plaud",
      "pocket",
    ]);
    expect(providers.map((provider) => provider.installedAppId)).toEqual([
      "com.granola.app",
      "ai.plaud.desktop.plaud",
      "com.openvisionengineering.pocket-desktop-app",
    ]);
  });

  it("detects Plaud and Pocket desktop apps from Windows display names", () => {
    const providers = detectMeetingImportProviders([
      { id: "windows:hklm:Plaud Desktop", name: "Plaud Desktop" },
      { id: "windows:hkcu:Pocket", name: "Pocket Desktop" },
    ]);

    expect(providers.map((provider) => provider.id)).toEqual([
      "plaud",
      "pocket",
    ]);
  });

  it("does not treat Pocket Casts as Pocket", () => {
    expect(
      detectMeetingImportProviders([
        { id: "com.electron.pocket-casts", name: "Pocket Casts" },
      ]).map((provider) => provider.id),
    ).toEqual([]);
  });

  it("does not accept bundle identifier prefixes", () => {
    expect(
      detectMeetingImportProviders([
        { id: "com.granola.app.helper", name: "Something Else" },
      ]).map((provider) => provider.id),
    ).toEqual([]);
  });

  it("does not infer extension-only products from a browser", () => {
    expect(
      detectMeetingImportProviders([
        { id: "com.google.Chrome", name: "Google Chrome" },
      ]).map((provider) => provider.id),
    ).toEqual([]);
  });

  it("hides imports that need the upstream cloud (Nango OAuth)", () => {
    const providers = detectMeetingImportProviders([
      { id: "com.granola.app", name: "Granola" },
      { id: "notion.id", name: "Notion" },
      { id: "us.zoom.xos", name: "zoom.us" },
      { id: "com.microsoft.teams2", name: "Microsoft Teams" },
      { id: "com.cisco.webex", name: "Webex" },
      { id: "Fathom", name: "Fathom" },
      { id: "com.openai.chat", name: "ChatGPT" },
    ]);

    expect(providers.map((provider) => provider.id)).toEqual([
      "granola",
      "chatgpt-record",
    ]);
  });
});
