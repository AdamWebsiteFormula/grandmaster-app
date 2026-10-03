import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { isOldModel, type ListModelsResult } from "./list-common";
import {
  deriveFamily,
  isNewModel,
  type ModelRegistry,
  normalizeModelsDev,
  normalizeOpenRouter,
} from "./model-catalog";
import {
  catalogResult,
  enrichResult,
  groupModelOptions,
  resolveVanishedModel,
} from "./model-list-enrich";
import {
  BUNDLED_REGISTRY,
  getRegistry,
  REGISTRY_CACHE_KEY,
  refreshRegistry,
  setRegistryForTesting,
} from "./model-registry";

const NOW = Date.parse("2026-10-02T12:00:00Z");

const registry: ModelRegistry = {
  fetchedAt: "2026-10-02T10:00:00.000Z",
  catalogSource: "models.dev",
  fallbackVersion: "2026-10-02",
  providers: {
    anthropic: [
      {
        id: "claude-sonnet-5-5",
        name: "Claude Sonnet 5.5",
        releasedAt: "2026-09-28",
        contextWindow: 1_000_000,
        priceIn: 2,
        thinking: true,
      },
      {
        id: "claude-opus-5-5",
        name: "Claude Opus 5.5",
        releasedAt: "2026-09-22",
        priceIn: 4,
        thinking: true,
      },
      { id: "claude-opus-5", name: "Claude Opus 5", releasedAt: "2026-07-24" },
      {
        id: "claude-sonnet-5",
        name: "Claude Sonnet 5",
        releasedAt: "2026-06-29",
      },
      {
        id: "claude-opus-4-9",
        name: "Claude Opus 4.9",
        releasedAt: "2026-08-30",
      },
      {
        id: "claude-sonnet-4-5",
        name: "Claude Sonnet 4.5",
        releasedAt: "2025-09-29",
      },
      {
        id: "claude-haiku-4-5",
        name: "Claude Haiku 4.5",
        releasedAt: "2025-10-15",
      },
      { id: "claude-2-1", releasedAt: "2023-11-21", deprecated: true },
    ],
    google: [
      {
        id: "gemini-3.8-flash",
        name: "Gemini 3.8 Flash",
        releasedAt: "2026-09-02",
      },
      {
        id: "gemini-3.1-pro-preview",
        name: "Gemini 3.1 Pro Preview",
        releasedAt: "2026-02-19",
        preview: true,
      },
    ],
  },
};

beforeEach(() => setRegistryForTesting(registry));
afterEach(() => {
  setRegistryForTesting(null);
  vi.useRealTimers();
  localStorage.clear();
});

describe("catalog parsing", () => {
  test("normalizes models.dev and drops non-text generators", () => {
    const providers = normalizeModelsDev({
      anthropic: {
        models: {
          "claude-sonnet-5-5": {
            id: "claude-sonnet-5-5",
            name: "Claude Sonnet 5.5 (latest)",
            release_date: "2026-09-28",
            reasoning: true,
            limit: { context: 1000000 },
            cost: { input: 2 },
            modalities: { input: ["text", "image"], output: ["text"] },
          },
          "claude-old": {
            id: "claude-old",
            release_date: "2024-01",
            status: "deprecated",
          },
          "img-1": { id: "img-1", modalities: { output: ["image"] } },
          broken: "not a model",
        },
      },
      mistral: {
        models: {
          "mistral-large-2512": {
            id: "mistral-large-2512",
            release_date: "2024-11-01",
          },
        },
      },
      unknown: { models: { x: { id: "x" } } },
    });

    expect(providers.anthropic).toEqual([
      {
        id: "claude-sonnet-5-5",
        name: "Claude Sonnet 5.5",
        releasedAt: "2026-09-28",
        contextWindow: 1000000,
        priceIn: 2,
        thinking: true,
        vision: true,
      },
      { id: "claude-old", releasedAt: "2024-01-01", deprecated: true },
    ]);
    // The yymm stamp beats a wrong catalog date.
    expect(providers.mistral?.[0]?.releasedAt).toBe("2025-12-01");
    expect(providers.unknown).toBeUndefined();
    expect(normalizeModelsDev("garbage")).toEqual({});
  });

  test("normalizes the OpenRouter backup", () => {
    expect(
      normalizeOpenRouter({
        data: [
          {
            id: "openai/gpt-6.1-sol",
            name: "OpenAI: GPT-6.1 Sol",
            created: 1790683200,
            context_length: 1050000,
            pricing: { prompt: "0.000002" },
            supported_parameters: ["tools", "reasoning"],
            expiration_date: null,
          },
          {
            id: "old/model",
            created: 1600000000,
            expiration_date: "2026-10-30",
          },
        ],
      }),
    ).toEqual([
      {
        id: "openai/gpt-6.1-sol",
        name: "GPT-6.1 Sol",
        releasedAt: "2026-09-29",
        contextWindow: 1050000,
        priceIn: 2,
        thinking: true,
      },
      { id: "old/model", releasedAt: "2020-09-13", deprecated: true },
    ]);
  });
});

