import { describe, expect, it, vi } from "vitest";

vi.mock("@anlg/plugin-local-stt", () => ({ commands: {}, events: {} }));
vi.mock("~/settings/queries", () => ({ setSettingValues: vi.fn() }));
vi.mock("~/shared/config", () => ({ useConfigValue: vi.fn() }));

import { pickTranscriptionModel } from "./transcription";

describe("pickTranscriptionModel", () => {
  it("prefers Apple Speech when this Mac supports it", () => {
    expect(
      pickTranscriptionModel(["soniqo-parakeet-streaming", "apple-speech"]),
    ).toMatchObject({ provider: "apple_speech", model: "apple-speech" });
  });

  it("falls back to Parakeet on Macs without Apple Speech", () => {
    expect(pickTranscriptionModel(["soniqo-parakeet-streaming"])).toMatchObject(
      { provider: "soniqo", model: "soniqo-parakeet-streaming" },
    );
  });

  it("returns null when no on-device engine is available", () => {
    expect(pickTranscriptionModel(["QuantizedTiny"])).toBeNull();
  });
});
