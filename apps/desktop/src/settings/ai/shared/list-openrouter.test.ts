import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { processOpenRouterModels } from "./list-openrouter";
import { EMPTY_REGISTRY, setRegistryForTesting } from "./model-registry";

// These upstream tests cover the name-based fallback used for ids the model
// catalog does not know; catalog rules are tested in model-registry.test.ts.
beforeEach(() => setRegistryForTesting(EMPTY_REGISTRY));
afterEach(() => setRegistryForTesting(null));

describe("processOpenRouterModels", () => {
  test("keeps current provider-prefixed dated models", () => {
    expect(
      processOpenRouterModels([
        {
          id: "anthropic/claude-sonnet-5",
          supported_parameters: ["tools", "tool_choice"],
          architecture: { input_modalities: ["text", "image"] },
        },
        {
          id: "mistralai/mistral-large-2512",
          supported_parameters: ["tools", "tool_choice"],
          architecture: { input_modalities: ["text"] },
        },
        {
          id: "anthropic/claude-haiku-4-5-20251001",
          supported_parameters: ["tools", "tool_choice"],
          architecture: { input_modalities: ["text", "image"] },
        },
        {
          id: "mistralai/mistral-large-2508",
          supported_parameters: ["tools", "tool_choice"],
          architecture: { input_modalities: ["text"] },
        },
      ]),
    ).toEqual({
      models: [
        "anthropic/claude-sonnet-5",
        "anthropic/claude-haiku-4-5-20251001",
        "mistralai/mistral-large-2512",
      ],
      ignored: [{ id: "mistralai/mistral-large-2508", reasons: ["old_model"] }],
      metadata: {
        "anthropic/claude-haiku-4-5-20251001": {
          input_modalities: ["text", "image"],
        },
        "anthropic/claude-sonnet-5": { input_modalities: ["text", "image"] },
        "mistralai/mistral-large-2512": { input_modalities: ["text"] },
        "mistralai/mistral-large-2508": { input_modalities: ["text"] },
      },
    });
  });
});
