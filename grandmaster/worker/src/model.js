// Upshot AI model choice. Free is "Auto"; Pro picks a model in the chat
// composer, as in Granola (docs.granola.ai/help-center/getting-more-from-your-notes/understanding-model-selection-in-granola-chat).
// Kept apart from index.js so test.mjs can load it with plain Node.

import { getUser } from "./auth.js";
import { isProStatus, rowForUser } from "./billing.js";

// The one model "Auto" uses. Change here; the app never chooses it.
// Sonnet 5.5 at medium effort: same Artificial Analysis index as Gemini 3.8
// Flash (41) with a 1.2 s first token instead of 19 s, and the fewest wrong
// answers of its peers on AA-Omniscience (artificialanalysis.ai, Oct 3, 2026).
// Anthropic: "For chat and other latency-sensitive work, start with medium or
// low" (platform.claude.com/docs/en/build-with-claude/effort).
export const AUTO_MODEL = "anthropic/claude-sonnet-5.5";
const AUTO_REASONING = { effort: "medium" };

// Pro picks a model in the chat composer, as in Granola (free is Auto only).
// The app sends "Auto" or an OpenRouter slug from these vendors; the rule
// matches apps/desktop/src/ai/upshot-models.ts.
const PRO_VENDORS = ["anthropic/", "openai/", "google/"];
const MODEL_SLUG = /^[a-z0-9-]+\/[a-z0-9.\-]+$/;

export function isProModelSlug(model) {
  return (
    typeof model === "string" &&
    MODEL_SLUG.test(model) &&
    PRO_VENDORS.some((vendor) => model.startsWith(vendor))
  );
}

// Pro check: the app sends "Authorization: Bearer <Supabase access token>"
// only when a model is picked; the user must have an active or trialing
// row in public.subscriptions (written by the Stripe webhook, billing.js).
// Any failure means "not Pro", so the request still runs on Auto.
export async function verifyPro(request, env) {
  try {
    const user = await getUser(request, env);
    if (!user) return false;
    const row = await rowForUser(env, user.id, user.token);
    return isProStatus(row?.status);
  } catch {
    return false;
  }
}

/** The model and reasoning to send upstream for a request body. */
export function resolveModel(model, isPro) {
  if (isPro && model !== "Auto" && isProModelSlug(model)) {
    // Picked models run at their own defaults; only Auto sets the effort.
    return { model };
  }
  return { model: AUTO_MODEL, reasoning: AUTO_REASONING };
}
