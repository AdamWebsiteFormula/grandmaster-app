// Upshot transcription: a keyless speech-to-text proxy for Windows, Linux
// and Intel Macs, which have no on-device engine in Upshot. The app talks to
// it as its built-in "Upshot" transcription provider; the Worker adds the
// server-side Deepgram key, so no key ships in the app.
//
// Two routes, both at /stt/listen, matching what the app's Rust client sends
// (crates/owhisper-client):
//   live:  WebSocket upgrade, Deepgram streaming query params (DeepgramAdapter
//          builds them, since this host is not a known provider host).
//   batch: POST of the recorded file, Anarlog proxy params (model, channels,
//          sample_rate, language, keyword), answered in Deepgram's JSON shape.
//
// Deepgram API: developers.deepgram.com/reference/speech-to-text/listen-streaming
// and /listen-pre-recorded. Auth header "Token <key>"
// (developers.deepgram.com/docs/authenticating). WebSocket passthrough:
// developers.cloudflare.com/workers/examples/websockets/ ("establishing
// WebSocket connections by making a fetch request ... with the Upgrade
// header"); returning that response pipes frames without Worker CPU time.
//
// Abuse limits (OWASP LLM10:2025 Unbounded Consumption): per-IP rate limit,
// a Deepgram-only model allowlist, a query-param allowlist, mip_opt_out, and
// no browser origins (browsers always send Origin; the app's Rust client
// doesn't, and WebSockets skip CORS). Nothing is stored or logged.
//
// Secret: DEEPGRAM_API_KEY (Cloudflare dashboard › Worker › Settings ›
// Variables and Secrets). Without it every route answers a clear 503.

import { json, rateLimited } from "./http.js";

export const DEEPGRAM_LISTEN = "https://api.deepgram.com/v1/listen";
export const DEFAULT_STT_MODEL = "nova-3";

// Deepgram models the app's Deepgram adapter can pick by language. Anything
// else ("cloud", Flux, other vendors) runs on nova-3.
const DEEPGRAM_MODELS = new Set([
  "nova-3",
  "nova-3-general",
  "nova-3-medical",
  "nova-2",
  "nova-2-general",
  "nova-2-meeting",
]);

// Live params passed through as sent (DeepgramAdapter + QueryParamBuilder).
const LIVE_PARAMS = [
  "language",
  "channels",
  "sample_rate",
  "encoding",
  "diarize",
  "punctuate",
  "smart_format",
  "numerals",
  "filler_words",
  "interim_results",
  "multichannel",
  "vad_events",
  "endpointing",
  "utterance_end_ms",
  "keyterm",
  "keywords",
];

const MAX_KEYTERMS = 50;
const LANGUAGE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$|^multi$/;

export const STT_UNAVAILABLE =
  "Upshot transcription isn't available right now. Try again later, or pick another engine in Settings › Transcription.";

export function sttModel(requested) {
  return DEEPGRAM_MODELS.has(requested) ? requested : DEFAULT_STT_MODEL;
}

/** Deepgram streaming URL from the app's live query (allowlisted params). */
export function liveUpstreamUrl(incoming) {
  const out = new URL(DEEPGRAM_LISTEN);
  out.searchParams.set("model", sttModel(incoming.searchParams.get("model")));
  for (const key of LIVE_PARAMS) {
    const values = incoming.searchParams.getAll(key);
    const limit = key === "keyterm" || key === "keywords" ? MAX_KEYTERMS : 1;
    for (const value of values.slice(0, limit)) {
      if (key === "language" && !LANGUAGE.test(value)) continue;
      out.searchParams.append(key, value.slice(0, 100));
    }
  }
  out.searchParams.set("mip_opt_out", "true");
  return out;
}

/**
 * Deepgram pre-recorded URL from the app's batch query (AnarlogAdapter
 * shape), with the options the app's own Deepgram batch path sets
 * (deepgram_compat::build_batch_url). The file is a container (wav, ogg,
 * mp3, m4a...), so Deepgram reads encoding and sample rate from it.
 */
export function batchUpstreamUrl(incoming) {
  const out = new URL(DEEPGRAM_LISTEN);
  const q = incoming.searchParams;
  out.searchParams.set("model", sttModel(q.get("model")));
  for (const flag of [
    "diarize",
    "punctuate",
    "smart_format",
    "utterances",
    "numerals",
    "mip_opt_out",
  ]) {
    out.searchParams.set(flag, "true");
  }
  if (Number(q.get("channels")) > 1) {
    out.searchParams.set("multichannel", "true");
  }
  const languages = q.getAll("language").filter((l) => LANGUAGE.test(l));
  if (languages.length === 1) {
    out.searchParams.set("language", languages[0]);
  } else {
    // Several spoken languages: detect among them, like the app's Deepgram
    // batch path (developers.deepgram.com/docs/language-detection).
    out.searchParams.set("detect_language", "true");
    for (const language of languages.slice(0, 10)) {
      out.searchParams.append("detect_language", language);
    }
  }
  for (const keyword of q.getAll("keyword").slice(0, MAX_KEYTERMS)) {
    out.searchParams.append("keyterm", keyword.slice(0, 100));
  }
  return out;
}

function upstreamError(status) {
  if (status === 429) {
    return json(429, "Upshot transcription is busy. Try again in a minute.");
  }
  if (status === 400) {
    return json(400, "Upshot transcription couldn't read this audio.");
  }
  // 401/402/403 (key or credit) and 5xx: the owner has to act, not the user.
  return json(503, STT_UNAVAILABLE, "stt_unavailable");
}

export async function handleStt(request, env, url) {
  if (url.pathname !== "/stt/listen" && url.pathname !== "/stt/listen/") {
    return json(404, "Not found");
  }
  // Browsers always send Origin; the app's Rust client never does.
  if (request.headers.get("origin")) {
    return json(403, "Not allowed");
  }
  if (!env.DEEPGRAM_API_KEY) {
    return json(503, STT_UNAVAILABLE, "stt_unavailable");
  }
  if (await rateLimited(request, env, "stt")) {
    return json(429, "Upshot transcription is busy. Try again in a minute.");
  }
  const authorization = `Token ${env.DEEPGRAM_API_KEY}`;

  const isUpgrade =
    (request.headers.get("upgrade") ?? "").toLowerCase() === "websocket";
  if (request.method === "GET" && isUpgrade) {
    const upstream = await fetch(liveUpstreamUrl(url).toString(), {
      headers: { upgrade: "websocket", authorization },
    });
    if (!upstream.webSocket) {
      console.error("stt live upstream error", upstream.status);
      return upstreamError(upstream.status);
    }
    return upstream;
  }

  if (request.method !== "POST") {
    return json(405, "Method not allowed");
  }
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  if (
    !contentType.startsWith("audio/") &&
    !contentType.startsWith("application/octet-stream")
  ) {
    return json(415, "Invalid request");
  }

  const upstream = await fetch(batchUpstreamUrl(url).toString(), {
    method: "POST",
    headers: { authorization, "content-type": contentType },
    body: request.body,
  });
  if (!upstream.ok) {
    console.error("stt batch upstream error", upstream.status);
    return upstreamError(upstream.status);
  }
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}
