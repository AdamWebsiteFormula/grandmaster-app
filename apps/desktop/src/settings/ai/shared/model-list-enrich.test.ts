import { describe, expect, it } from "vitest";

import { enrichResult, getRecommendedModel } from "./model-list-enrich";

describe("getRecommendedModel", () => {
  it.each([
    "openrouter",
    "venice",
    "groq",
    "cerebras",
    "siliconflow",
    "mistral",
    "cohere",
  ])("leaves the model to the picker for %s", (providerId) => {
    expect(getRecommendedModel(providerId)).toBeNull();
  });

  it("still recommends a first-party model", () => {
    expect(getRecommendedModel("anthropic")).toMatch(/^claude-sonnet/);
    expect(getRecommendedModel("openai")).toBeTruthy();
  });
});

describe("enrichResult", () => {
  it("does not fill an empty Azure list with catalog model names", () => {
    const empty = { models: [], ignored: [], metadata: {} };
    expect(enrichResult("azure_openai", empty).models).toEqual([]);
    expect(enrichResult("azure_ai", empty).models).toEqual([]);
  });
});
