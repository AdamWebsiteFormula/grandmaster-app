import { describe, expect, it } from "vitest";

import {
  isUpshotModelSlug,
  normalizeUpshotModel,
  pickUpshotModels,
} from "./upshot-models";

import fallback from "~/settings/ai/shared/models.fallback.json";

describe("Upshot AI models", () => {
  it("accepts only OpenAI, Anthropic and Google slugs", () => {
    expect(isUpshotModelSlug("anthropic/claude-sonnet-5.5")).toBe(true);
    expect(isUpshotModelSlug("google/gemini-3.8-flash")).toBe(true);
    expect(isUpshotModelSlug("meta/llama-5")).toBe(false);
    expect(isUpshotModelSlug("openai/GPT-6")).toBe(false);
    expect(isUpshotModelSlug("openai/gpt-6:free")).toBe(false);
    expect(isUpshotModelSlug("Auto")).toBe(false);
    expect(normalizeUpshotModel("claude-sonnet-5.5")).toBe("Auto");
    expect(normalizeUpshotModel(undefined)).toBe("Auto");
    expect(normalizeUpshotModel("openai/gpt-6.1-sol")).toBe(
      "openai/gpt-6.1-sol",
    );
  });

  it("shows the newest model of each family, most capable first", () => {
    const picked = pickUpshotModels([
      {
        id: "anthropic/claude-sonnet-5.5",
        name: "Claude Sonnet 5.5",
        releasedAt: "2026-09-28",
        priceIn: 2,
      },
      {
        id: "anthropic/claude-sonnet-5.5:batch",
        name: "Claude Sonnet 5.5 (batch)",
        releasedAt: "2026-09-28",
        priceIn: 1,
      },
      {
        id: "anthropic/claude-opus-5.5",
        name: "Claude Opus 5.5",
        releasedAt: "2026-09-22",
        priceIn: 4,
      },
      {
        id: "anthropic/claude-opus-5",
        name: "Claude Opus 5",
        releasedAt: "2026-07-24",
        priceIn: 5,
      },
      {
        id: "anthropic/claude-fable-5.1",
        name: "Claude Fable 5.1",
        releasedAt: "2026-09-01",
        priceIn: 10,
      },
      {
        id: "anthropic/claude-fable-5",
        name: "Claude Fable 5",
        releasedAt: "2026-06-09",
        priceIn: 10,
      },
      {
        id: "anthropic/claude-haiku-4.5",
        name: "Claude Haiku 4.5",
        releasedAt: "2025-10-15",
        priceIn: 1,
      },
      {
        id: "openai/gpt-6.1-sol",
        name: "GPT-6.1 Sol",
        releasedAt: "2026-09-29",
        priceIn: 2,
      },
      {
        id: "openai/gpt-6.1-sol-pro",
        name: "GPT-6.1 Sol Pro",
        releasedAt: "2026-09-29",
        priceIn: 2,
      },
      {
        id: "openai/gpt-6-astra",
        name: "GPT-6 Astra",
        releasedAt: "2026-09-04",
        priceIn: 10,
      },
      {
        id: "openai/gpt-6-luna",
        name: "GPT-6 Luna",
        releasedAt: "2026-09-22",
        priceIn: 0.1,
      },
      {
        id: "openai/gpt-5.5-pro",
        name: "GPT-5.5 Pro",
        releasedAt: "2026-04-24",
        priceIn: 30,
      },
      {
        id: "google/gemini-3.8-flash",
        name: "Gemini 3.8 Flash",
        releasedAt: "2026-09-02",
        priceIn: 0.75,
      },
      {
        id: "google/gemini-3.9-flash-image",
        name: "Nano Banana 3",
        releasedAt: "2026-09-30",
        priceIn: 0.5,
      },
      {
        id: "google/gemini-3.5-flash-lite",
        name: "Gemini 3.5 Flash Lite",
        releasedAt: "2026-07-21",
        priceIn: 0.3,
      },
      {
        id: "google/gemma-5:free",
        name: "Gemma 5 (free)",
        releasedAt: "2026-09-30",
      },
      { id: "meta/llama-5", name: "Llama 5", releasedAt: "2026-09-30" },
    ]);
    expect(picked).toEqual([
      { id: "anthropic/claude-fable-5.1", name: "Claude Fable 5.1" },
      { id: "anthropic/claude-opus-5.5", name: "Claude Opus 5.5" },
      { id: "anthropic/claude-sonnet-5.5", name: "Claude Sonnet 5.5" },
      { id: "anthropic/claude-haiku-4.5", name: "Claude Haiku 4.5" },
      { id: "openai/gpt-6-astra", name: "GPT-6 Astra" },
      { id: "openai/gpt-6.1-sol", name: "GPT-6.1 Sol" },
      { id: "openai/gpt-6-luna", name: "GPT-6 Luna" },
      { id: "google/gemini-3.8-flash", name: "Gemini 3.8 Flash" },
      { id: "google/gemini-3.5-flash-lite", name: "Gemini 3.5 Flash Lite" },
    ]);
  });

  it("uses a preview only when its family has nothing else", () => {
    const pro = (id: string, releasedAt: string, preview?: boolean) => ({
      id,
      name: id,
      releasedAt,
      priceIn: 2,
      preview,
    });
    expect(
      pickUpshotModels([
        pro("google/gemini-3.1-pro-preview", "2026-02-19", true),
        pro("google/gemini-2.5-pro-preview", "2025-06-05", true),
      ]).map((model) => model.id),
    ).toEqual(["google/gemini-3.1-pro-preview"]);
    expect(
      pickUpshotModels([
        pro("google/gemini-3.1-pro-preview", "2026-02-19", true),
        pro("google/gemini-3-pro", "2025-12-01"),
      ]).map((model) => model.id),
    ).toEqual(["google/gemini-3-pro"]);
  });

  it("prefers the undated alias over a dated snapshot", () => {
    expect(
      pickUpshotModels([
        { id: "anthropic/claude-opus-5.5-20260922", releasedAt: "2026-09-23" },
        { id: "anthropic/claude-opus-5.5", releasedAt: "2026-09-22" },
      ]).map((model) => model.id),
    ).toEqual(["anthropic/claude-opus-5.5"]);
  });

  it("builds the same list as live OpenRouter from the bundled fallback", () => {
    // Live https://openrouter.ai/api/v1/models gave this list on Oct 3, 2026.
    // The bundled list marks the Gemini 2.5 models OpenRouter retires.
    const picked = pickUpshotModels(fallback.providers.openrouter);
    expect(picked.map((model) => model.id)).toEqual([
      "anthropic/claude-fable-5.1",
      "anthropic/claude-opus-5.5",
      "anthropic/claude-sonnet-5.5",
      "anthropic/claude-haiku-4.5",
      "openai/gpt-6-astra",
      "openai/gpt-6.1-sol",
      "openai/gpt-6-luna",
      "google/gemini-3.1-pro-preview",
      "google/gemini-3.8-flash",
      "google/gemini-3.5-flash-lite",
    ]);
    expect(picked.every((model) => isUpshotModelSlug(model.id))).toBe(true);
  });
});
