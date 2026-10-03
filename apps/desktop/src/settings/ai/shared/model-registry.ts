// Model registry: models.dev catalog cached in localStorage, refreshed at
// launch when older than 24 h, with OpenRouter as the backup source and the
// bundled models.fallback.json ("Offline list") as the last resort.
// Keyless. Calls go through the Tauri HTTP plugin, never the webview.
import {
  CATALOG_PROVIDER_IDS,
  type CatalogEntry,
  type ModelRegistry,
  normalizeModelsDev,
  normalizeOpenRouter,
} from "./model-catalog";
import fallbackJson from "./models.fallback.json";

import { providerFetch } from "~/ai/provider-fetch";

export const MODELS_DEV_URL = "https://models.dev/api.json";
export const OPENROUTER_MODELS_URL =
  "https://openrouter.ai/api/v1/models?sort=newest";
export const REGISTRY_CACHE_KEY = "model-registry-v1";
export const REGISTRY_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const FETCH_TIMEOUT_MS = 20_000;
const MAX_CATALOG_BYTES = 32 * 1024 * 1024;

export type RegistryState = {
  registry: ModelRegistry;
  refreshing: boolean;
  lastError: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function parseRegistry(value: unknown): ModelRegistry | null {
  if (!isRecord(value) || !isRecord(value.providers)) return null;
  const source = value.catalogSource;
  if (
    source !== "models.dev" &&
    source !== "openrouter" &&
    source !== "bundled"
  )
    return null;
  const providers: Record<string, CatalogEntry[]> = {};
  for (const [id, list] of Object.entries(value.providers)) {
    if (!Array.isArray(list)) continue;
    providers[id] = list.filter(
      (entry): entry is CatalogEntry =>
        isRecord(entry) && typeof entry.id === "string",
    );
  }
  return {
    fetchedAt: typeof value.fetchedAt === "string" ? value.fetchedAt : null,
    catalogSource: source,
    fallbackVersion:
      typeof value.fallbackVersion === "string" ? value.fallbackVersion : "",
    providers,
  };
}

export const BUNDLED_REGISTRY: ModelRegistry = parseRegistry(fallbackJson) ?? {
  fetchedAt: null,
  catalogSource: "bundled",
  fallbackVersion: "",
  providers: {},
};

function readCache(): ModelRegistry | null {
  try {
    const raw = globalThis.localStorage?.getItem(REGISTRY_CACHE_KEY);
    if (!raw) return null;
    const cached = parseRegistry(JSON.parse(raw));
    if (!cached?.fetchedAt) return null;
    // A newer app build ships a newer bundle than an old cache.
    if (cached.fetchedAt.slice(0, 10) < BUNDLED_REGISTRY.fallbackVersion) {
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

function writeCache(registry: ModelRegistry) {
  try {
    globalThis.localStorage?.setItem(
      REGISTRY_CACHE_KEY,
      JSON.stringify(registry),
    );
  } catch {
    // Storage full or blocked: the in-memory copy still works.
  }
}

let state: RegistryState = {
  registry: readCache() ?? BUNDLED_REGISTRY,
  refreshing: false,
  lastError: null,
};
const listeners = new Set<() => void>();
let inflight: Promise<boolean> | null = null;

function setState(next: Partial<RegistryState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export const getRegistryState = (): RegistryState => state;
export const getRegistry = (): ModelRegistry => state.registry;

export function subscribeRegistry(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isRegistryStale(
  registry: ModelRegistry,
  now: number = Date.now(),
): boolean {
  if (!registry.fetchedAt) return true;
  const fetched = Date.parse(registry.fetchedAt);
  return !Number.isFinite(fetched) || now - fetched > REGISTRY_MAX_AGE_MS;
}

async function fetchCatalogJson(
  url: string,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const length = Number(response.headers.get("content-length"));
    if (Number.isFinite(length) && length > MAX_CATALOG_BYTES) {
      throw new Error("Catalog too large");
    }
    const text = await response.text();
    if (text.length > MAX_CATALOG_BYTES) throw new Error("Catalog too large");
    return JSON.parse(text) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch a fresh catalog. Primary models.dev, backup OpenRouter (merged
 * over the current list). Never throws; returns null on failure. */
export async function fetchRegistry(
  current: ModelRegistry,
  fetchImpl: typeof fetch = providerFetch,
  now: number = Date.now(),
): Promise<ModelRegistry | null> {
  const fetchedAt = new Date(now).toISOString();
  try {
    const providers = normalizeModelsDev(
      await fetchCatalogJson(MODELS_DEV_URL, fetchImpl),
      CATALOG_PROVIDER_IDS,
    );
    if (Object.keys(providers).length > 0) {
      // Fork: the Upshot AI chat menu lists OpenRouter slugs, so take them
      // from OpenRouter itself when it answers (ai/upshot-models.ts).
      try {
        const openrouter = normalizeOpenRouter(
          await fetchCatalogJson(OPENROUTER_MODELS_URL, fetchImpl),
        );
        if (openrouter.length > 0) providers.openrouter = openrouter;
      } catch {
        // Keep the models.dev copy of the OpenRouter list.
      }
      return {
        fetchedAt,
        catalogSource: "models.dev",
        fallbackVersion: BUNDLED_REGISTRY.fallbackVersion,
        providers,
      };
    }
  } catch {
    // Fall through to the backup.
  }

  try {
    const openrouter = normalizeOpenRouter(
      await fetchCatalogJson(OPENROUTER_MODELS_URL, fetchImpl),
    );
    if (openrouter.length > 0) {
      return {
        fetchedAt,
        catalogSource: "openrouter",
        fallbackVersion: BUNDLED_REGISTRY.fallbackVersion,
        providers: { ...current.providers, openrouter },
      };
    }
  } catch {
    // Keep the current list.
  }

  return null;
}

/**
 * Refresh the registry when it is older than 24 h (or always, with force).
 * Resolves true when a new catalog was stored. Never throws.
 */
export function refreshRegistry(
  options: { force?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<boolean> {
  if (!options.force && !isRegistryStale(state.registry)) {
    return Promise.resolve(false);
  }
  if (inflight) return inflight;

  setState({ refreshing: true });
  inflight = fetchRegistry(state.registry, options.fetchImpl)
    .then((fresh) => {
      if (!fresh) {
        setState({
          refreshing: false,
          lastError: "Could not reach models.dev",
        });
        return false;
      }
      writeCache(fresh);
      setState({ registry: fresh, refreshing: false, lastError: null });
      return true;
    })
    .catch(() => {
      setState({ refreshing: false, lastError: "Could not reach models.dev" });
      return false;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export const EMPTY_REGISTRY: ModelRegistry = {
  fetchedAt: null,
  catalogSource: "bundled",
  fallbackVersion: "",
  providers: {},
};

/** Test hook: replace the in-memory registry (null restores the default). */
export function setRegistryForTesting(registry: ModelRegistry | null) {
  inflight = null;
  setState({
    registry: registry ?? readCache() ?? BUNDLED_REGISTRY,
    refreshing: false,
    lastError: null,
  });
}
