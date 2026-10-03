import { describe, expect, test, vi } from "vitest";

import {
  getDefaultLlmSelection,
  getPreferredProviderModel,
  isSameModelSelection,
  ProviderStateSettlingError,
  shouldShowMissingModelWarning,
} from "./selection";

describe("isSameModelSelection", () => {
  test("matches only when both provider and model match", () => {
    expect(isSameModelSelection("openai", "gpt-5.5", "openai", "gpt-5.5")).toBe(
      true,
    );
    expect(isSameModelSelection("openai", "gpt-5.5", "openai", "gpt-5")).toBe(
      false,
    );
    expect(
      isSameModelSelection("openai", "gpt-5.5", "anthropic", "gpt-5.5"),
    ).toBe(false);
  });
});

describe("getPreferredProviderModel", () => {
  test("returns the remembered model when it is still available", () => {
    expect(
      getPreferredProviderModel("claude-3-7-sonnet", [
        "claude-3-5-sonnet",
        "claude-3-7-sonnet",
      ]),
    ).toBe("claude-3-7-sonnet");
  });

  test("falls back to the first available model when none is remembered", () => {
    expect(getPreferredProviderModel(undefined, ["gpt-4.1", "gpt-4o"])).toBe(
      "gpt-4.1",
    );
  });

  test("falls back to the first available model when the remembered model is gone", () => {
    expect(
      getPreferredProviderModel("claude-3-opus", [
        "claude-3-5-sonnet",
        "claude-3-7-sonnet",
      ]),
    ).toBe("claude-3-5-sonnet");
  });

  test("clears the selection when a provider has no selectable models", () => {
    expect(getPreferredProviderModel("gpt-4.1", [])).toBe("");
  });

  test("keeps the remembered value when the provider does not expose a static list", () => {
    expect(
      getPreferredProviderModel("my-custom-model", [], {
        allowSavedModelWithoutChoices: true,
      }),
    ).toBe("my-custom-model");
  });
});

describe("getDefaultLlmSelection", () => {
  test("keeps the active provider and repairs its missing model", async () => {
    const selection = await getDefaultLlmSelection(
      ["openai", "anthropic"],
      "openai",
      undefined,
      async (provider) =>
        provider === "openai" ? ["gpt-5.5"] : ["claude-sonnet-4-5"],
    );

    expect(selection).toEqual({ provider: "openai", model: "gpt-5.5" });
  });

  test("skips providers whose models cannot be loaded", async () => {
    const selection = await getDefaultLlmSelection(
      ["openai", "anthropic"],
      undefined,
      undefined,
      async (provider) => {
        if (provider === "openai") {
          throw new Error("invalid key");
        }

        return ["claude-sonnet-4-5"];
      },
    );

    expect(selection).toEqual({
      provider: "anthropic",
      model: "claude-sonnet-4-5",
    });
  });

  // Live test, Oct 2: a first Anthropic key switched the provider, then the
  // provider state caught up a moment later. In between, Anthropic looked
  // unconfigured, so this fell through to Apple Intelligence and saved it.
  test("waits instead of replacing a chosen provider the UI has not caught up with", async () => {
    const loadModels = vi.fn(async () => ["System Language Model"]);

    await expect(
      getDefaultLlmSelection(
        ["apple_foundation"],
        "anthropic",
        "",
        loadModels,
        {
          hasSavedConfig: async (provider) => provider === "anthropic",
        },
      ),
    ).rejects.toBeInstanceOf(ProviderStateSettlingError);
    expect(loadModels).not.toHaveBeenCalled();
  });

  test("still falls back when the chosen provider has no saved config", async () => {
    const selection = await getDefaultLlmSelection(
      ["apple_foundation", "openai"],
      "anthropic",
      "",
      async (provider) =>
        provider === "openai" ? ["gpt-5.5"] : ["System Language Model"],
      { hasSavedConfig: async () => false },
    );

    expect(selection).toEqual({ provider: "openai", model: "gpt-5.5" });
  });

  test("never auto-selects apple_foundation on a fresh install", async () => {
    const loadModels = vi.fn(async () => ["System Language Model"]);
    const selection = await getDefaultLlmSelection(
      ["apple_foundation"],
      undefined,
      undefined,
      loadModels,
    );

    expect(selection).toBeNull();
    expect(loadModels).not.toHaveBeenCalled();
  });

  test("never falls back to apple_foundation when another provider fails", async () => {
    const selection = await getDefaultLlmSelection(
      ["openai", "apple_foundation"],
      undefined,
      undefined,
      async (provider) => {
        if (provider === "openai") throw new Error("invalid key");
        return ["System Language Model"];
      },
    );

    expect(selection).toBeNull();
  });

  test("keeps apple_foundation when the user chose it", async () => {
    const selection = await getDefaultLlmSelection(
      ["apple_foundation", "openai"],
      "apple_foundation",
      undefined,
      async (provider) =>
        provider === "openai" ? ["gpt-5.5"] : ["System Language Model"],
    );

    expect(selection).toEqual({
      provider: "apple_foundation",
      model: "System Language Model",
    });
  });

  test("returns no selection when no configured provider has models", async () => {
    const selection = await getDefaultLlmSelection(
      ["openai"],
      undefined,
      undefined,
      async () => [],
    );

    expect(selection).toBeNull();
  });
});

describe("shouldShowMissingModelWarning", () => {
  test("stays quiet while a provider selection is resolving", () => {
    expect(
      shouldShowMissingModelWarning({
        isConfigured: false,
        isResolvingSelection: true,
        providerSettingsReady: true,
        settingsReady: true,
      }),
    ).toBe(false);
  });

  test("stays quiet until application settings are loaded", () => {
    expect(
      shouldShowMissingModelWarning({
        isConfigured: false,
        isResolvingSelection: false,
        providerSettingsReady: true,
        settingsReady: false,
      }),
    ).toBe(false);
  });

  test("warns when the settled selection has no model", () => {
    expect(
      shouldShowMissingModelWarning({
        isConfigured: false,
        isResolvingSelection: false,
        providerSettingsReady: true,
        settingsReady: true,
      }),
    ).toBe(true);
  });
});
