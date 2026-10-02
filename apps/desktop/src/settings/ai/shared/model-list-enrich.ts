// Joins a provider's live model list with the model catalog: names, release
// dates, New/Thinking/Preview flags, price tier, context window, the
// release-date "old model" rule and newest-first order. Also builds the
// "Offline list" when the provider cannot be reached.
import {
  isDateSnapshot,
  isNonChatModel,
  isNonStreamingModel,
  type ListModelsResult,
  type ModelMetadata,
  shouldIgnoreCommonKeywords,
} from "./list-common";
import {
  type CatalogEntry,
  catalogProviderFor,
  deriveFamily,
  findCatalogEntry,
  isNewModel,
  isOldByRelease,
  isPreviewId,
  type ModelRegistry,
  priceTier,
} from "./model-catalog";
import { getRegistry } from "./model-registry";

type EnrichOptions = { registry?: ModelRegistry; now?: number };

const definedOnly = (meta: ModelMetadata): ModelMetadata =>
  Object.fromEntries(
    Object.entries(meta).filter(([, value]) => value !== undefined),
  ) as ModelMetadata;

function mergeMetadata(
  id: string,
  provider: ModelMetadata | undefined,
  catalog: CatalogEntry | undefined,
  now: number,
): ModelMetadata {
  // The provider's own date and deprecation flag beat the catalog.
  const releasedAt = provider?.releasedAt ?? catalog?.releasedAt;
  return definedOnly({
    ...provider,
    displayName: catalog?.name ?? provider?.displayName,
    family: deriveFamily(id),
    releasedAt,
    isNew: isNewModel(releasedAt, now) || undefined,
    thinking: provider?.thinking ?? catalog?.thinking,
    preview: provider?.preview || catalog?.preview || isPreviewId(id) || undefined,
    deprecated: provider?.deprecated || catalog?.deprecated || undefined,
    contextWindow: provider?.contextWindow ?? catalog?.contextWindow,
    priceTier: provider?.priceTier ?? priceTier(catalog?.priceIn),
  });
}

/** Newest first; previews after stable models; unknown dates last, in the
 * order the provider list already had. */
export function sortByRelease(
  models: readonly string[],
  metadata: Record<string, ModelMetadata>,
): string[] {
  const position = new Map(models.map((id, i) => [id, i]));
  return [...models].sort((a, b) => {
    const ma = metadata[a] ?? {};
    const mb = metadata[b] ?? {};
    const preview = Number(!!ma.preview) - Number(!!mb.preview);
    if (preview !== 0) return preview;
    const date = (mb.releasedAt ?? "").localeCompare(ma.releasedAt ?? "");
    if (date !== 0) return date;
    return position.get(a)! - position.get(b)!;
  });
}

function applyCatalog(
  catalogProvider: string,
  result: ListModelsResult,
  registry: ModelRegistry,
  now: number,
): ListModelsResult {
  const metadata: Record<string, ModelMetadata> = { ...result.metadata };
  const allIds = [...result.models, ...result.ignored.map(({ id }) => id)];
  for (const id of allIds) {
    metadata[id] = mergeMetadata(
      id,
      result.metadata[id],
      findCatalogEntry(registry, catalogProvider, id)?.entry,
      now,
    );
  }

  // Family heads among the models this account can actually use.
  const usable = [
    ...result.models,
    ...result.ignored
      .filter(({ reasons }) => reasons.every((r) => r === "old_model"))
      .map(({ id }) => id),
  ];
  const heads = new Map<string, string>();
  for (const id of usable) {
    const meta = metadata[id];
    if (!meta?.releasedAt || meta.deprecated) continue;
    const head = heads.get(meta.family!);
    if (!head || meta.releasedAt > head) heads.set(meta.family!, meta.releasedAt);
  }
  const isOld = (id: string) =>
    isOldByRelease(metadata[id] ?? {}, heads.get(metadata[id]?.family ?? ""), now);

  const models: string[] = [];
  const ignored = [];
  for (const id of result.models) {
    if (isOld(id) === true) {
      ignored.push({ id, reasons: ["old_model" as const] });
    } else {
      models.push(id);
    }
  }
  for (const item of result.ignored) {
    const onlyOld = item.reasons.every((r) => r === "old_model");
    if (onlyOld && isOld(item.id) === false) {
      models.push(item.id);
    } else {
      ignored.push(item);
    }
  }

  return {
    ...result,
    models: sortByRelease(models, metadata),
    ignored,
    metadata,
    source: result.source ?? "live",
  };
}

