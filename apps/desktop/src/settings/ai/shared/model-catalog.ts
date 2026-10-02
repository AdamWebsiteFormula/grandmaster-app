// Pure helpers for the model catalog (models.dev api.json, OpenRouter backup,
// bundled models.fallback.json). No runtime imports beyond model-id, so the
// fallback updater script can run this file under tsx.
import { modelName } from "./model-id";

export type CatalogSource = "models.dev" | "openrouter" | "bundled";

export type CatalogEntry = {
  id: string;
  name?: string;
  releasedAt?: string; // YYYY-MM-DD
  contextWindow?: number;
  priceIn?: number; // USD per 1M input tokens
  thinking?: boolean;
  preview?: boolean;
  deprecated?: boolean;
  vision?: boolean;
};

export type ModelRegistry = {
  fetchedAt: string | null; // null for the bundled list
  catalogSource: CatalogSource;
  fallbackVersion: string;
  providers: Record<string, CatalogEntry[]>; // keyed by models.dev provider id
};

export const NEW_MODEL_DAYS = 30;
// A model counts as old once a newer one exists in its family and it is
// more than this many days old. Deprecated models are always old.
export const OLD_MODEL_DAYS = 183;

const DAY_MS = 24 * 60 * 60 * 1000;

// App provider id -> models.dev provider id. Local providers (Ollama,
// LM Studio, Unsloth, Apple Intelligence) and Custom have no catalog.
export const CATALOG_PROVIDER: Record<string, string> = {
  anthropic: "anthropic",
  claude: "anthropic",
  openai: "openai",
  chatgpt: "openai",
  azure_openai: "azure",
  azure_ai: "azure",
  google_generative_ai: "google",
  google_vertex_ai: "google-vertex",
  openrouter: "openrouter",
  mistral: "mistral",
  xai: "xai",
  grok: "xai",
  groq: "groq",
  deepseek: "deepseek",
  moonshot: "moonshotai",
  kimi_code: "moonshotai",
  zai: "zai",
  alibaba_cloud: "alibaba",
  siliconflow: "siliconflow",
  amazon_bedrock: "amazon-bedrock",
  together: "togetherai",
  cohere: "cohere",
  fireworks: "fireworks-ai",
  cloudflare_workers_ai: "cloudflare-workers-ai",
  cerebras: "cerebras",
  meta: "meta",
  venice: "venice",
  github_copilot: "github-copilot",
};

// Lookups without a provider only use first-party catalogs, in this order.
// Hosts (Groq, OpenRouter, Bedrock...) list other vendors' models under
// their own dates and families.
const FIRST_PARTY = [
  "anthropic",
  "openai",
  "google",
  "xai",
  "mistral",
  "deepseek",
  "moonshotai",
  "zai",
  "cohere",
  "alibaba",
  "meta",
];

export const CATALOG_PROVIDER_IDS = Array.from(
  new Set(Object.values(CATALOG_PROVIDER)),
).sort();

export const catalogProviderFor = (providerId: string): string | undefined =>
  CATALOG_PROVIDER[providerId];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asDate = (value: unknown): string | undefined => {
  if (typeof value === "string" && /^\d{4}-\d{2}(-\d{2})?/.test(value)) {
    const date = value.slice(0, 10);
    return date.length === 7 ? `${date}-01` : date;
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    // Unix seconds (OpenAI, OpenRouter) or milliseconds.
    const ms = value < 1e12 ? value * 1000 : value;
    return new Date(ms).toISOString().slice(0, 10);
  }
  return undefined;
};

export const toReleaseDate = asDate;

const asPositiveNumber = (value: unknown): number | undefined => {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : undefined;
};

// Mistral-style yymm stamps (mistral-large-2512) date a model even when
// the catalog's release_date is wrong.
const stampDate = (id: string): string | undefined => {
  const match = modelName(id).match(/-(2[3-9]|3\d)(0[1-9]|1[0-2])$/);
  return match ? `20${match[1]}-${match[2]}-01` : undefined;
};

const releaseDateFor = (id: string, value: unknown): string | undefined => {
  const date = asDate(value);
  const stamp = stampDate(id);
  if (!date) return stamp;
  return stamp && stamp > date ? stamp : date;
};

export const isPreviewId = (id: string): boolean =>
  /(?:^|[-_.:/])(?:preview|exp|experimental|beta|alpha)(?:$|[-_.:/\d])/i.test(
    modelName(id),
  );

const compact = (entry: CatalogEntry): CatalogEntry => {
  const out: CatalogEntry = { id: entry.id };
  for (const [key, value] of Object.entries(entry)) {
    if (value !== undefined && value !== false && key !== "id") {
      (out as Record<string, unknown>)[key] = value;
    }
  }
  return out;
};

const cleanName = (name: unknown): string | undefined =>
  typeof name === "string" && name.trim()
    ? name.replace(/\s*\(latest\)\s*$/i, "").trim()
    : undefined;

