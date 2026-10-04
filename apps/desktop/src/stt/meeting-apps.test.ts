import { describe, expect, it } from "vitest";

import {
  getMeetingPlatformNameForMicApp,
  withUpshotLogo,
} from "./meeting-apps";

describe("meeting app platform names", () => {
  it("only promotes explicitly classified meeting apps", () => {
    expect(getMeetingPlatformNameForMicApp({ id: "zoom", name: "Zoom" })).toBe(
      "Zoom",
    );
    expect(
      getMeetingPlatformNameForMicApp({
        id: "com.apple.FaceTime",
        name: "FaceTime",
      }),
    ).toBeNull();
  });
});

// Owner test, Oct 4: the popup showed Chrome's icon, not the Upshot logo.
describe("meeting popup icon", () => {
  it("leads with the Upshot logo and badges the meeting app", () => {
    expect(
      withUpshotLogo({ type: "bundle_id", bundle_id: "com.google.Chrome" }),
    ).toEqual({
      type: "overlay",
      base: { type: "app_icon" },
      badge: { type: "bundle_id", bundle_id: "com.google.Chrome" },
    });
    expect(withUpshotLogo({ type: "path", path: "/tmp/meet.png" })).toEqual({
      type: "overlay",
      base: { type: "app_icon" },
      badge: { type: "path", path: "/tmp/meet.png" },
    });
  });

  it("leaves a hidden or badged icon as it is", () => {
    const hidden = { type: "hidden" } as const;
    const badged = {
      type: "overlay",
      base: { type: "app_icon" },
      badge: { type: "calendar" },
    } as const;
    expect(withUpshotLogo(hidden)).toBe(hidden);
    expect(withUpshotLogo(badged)).toBe(badged);
  });
});
