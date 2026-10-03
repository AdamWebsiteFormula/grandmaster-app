// Upshot AI: a keyless proxy so Enhance and chat work right after install,
// the way Granola hosts its own models (docs.granola.ai, "Understanding model
// selection in Granola chat": Auto picks the model for you).
//
// Abuse limits follow OWASP LLM10:2025 Unbounded Consumption
// (genai.owasp.org/llmrisk/llm102025-unbounded-consumption): a per-IP rate
// limit, a request size limit, a server-side model choice and an output cap.
// The hard spend ceiling is the OpenRouter credit balance (HTTP 402 when empty).
//
// Secrets (Cloudflare dashboard › Worker › Settings › Variables and Secrets):
//   OPENROUTER_API_KEY, and for accounts and Pro the ones listed in
//   auth.js and billing.js.
// Nothing in a request or response is logged.

import { handleAuth } from "./auth.js";
import { handleBilling, handleDeleteAccount } from "./billing.js";
import { json } from "./http.js";
import {
  AUTO_MODEL,
  isProModelSlug,
  resolveModel,
  verifyPro,
} from "./model.js";

const UPSTREAM = "https://openrouter.ai/api/v1/chat/completions";
// Models: see model.js.
const MAX_BODY_BYTES = 1_000_000;
const MAX_OUTPUT_TOKENS = 8_000;

// Only these request fields reach OpenRouter.
const ALLOWED_FIELDS = [
  "messages",
  "stream",
  "stream_options",
  "temperature",
  "top_p",
  "max_tokens",
  "max_completion_tokens",
  "stop",
  "tools",
  "tool_choice",
  "parallel_tool_calls",
  "response_format",
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return new Response("ok");
    }
    if (
      request.method === "POST" &&
      ["/auth/signup", "/auth/login", "/auth/refresh"].includes(url.pathname)
    ) {
      return handleAuth(request, env, url.pathname);
    }
    // Fork: account deletion (journey-account-settings P3).
    if (request.method === "POST" && url.pathname === "/account/delete") {
      return handleDeleteAccount(request, env);
    }
    if (url.pathname.startsWith("/billing/")) {
      return handleBilling(request, env, url.pathname);
    }
    if (request.method === "GET" && url.pathname.endsWith("/models")) {
      return Response.json({ data: [{ id: "auto", name: "Auto" }] });
    }
    if (
      request.method !== "POST" ||
      !url.pathname.endsWith("/chat/completions")
    ) {
      return json(404, "Not found");
    }

    // JSON only: a text/plain POST skips the CORS preflight, so any web page
    // could make its visitors' browsers spend the credit (fetch.spec.whatwg.org,
    // "CORS-safelisted request-header"). The app's AI SDK sends application/json.
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      return json(415, "Invalid request");
    }

    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    const { success } = await env.RATE_LIMITER.limit({ key: ip });
    if (!success) {
      return json(429, "Upshot AI is busy. Try again in a minute.");
    }

    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > MAX_BODY_BYTES) {
      return json(413, "This meeting is too long for Upshot AI.");
    }
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return json(413, "This meeting is too long for Upshot AI.");
    }

    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return json(400, "Invalid request");
    }
    if (!Array.isArray(body?.messages) || body.messages.length === 0) {
      return json(400, "Invalid request");
    }
    // Text parts only: an image_url or file part makes OpenRouter fetch a
    // remote file of any size (OWASP LLM10). The app sends text only.
    const nonText = body.messages.some(
      (message) =>
        Array.isArray(message?.content) &&
        message.content.some((part) => part?.type !== "text"),
    );
    if (nonText) return json(400, "Invalid request");

    // Only a picked model needs the Pro check (two Supabase reads).
    const wantsPick = body.model !== "Auto" && isProModelSlug(body.model);
    const forwarded = resolveModel(
      body.model,
      wantsPick && (await verifyPro(request, env)),
    );
    for (const field of ALLOWED_FIELDS) {
      if (body[field] !== undefined) forwarded[field] = body[field];
    }
    for (const field of ["max_tokens", "max_completion_tokens"]) {
      const value = Number(forwarded[field]);
      forwarded[field] =
        Number.isFinite(value) && value > 0
          ? Math.min(value, MAX_OUTPUT_TOKENS)
          : undefined;
    }
    // Sonnet 5.5 rejects forced tool use; keep only "auto" and "none"
    // (also the safe choice for every picked model).
    if (
      forwarded.tool_choice !== undefined &&
      forwarded.tool_choice !== "auto" &&
      forwarded.tool_choice !== "none"
    ) {
      delete forwarded.tool_choice;
    }
    if (!forwarded.max_tokens && !forwarded.max_completion_tokens) {
      forwarded.max_tokens = MAX_OUTPUT_TOKENS;
    }

    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "content-type": "application/json",
        "x-title": "Upshot",
      },
      body: JSON.stringify(forwarded),
    });

    if (upstream.status === 402) {
      return json(402, "Upshot AI is out of credit for now. Try again later.");
    }
    // Fork: any other provider error (429, 5xx, a model gone) gets a plain
    // sentence instead of raw OpenRouter JSON (journey-after P2 "Chat provider
    // error"; NN/g #9; OWASP LLM10).
    if (!upstream.ok) {
      console.error("upstream error", upstream.status);
      if (upstream.status === 429) {
        return json(429, "Upshot AI is busy. Try again in a minute.");
      }
      // A picked model that OpenRouter retired or renamed: say how to recover.
      if (
        forwarded.model !== AUTO_MODEL &&
        (upstream.status === 400 || upstream.status === 404)
      ) {
        return json(400, "This model isn't available anymore. Switch to Auto.");
      }
      return json(502, "Upshot AI had a problem answering. Try again.");
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  },
};