function normalizeModelsDevModel(
  key: string,
  raw: unknown,
): CatalogEntry | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id : key;
  const modalities = isRecord(raw.modalities) ? raw.modalities : {};
  const output = Array.isArray(modalities.output) ? modalities.output : null;
  // Image, video and speech generators are never chat models.
  if (output && !output.includes("text")) return null;
  const input = Array.isArray(modalities.input) ? modalities.input : [];
  const limit = isRecord(raw.limit) ? raw.limit : {};
  const cost = isRecord(raw.cost) ? raw.cost : {};

  return compact({
    id,
    name: cleanName(raw.name),
    releasedAt: releaseDateFor(id, raw.release_date),
    contextWindow: asPositiveNumber(limit.context) || undefined,
    priceIn: asPositiveNumber(cost.input),
    thinking: raw.reasoning === true,
    preview:
      raw.status === "beta" || raw.experimental === true || isPreviewId(id),
    deprecated: raw.status === "deprecated",
    vision: input.includes("image"),
  });
}

/** models.dev api.json -> entries per catalog provider. Tolerant: unknown
 * shapes are skipped, never thrown. */
export function normalizeModelsDev(
  json: unknown,
  providerIds: readonly string[] = CATALOG_PROVIDER_IDS,
): Record<string, CatalogEntry[]> {
  const providers: Record<string, CatalogEntry[]> = {};
  if (!isRecord(json)) return providers;

  for (const providerId of providerIds) {
    const provider = json[providerId];
    if (!isRecord(provider) || !isRecord(provider.models)) continue;
    const entries = Object.entries(provider.models)
      .map(([key, raw]) => normalizeModelsDevModel(key, raw))
      .filter((entry): entry is CatalogEntry => entry !== null)
      .sort(compareEntries);
    if (entries.length > 0) providers[providerId] = entries;
  }

  return providers;
}

/** OpenRouter /api/v1/models -> entries for the "openrouter" catalog. */
export function normalizeOpenRouter(json: unknown): CatalogEntry[] {
  if (!isRecord(json) || !Array.isArray(json.data)) return [];
  const entries: CatalogEntry[] = [];
  for (const raw of json.data) {
    if (!isRecord(raw) || typeof raw.id !== "string") continue;
    const architecture = isRecord(raw.architecture) ? raw.architecture : {};
    const output = Array.isArray(architecture.output_modalities)
      ? architecture.output_modalities
      : null;
    if (output && !output.includes("text")) continue;
    const input = Array.isArray(architecture.input_modalities)
      ? architecture.input_modalities
      : [];
    const pricing = isRecord(raw.pricing) ? raw.pricing : {};
    const perToken = asPositiveNumber(pricing.prompt);
    const params = Array.isArray(raw.supported_parameters)
      ? raw.supported_parameters
      : [];
    entries.push(
      compact({
        id: raw.id,
        name:
          typeof raw.name === "string"
            ? raw.name.replace(/^[^:]+:\s*/, "")
            : undefined,
        releasedAt: asDate(raw.created),
        contextWindow: asPositiveNumber(raw.context_length) || undefined,
        priceIn:
          perToken === undefined
            ? undefined
            : Math.round(perToken * 1e6 * 1000) / 1000,
        thinking: params.includes("reasoning"),
        preview: isPreviewId(raw.id),
        deprecated: Boolean(raw.expiration_date),
        vision: input.includes("image"),
      }),
    );
  }
  return entries.sort(compareEntries);
}

function compareEntries(a: CatalogEntry, b: CatalogEntry): number {
  const date = (b.releasedAt ?? "").localeCompare(a.releasedAt ?? "");
  return date !== 0 ? date : a.id.localeCompare(b.id);
}