describe("families and flags", () => {
  test("collapses versions and dated snapshots into one family", () => {
    expect(deriveFamily("claude-sonnet-5-5")).toBe("claude-sonnet");
    expect(deriveFamily("claude-haiku-4-5-20251001")).toBe("claude-haiku");
    expect(deriveFamily("gpt-6.1-sol")).toBe("gpt-sol");
    expect(deriveFamily("gemini-3.8-flash")).toBe("gemini-flash");
    expect(deriveFamily("gemini-3.1-pro-preview")).toBe("gemini-pro");
    expect(deriveFamily("gemini-3.5-flash-lite")).toBe("gemini-flash-lite");
    expect(deriveFamily("mistral-medium-2604")).toBe("mistral-medium");
    expect(deriveFamily("qwen3.8-max")).toBe("qwen-max");
    expect(deriveFamily("anthropic/claude-sonnet-5.5")).toBe(
      "anthropic/claude-sonnet",
    );
  });

  test("New means released within 30 days", () => {
    expect(isNewModel("2026-09-28", NOW)).toBe(true);
    expect(isNewModel("2026-09-03", NOW)).toBe(true);
    expect(isNewModel("2026-08-30", NOW)).toBe(false);
    expect(isNewModel(undefined, NOW)).toBe(false);
  });

  test("isOldModel uses release date and deprecation before the regex", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    // The regex would hide claude-opus-4-9; it is recent, so it stays.
    expect(isOldModel("claude-opus-4-9")).toBe(false);
    // Superseded and over six months old.
    expect(isOldModel("claude-sonnet-4-5")).toBe(true);
    // Old but still the newest Haiku: not hidden.
    expect(isOldModel("claude-haiku-4-5")).toBe(false);
    expect(isOldModel("claude-2-1")).toBe(true);
    // Unknown to the catalog: regex fallback.
    expect(isOldModel("gpt-4o")).toBe(true);
  });
});

describe("enrichResult", () => {
  const live: ListModelsResult = {
    models: [
      "claude-sonnet-5",
      "claude-opus-5",
      "claude-opus-5-5",
      "claude-sonnet-5-5",
      "claude-haiku-4-5",
    ],
    ignored: [
      { id: "claude-opus-4-9", reasons: ["old_model"] },
      { id: "claude-sonnet-4-5", reasons: ["old_model"] },
    ],
    metadata: {
      // Provider dates win over the catalog.
      "claude-opus-5": {
        input_modalities: ["text", "image"],
        releasedAt: "2026-07-25",
      },
    },
  };

  test("merges catalog data and sorts newest first", () => {
    const result = enrichResult("anthropic", live, { now: NOW });

    // claude-opus-4-9 comes back from "old": it was released a month ago.
    expect(result.models).toEqual([
      "claude-sonnet-5-5",
      "claude-opus-5-5",
      "claude-opus-4-9",
      "claude-opus-5",
      "claude-sonnet-5",
      "claude-haiku-4-5",
    ]);
    expect(result.ignored).toEqual([
      { id: "claude-sonnet-4-5", reasons: ["old_model"] },
    ]);
    expect(result.source).toBe("live");
    expect(result.metadata["claude-sonnet-5-5"]).toMatchObject({
      displayName: "Claude Sonnet 5.5",
      family: "claude-sonnet",
      isNew: true,
      thinking: true,
      contextWindow: 1_000_000,
      priceTier: "$$",
    });
    expect(result.metadata["claude-opus-5"]).toMatchObject({
      releasedAt: "2026-07-25",
      input_modalities: ["text", "image"],
    });
    expect(result.metadata["claude-opus-5"]?.isNew).toBeUndefined();
  });

  test("leaves providers without a catalog untouched", () => {
    const local: ListModelsResult = {
      models: ["llama3.2"],
      ignored: [],
      metadata: {},
    };
    expect(enrichResult("ollama", local, { now: NOW })).toBe(local);
  });

  test("falls back to the catalog as the Offline list when the provider is unreachable", () => {
    const result = enrichResult(
      "google_generative_ai",
      { models: [], ignored: [], metadata: {} },
      { now: NOW },
    );
    expect(result.source).toBe("offline");
    // Previews sort after stable models.
    expect(result.models).toEqual([
      "gemini-3.8-flash",
      "gemini-3.1-pro-preview",
    ]);
    expect(result.metadata["gemini-3.1-pro-preview"]?.preview).toBe(true);
  });

  test("the bundled fallback shows this week's models as New", () => {
    const sonnet = catalogResult("anthropic", { registry: BUNDLED_REGISTRY });
    expect(sonnet.models).toContain("claude-sonnet-5-5");
    const anthropic = enrichResult(
      "anthropic",
      { models: [], ignored: [], metadata: {} },
      { registry: BUNDLED_REGISTRY, now: NOW },
    );
    expect(anthropic.models[0]).toBe("claude-sonnet-5-5");
    expect(anthropic.metadata["claude-sonnet-5-5"]?.isNew).toBe(true);

    const openai = enrichResult(
      "openai",
      { models: [], ignored: [], metadata: {} },
      { registry: BUNDLED_REGISTRY, now: NOW },
    );
    expect(openai.models[0]).toBe("gpt-6.1-sol");
    expect(openai.metadata["gpt-6.1-sol"]).toMatchObject({
      isNew: true,
      displayName: "GPT-6.1 Sol",
    });
  });
});

