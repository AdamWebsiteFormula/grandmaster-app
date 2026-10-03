// Small response helpers shared by the Worker routes.

// Fork: an optional machine code lets the app react to an error, not just
// show it (journey-account-settings P2 "already_pro"; NN/g #9).
export function json(status, message, code) {
  const error = code ? { message, code } : { message };
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

export function ok(data) {
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

/** Parse a small JSON body, or return null when it is too big or invalid. */
export async function readSmallJson(request, maxBytes = 4_096) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > maxBytes) return null;
  const raw = await request.text();
  if (raw.length > maxBytes) return null;
  try {
    const body = JSON.parse(raw);
    return body && typeof body === "object" && !Array.isArray(body)
      ? body
      : null;
  } catch {
    return null;
  }
}

export function bearerToken(request) {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S{20,4096})$/i.exec(header);
  return match ? match[1] : null;
}

export async function rateLimited(request, env, bucket) {
  if (!env.RATE_LIMITER) return false;
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const { success } = await env.RATE_LIMITER.limit({ key: `${bucket}:${ip}` });
  return !success;
}