/** Lowercase, drop "models/", treat dots and dashes alike. */
export const normalizeModelKey = (id: string): string =>
  id
    .trim()
    .toLowerCase()
    .replace(/^models\//, "")
    .replace(/\./g, "-");

/**
 * Family for "one row per family": strip dates, version numbers and
 * "latest", keep the tier words. claude-sonnet-5-5 -> claude-sonnet,
 * gpt-6.1-sol -> gpt-sol, gemini-3.8-flash -> gemini-flash. A vendor
 * prefix (OpenRouter "anthropic/") is kept so vendors never merge.
 */
export function deriveFamily(id: string): string {
  const lower = id
    .trim()
    .toLowerCase()
    .replace(/^models\//, "");
  const slash = lower.lastIndexOf("/");
  const vendor = slash >= 0 ? lower.slice(0, slash + 1) : "";
  const name = modelName(lower)
    .replace(/:.*$/, "")
    .replace(/-\d{4}-\d{2}-\d{2}$/, "")
    .replace(/-\d{2}-20\d{2}$/, "")
    .replace(/-20\d{6}$/, "");

  const tokens = name
    .split("-")
    .filter((token) => token.length > 0)
    // Aliases and release stages are not part of the family.
    .filter(
      (token) =>
        !/^(?:latest|preview|exp|experimental|beta|alpha)$/.test(token),
    )
    // Pure versions and 4-digit date stamps (2604, 0309).
    .filter((token) => !/^v?\d+(?:\.\d+)*$/.test(token))
    // qwen3.8 -> qwen, k2.7 -> k. Sizes like 70b keep their digits.
    .map((token) => token.replace(/^([a-z]+)\d+(?:\.\d+)*$/, "$1"));

  return vendor + (tokens.length > 0 ? tokens.join("-") : name);
}

export const isNewModel = (
  releasedAt: string | undefined,
  now: number,
): boolean => {
  if (!releasedAt) return false;
  const released = Date.parse(releasedAt);
  if (!Number.isFinite(released)) return false;
  const age = now - released;
  return age >= -DAY_MS && age <= NEW_MODEL_DAYS * DAY_MS;
};

export const priceTier = (priceIn: number | undefined): string | undefined => {
  if (priceIn === undefined) return undefined;
  if (priceIn === 0) return "Free";
  if (priceIn <= 0.5) return "$";
  if (priceIn <= 3) return "$$";
  if (priceIn <= 10) return "$$$";
  return "$$$$";
};

export const formatContextWindow = (
  tokens: number | undefined,
): string | undefined => {
  if (!tokens) return undefined;
  if (tokens >= 1_000_000) {
    const m = Math.round((tokens / 1_000_000) * 10) / 10;
    return `${m}M context`;
  }
  return `${Math.round(tokens / 1000)}K context`;
};

/**
 * Release-date + deprecation rule. true: deprecated, or superseded in its
 * family and older than OLD_MODEL_DAYS. false: released within
 * OLD_MODEL_DAYS. undefined: no date, or an older family head; the
 * caller's own rule decides.
 */
export function isOldByRelease(
  entry: { releasedAt?: string; deprecated?: boolean },
  familyHeadReleasedAt: string | undefined,
  now: number,
): boolean | undefined {
  if (entry.deprecated) return true;
  if (!entry.releasedAt) return undefined;
  const released = Date.parse(entry.releasedAt);
  if (!Number.isFinite(released)) return undefined;
  if (now - released <= OLD_MODEL_DAYS * DAY_MS) return false;
  const superseded =
    familyHeadReleasedAt !== undefined &&
    familyHeadReleasedAt > entry.releasedAt;
  return superseded ? true : undefined;
}

type IndexHit = { provider: string; entry: CatalogEntry };
type RegistryIndex = {
  byProvider: Map<string, Map<string, CatalogEntry>>;
  global: Map<string, IndexHit>;
  familyHeads: Map<string, string>; // `${provider} ${family}` -> date
};

const indexCache = new WeakMap<ModelRegistry, RegistryIndex>();

function buildIndex(registry: ModelRegistry): RegistryIndex {
  const cached = indexCache.get(registry);
  if (cached) return cached;

  const byProvider = new Map<string, Map<string, CatalogEntry>>();
  const global = new Map<string, IndexHit>();
  const familyHeads = new Map<string, string>();
  for (const provider of Object.keys(registry.providers)) {
    const map = new Map<string, CatalogEntry>();
    for (const entry of registry.providers[provider] ?? []) {
      map.set(entry.id, entry);
      const key = normalizeModelKey(entry.id);
      if (!map.has(key)) map.set(key, entry);
      const bare = normalizeModelKey(modelName(entry.id));
      if (!map.has(`bare:${bare}`)) map.set(`bare:${bare}`, entry);

      if (!entry.deprecated && entry.releasedAt) {
        const familyKey = `${provider} ${deriveFamily(entry.id)}`;
        const head = familyHeads.get(familyKey);
        if (!head || entry.releasedAt > head) {
          familyHeads.set(familyKey, entry.releasedAt);
        }
      }
    }
    byProvider.set(provider, map);
  }

  for (const provider of FIRST_PARTY) {
    for (const entry of registry.providers[provider] ?? []) {
      const bare = normalizeModelKey(modelName(entry.id));
      if (!global.has(bare)) global.set(bare, { provider, entry });
    }
  }

  const index = { byProvider, global, familyHeads };
  indexCache.set(registry, index);
  return index;
}

/** Look up a model, first in its provider's catalog, then anywhere. */
export function findCatalogEntry(
  registry: ModelRegistry,
  catalogProvider: string | undefined,
  id: string,
): IndexHit | undefined {
  const index = buildIndex(registry);
  const bare = normalizeModelKey(modelName(id));
  if (catalogProvider) {
    const map = index.byProvider.get(catalogProvider);
    const entry =
      map?.get(id) ??
      map?.get(normalizeModelKey(id)) ??
      map?.get(`bare:${bare}`);
    if (entry) return { provider: catalogProvider, entry };
  }
  return index.global.get(bare);
}

/** Release-date + deprecation verdict for an id with no provider context.
 * undefined when the catalog does not know the id or its date. */
export function catalogOldVerdict(
  registry: ModelRegistry,
  id: string,
  now: number,
): boolean | undefined {
  const hit = findCatalogEntry(registry, undefined, id);
  if (!hit) return undefined;
  const head = buildIndex(registry).familyHeads.get(
    `${hit.provider} ${deriveFamily(hit.entry.id)}`,
  );
  return isOldByRelease(hit.entry, head, now);
}
