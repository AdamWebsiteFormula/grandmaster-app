// Fork: Upshot AI model choice, the Granola way. Everyone gets "Auto"; Pro
// picks a current model from OpenAI, Anthropic and Google in the chat
// composer (docs.granola.ai/help-center/getting-more-from-your-notes/understanding-model-selection-in-granola-chat).
// The saved model (config current_llm_model) is "Auto" or an OpenRouter slug,
// and goes to the Upshot AI Worker as `model`. Keep the slug rule in step
// with grandmaster/worker/src/index.js.
import type { CatalogEntry } from "~/settings/ai/shared/model-catalog";

export const UPSHOT_AUTO_MODEL = "Auto";
export const UPSHOT_MODEL_VENDORS = ["anthropic", "openai", "google"] as const;
const MAX_PER_VENDOR = 4;

const SLUG = /^[a-z0-9-]+\/[a-z0-9.-]+$/;

export function isUpshotModelSlug(value: unknown): value is string {
  return (
    typeof value === "string" &&
    SLUG.test(value) &&
    UPSHOT_MODEL_VENDORS.some((vendor) => value.startsWith(`${vendor}/`))
  );
}

/** "Auto" for anything that is not a model the Worker accepts. */
export function normalizeUpshotModel(value: unknown): string {
  return isUpshotModelSlug(value) ? value : UPSHOT_AUTO_MODEL;
}

// Not chat models, or aliases and open-weights side lines.
const NOT_CHAT =
  /(?:image|audio|tts|embed|search|realtime|transcribe|moderation|lyria|veo|imagen|gemma|codex|oss|latest|computer|deep-research|customtools)/;
// A dated snapshot ("gpt-4o-2024-11-20", "claude-opus-4-20250514", "-0613").
const DATED = /-(?:\d{4}-\d{2}-\d{2}|\d{8}|\d{4})$/;

// Model families per vendor, from the OpenRouter slugs on Oct 3, 2026.
// - anthropic: fable, opus, sonnet, haiku ("claude-opus-5.5").
// - openai: since GPT-5.6 the tiers are named: astra ($10 per 1M input),
//   sol ($2) and luna ($0.10), as in "gpt-6-astra". GPT-6 dropped terra,
//   so it is not a current family. Each tier has a "-pro" twin at the same
//   price (more reasoning, not a bigger model), dropped below like any
//   "-pro" whose base is listed.
// - google: pro, flash, flash-lite ("gemini-3.8-flash").
const FAMILIES: Record<(typeof UPSHOT_MODEL_VENDORS)[number], string[]> = {
  anthropic: ["fable", "opus", "sonnet", "haiku"],
  openai: ["astra", "sol", "luna"],
  google: ["pro", "flash", "flash-lite"],
};

/** The longest family named in the slug, so flash-lite is not flash. */
function familyOf(id: string, families: readonly string[]) {
  const name = `-${id.split("/")[1]}-`;
  return families
    .filter((family) => name.includes(`-${family}-`))
    .sort((a, b) => b.length - a.length)[0];
}

export type UpshotModelOption = { id: string; name: string };

/**
 * The menu list, rebuilt from the OpenRouter catalog each launch (cached for
 * 24 h, bundled list as fallback), so it is always this week's models.
 * Granola Business picks "standard and thinking models from OpenAI,
 * Anthropic and Google", Fable among them, so each family gets a row.
 *
 * Rule, per vendor (anthropic/, openai/, google/):
 * 1. Keep text chat models: no ":free", ":batch" or other ":" copies, no
 *    deprecated models, nothing whose slug says image, audio, embedding,
 *    search and the like, no "-pro" variant when its base model is listed,
 *    and no dated snapshot when its undated alias is listed.
 * 2. Per family (FAMILIES), the newest by `created`. A preview only stands
 *    in when the family has no other model ("gemini-3.1-pro-preview").
 * 3. Most capable first, with price per 1M input tokens as the proxy
 *    (Fable $10, Opus $4, Sonnet $2, Haiku $1). At most 4 per vendor.
 * Names come from the catalog `name` ("Claude Sonnet 5.5").
 * Every pick supports reasoning in the catalog, so no "Thinking" tag: it
 * would tell nothing apart.
 */
export function pickUpshotModels(
  entries: readonly CatalogEntry[] | undefined,
): UpshotModelOption[] {
  if (!entries) return [];
  const ids = new Set(entries.map((entry) => entry.id));
  const usable = entries
    .filter(
      (entry) =>
        isUpshotModelSlug(entry.id) &&
        !entry.id.includes(":") &&
        !entry.deprecated &&
        !NOT_CHAT.test(entry.id) &&
        !(entry.id.endsWith("-pro") && ids.has(entry.id.slice(0, -4))) &&
        !(DATED.test(entry.id) && ids.has(entry.id.replace(DATED, ""))),
    )
    .sort(
      (a, b) =>
        Number(a.preview ?? false) - Number(b.preview ?? false) ||
        (b.releasedAt ?? "").localeCompare(a.releasedAt ?? "") ||
        a.id.localeCompare(b.id),
    );

  const picked: CatalogEntry[] = [];
  for (const vendor of UPSHOT_MODEL_VENDORS) {
    const families = FAMILIES[vendor];
    const own = usable.filter((entry) => entry.id.startsWith(`${vendor}/`));
    // Newest per family; ties on price keep the FAMILIES order.
    const heads = families.flatMap((family) => {
      const head = own.find((entry) => familyOf(entry.id, families) === family);
      return head ? [head] : [];
    });
    heads.sort((a, b) => (b.priceIn ?? 0) - (a.priceIn ?? 0));
    picked.push(...heads.slice(0, MAX_PER_VENDOR));
  }

  return picked.map((entry) => ({
    id: entry.id,
    name: entry.name?.trim() || entry.id.split("/")[1],
  }));
}