describe("groupModelOptions", () => {
  test("one row per family, older versions under More models, previews apart", () => {
    const result = enrichResult(
      "anthropic",
      {
        models: [
          "claude-opus-5",
          "claude-sonnet-5-5",
          "claude-opus-5-5",
          "claude-sonnet-5",
          "gemini-x-preview",
        ],
        ignored: [],
        metadata: {},
      },
      { now: NOW },
    );
    expect(groupModelOptions(result.models, result.metadata)).toEqual({
      primary: ["claude-sonnet-5-5", "claude-opus-5-5"],
      more: ["claude-opus-5", "claude-sonnet-5"],
      previews: ["gemini-x-preview"],
    });
  });

  test("local models without a family each get a row", () => {
    expect(groupModelOptions(["a", "b"], {})).toEqual({
      primary: ["a", "b"],
      more: [],
      previews: [],
    });
  });
});

describe("resolveVanishedModel", () => {
  const result = enrichResult(
    "anthropic",
    {
      models: ["claude-sonnet-5-5", "claude-opus-5-5", "claude-sonnet-5"],
      ignored: [],
      metadata: {},
    },
    { now: NOW },
  );

  test("switches a vanished model to the newest in its family", () => {
    expect(resolveVanishedModel("anthropic", "claude-sonnet-4-6", result)).toBe(
      "claude-sonnet-5-5",
    );
    expect(resolveVanishedModel("anthropic", "claude-opus-4-8", result)).toBe(
      "claude-opus-5-5",
    );
  });

  test("keeps models that still exist, unknown families and offline lists", () => {
    expect(
      resolveVanishedModel("anthropic", "claude-sonnet-5", result),
    ).toBeNull();
    expect(
      resolveVanishedModel("anthropic", "claude-fable-5", result),
    ).toBeNull();
    expect(
      resolveVanishedModel("anthropic", "claude-sonnet-4-6", {
        ...result,
        source: "offline",
      }),
    ).toBeNull();
    expect(
      resolveVanishedModel("anthropic", "claude-sonnet-4-6", {
        models: [],
        ignored: [],
        metadata: {},
      }),
    ).toBeNull();
    expect(resolveVanishedModel("ollama", "llama3", result)).toBeNull();
  });

  test("keeps a routing variant whose base model is still listed", () => {
    expect(
      resolveVanishedModel("anthropic", "claude-sonnet-5-5:online", result),
    ).toBeNull();
    expect(
      resolveVanishedModel("anthropic", "claude-sonnet-5:nitro", result),
    ).toBeNull();
  });
});

describe("refreshRegistry", () => {
  const stale: ModelRegistry = {
    ...registry,
    fetchedAt: "2026-09-01T00:00:00.000Z",
  };
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  const modelsDev = {
    openai: {
      models: {
        "gpt-6.1-sol": { id: "gpt-6.1-sol", release_date: "2026-09-29" },
      },
    },
  };

  test("skips the fetch when the cache is under 24 h old", async () => {
    setRegistryForTesting({ ...registry, fetchedAt: new Date().toISOString() });
    const fetchImpl = vi.fn();
    await expect(refreshRegistry({ fetchImpl })).resolves.toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("stores a fresh models.dev catalog and caches it", async () => {
    setRegistryForTesting(stale);
    const fetchImpl = vi.fn(async () =>
      json(modelsDev),
    ) as unknown as typeof fetch;
    await expect(refreshRegistry({ fetchImpl })).resolves.toBe(true);
    expect(getRegistry().catalogSource).toBe("models.dev");
    expect(getRegistry().providers.openai?.[0]?.id).toBe("gpt-6.1-sol");
    expect(
      JSON.parse(localStorage.getItem(REGISTRY_CACHE_KEY)!).catalogSource,
    ).toBe("models.dev");
  });

  test("uses OpenRouter when models.dev fails, keeping other providers", async () => {
    setRegistryForTesting(stale);
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes("models.dev")
        ? new Response("down", { status: 503 })
        : json({ data: [{ id: "openai/gpt-6.1-sol", created: 1790683200 }] }),
    ) as unknown as typeof fetch;
    await expect(refreshRegistry({ fetchImpl })).resolves.toBe(true);
    expect(getRegistry().catalogSource).toBe("openrouter");
    expect(getRegistry().providers.openrouter?.[0]?.id).toBe(
      "openai/gpt-6.1-sol",
    );
    expect(getRegistry().providers.anthropic).toEqual(
      registry.providers.anthropic,
    );
  });

  test("keeps the current list when every source fails", async () => {
    setRegistryForTesting(stale);
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    await expect(refreshRegistry({ fetchImpl, force: true })).resolves.toBe(
      false,
    );
    expect(getRegistry()).toBe(stale);
  });
});