/** The catalog's models for a provider, shaped like a live result. */
export function catalogResult(
  providerId: string,
  options: EnrichOptions = {},
): ListModelsResult {
  const catalogProvider = catalogProviderFor(providerId);
  const registry = options.registry ?? getRegistry();
  const entries = catalogProvider
    ? (registry.providers[catalogProvider] ?? [])
    : [];

  const models: string[] = [];
  const ignored: ListModelsResult["ignored"] = [];
  const metadata: Record<string, ModelMetadata> = {};
  for (const entry of entries) {
    if (isNonStreamingModel(entry.id)) continue;
    metadata[entry.id] = {
      input_modalities: entry.vision ? ["text", "image"] : ["text"],
    };
    if (shouldIgnoreCommonKeywords(entry.id)) {
      ignored.push({ id: entry.id, reasons: ["common_keyword"] });
    } else if (isNonChatModel(entry.id)) {
      ignored.push({ id: entry.id, reasons: ["not_chat_model"] });
    } else if (isDateSnapshot(entry.id)) {
      ignored.push({ id: entry.id, reasons: ["date_snapshot"] });
    } else if (entry.deprecated) {
      ignored.push({ id: entry.id, reasons: ["old_model"] });
    } else {
      models.push(entry.id);
    }
  }

  return { models, ignored, metadata, source: "offline" };
}

/**
 * Enrich a provider's model list with the catalog. Providers without a
 * catalog (local servers, Custom) pass through unchanged. When the provider
 * returned nothing (offline, timeout), the catalog list stands in.
 */
export function enrichResult(
  providerId: string,
  result: ListModelsResult,
  options: EnrichOptions = {},
): ListModelsResult {
  const catalogProvider = catalogProviderFor(providerId);
  if (!catalogProvider) return result;
  const registry = options.registry ?? getRegistry();
  const now = options.now ?? Date.now();

  const unreachable = result.models.length === 0 && result.ignored.length === 0;
  const base = unreachable
    ? catalogResult(providerId, { registry, now })
    : result;
  if (base.models.length === 0 && base.ignored.length === 0) return result;

  return applyCatalog(catalogProvider, base, registry, now);
}

export type ModelOptionGroups = {
  primary: string[]; // newest model of each family
  more: string[]; // older versions, under "More models"
  previews: string[]; // behind "Show previews"
};

/** One row per family, older versions under "More models", previews apart.
 * Models without a family (local servers) each get their own row. */
export function groupModelOptions(
  models: readonly string[],
  metadata: Record<string, ModelMetadata>,
): ModelOptionGroups {
  const groups: ModelOptionGroups = { primary: [], more: [], previews: [] };
  const seen = new Set<string>();
  for (const id of models) {
    const meta = metadata[id];
    if (meta?.preview) {
      groups.previews.push(id);
      continue;
    }
    const family = meta?.family ?? id;
    if (seen.has(family)) {
      groups.more.push(id);
    } else {
      seen.add(family);
      groups.primary.push(id);
    }
  }
  return groups;
}

/**
 * If the saved model is gone from a live provider list, return the newest
 * model in its family (stable before preview). null when the model still
 * exists, the list is offline or empty, or the family has no successor.
 */
export function resolveVanishedModel(
  providerId: string,
  savedModel: string | undefined,
  result: ListModelsResult | undefined,
): string | null {
  if (!savedModel || !result || !catalogProviderFor(providerId)) return null;
  if (result.source === "offline" || result.models.length === 0) return null;
  if (result.models.includes(savedModel)) return null;
  if (result.ignored.some(({ id }) => id === savedModel)) return null;

  const family = deriveFamily(savedModel);
  const candidates = result.models.filter(
    (id) => (result.metadata[id]?.family ?? deriveFamily(id)) === family,
  );
  return (
    candidates.find((id) => !result.metadata[id]?.preview) ??
    candidates[0] ??
    null
  );
}
