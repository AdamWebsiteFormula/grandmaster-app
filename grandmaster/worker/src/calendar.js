// Upshot calendar: Google Calendar and Outlook through the Upshot account,
// as Granola connects the calendar of the account you sign in with
// (docs.granola.ai/help-center/getting-started/syncing-your-calendars).
// Plan: grandmaster/sops/calendar-from-sign-in.md.
//
// The app's existing cloud calendar client (crates/calendar/src/fetch.rs)
// calls the same five routes Anarlog's server had (crates/api-nango,
// crates/api-calendar), so the responses are the providers' own JSON:
//   GET  /nango/connections
//   POST /calendar/google/list-calendars   POST /calendar/google/list-events
//   POST /calendar/outlook/list-calendars  POST /calendar/outlook/list-events
// Every route needs the Upshot session (requireAccount). 424 means the saved
// provider token no longer works and the person has to connect again.
//
// Provider refresh tokens never reach the app. They are stored encrypted
// (AES-GCM, CALENDAR_TOKEN_KEY) in public.calendar_connections, a table with
// RLS on and no policies, so only the secret key (this Worker) reads it.
// Supabase does not refresh provider tokens, so this Worker does
// (supabase.com/docs/guides/auth/social-login/auth-google, "Saving Google
// tokens").
//
// Secrets: CALENDAR_TOKEN_KEY (32 random bytes, base64), GOOGLE_CLIENT_ID,
// GOOGLE_CLIENT_SECRET, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET.

import { requireAccount, signInRequired } from "./auth.js";
import { json, readSmallJson, userRateLimited } from "./http.js";

export const INTEGRATION_BY_PROVIDER = {
  google: "google-calendar",
  azure: "outlook",
};
const PROVIDER_BY_INTEGRATION = {
  "google-calendar": "google",
  outlook: "azure",
};

const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_API = "https://www.googleapis.com/calendar/v3";
const MICROSOFT_TOKEN =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_API = "https://graph.microsoft.com/v1.0";
export const MICROSOFT_CALENDAR_SCOPES = "offline_access Calendars.Read";

const RECONNECT = "Connect your calendar again in Settings › Calendar.";

// ---------- on/off per provider ----------
//
// Fork (Adam, Oct 6): Connect calendar ships switched off, so nobody sees
// Google's unverified-app screen before its sensitive-scope review, or
// Microsoft's before publisher verification. Turn one on with a Worker var
// (CALENDAR_GOOGLE=1, CALENDAR_OUTLOOK=1); installed apps read
// GET /calendar/providers and show the button with no new download.

export function calendarProviderEnabled(env, provider) {
  return provider === "google"
    ? env.CALENDAR_GOOGLE === "1"
    : provider === "azure"
      ? env.CALENDAR_OUTLOOK === "1"
      : false;
}

/** GET /calendar/providers: no sign-in needed; cached for 5 minutes. */
export function calendarProviders(env) {
  return Response.json(
    {
      google: calendarProviderEnabled(env, "google"),
      outlook: calendarProviderEnabled(env, "azure"),
    },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}

// ---------- token encryption ----------

function bytesFromBase64(text) {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

function base64FromBytes(bytes) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

async function tokenKey(env) {
  const raw = bytesFromBase64(env.CALENDAR_TOKEN_KEY ?? "");
  if (raw.length !== 32) throw new Error("CALENDAR_TOKEN_KEY must be 32 bytes");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptToken(env, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await tokenKey(env),
      new TextEncoder().encode(text),
    ),
  );
  const out = new Uint8Array(iv.length + sealed.length);
  out.set(iv);
  out.set(sealed, iv.length);
  return base64FromBytes(out);
}

export async function decryptToken(env, blob) {
  const bytes = bytesFromBase64(blob);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes.slice(0, 12) },
    await tokenKey(env),
    bytes.slice(12),
  );
  return new TextDecoder().decode(plain);
}

// ---------- storage (public.calendar_connections) ----------

function adminHeaders(env) {
  if (!env.SUPABASE_SECRET_KEY) {
    throw new Error("SUPABASE_SECRET_KEY is not set");
  }
  return {
    apikey: env.SUPABASE_SECRET_KEY,
    "content-type": "application/json",
  };
}

async function connectionsFor(env, userId) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/calendar_connections?user_id=eq.${encodeURIComponent(userId)}&select=provider,refresh_token,email`,
    { headers: adminHeaders(env) },
  );
  if (!response.ok) throw new Error(`calendar rows ${response.status}`);
  return response.json();
}

/** Save (or replace) one provider's refresh token for a user. */
export async function saveCalendarConnection(env, row) {
  if (!env.CALENDAR_TOKEN_KEY || !Object.hasOwn(INTEGRATION_BY_PROVIDER, row.provider)) {
    return false;
  }
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/calendar_connections`,
    {
      method: "POST",
      headers: {
        ...adminHeaders(env),
        prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        user_id: row.userId,
        provider: row.provider,
        email: row.email ?? null,
        refresh_token: await encryptToken(env, row.refreshToken),
        updated_at: new Date().toISOString(),
      }),
    },
  );
  if (!response.ok) {
    console.error("calendar save failed", response.status);
    return false;
  }
  return true;
}

async function deleteConnection(env, userId, provider) {
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/calendar_connections?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${provider}`,
    { method: "DELETE", headers: adminHeaders(env) },
  ).catch(() => {});
}

// ---------- provider access tokens ----------

// Access tokens live about an hour; keep one per user and provider, and
// refresh a minute early.
const accessCache = new Map();

export function clearCalendarCacheForTests() {
  accessCache.clear();
}

class ReconnectNeeded extends Error {}

async function refreshAccessToken(env, provider, refreshToken) {
  const google = provider === "google";
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: google ? env.GOOGLE_CLIENT_ID : env.MICROSOFT_CLIENT_ID,
    client_secret: google
      ? env.GOOGLE_CLIENT_SECRET
      : env.MICROSOFT_CLIENT_SECRET,
  });
  if (!google) body.set("scope", MICROSOFT_CALENDAR_SCOPES);
  const response = await fetch(google ? GOOGLE_TOKEN : MICROSOFT_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    // invalid_grant: revoked, expired or password changed (RFC 6749 §5.2).
    if (data?.error === "invalid_grant") throw new ReconnectNeeded();
    throw new Error(`token refresh ${response.status}`);
  }
  return data;
}

async function accessTokenFor(env, user, provider, now = Date.now()) {
  const key = `${user.id}:${provider}`;
  const cached = accessCache.get(key);
  if (cached && cached.until > now) return cached.token;
  const rows = await connectionsFor(env, user.id);
  const row = rows.find((r) => r.provider === provider);
  if (!row) throw new ReconnectNeeded();
  let refreshToken;
  try {
    refreshToken = await decryptToken(env, row.refresh_token);
  } catch {
    throw new ReconnectNeeded();
  }
  let data;
  try {
    data = await refreshAccessToken(env, provider, refreshToken);
  } catch (error) {
    if (error instanceof ReconnectNeeded) {
      await deleteConnection(env, user.id, provider);
    }
    throw error;
  }
  // Microsoft rotates refresh tokens; keep the newest one.
  if (data.refresh_token && data.refresh_token !== refreshToken) {
    await saveCalendarConnection(env, {
      userId: user.id,
      provider,
      email: row.email,
      refreshToken: data.refresh_token,
    });
  }
  const seconds = Number(data.expires_in) || 3600;
  accessCache.set(key, {
    token: data.access_token,
    until: now + Math.max(seconds - 60, 30) * 1000,
  });
  return data.access_token;
}

// ---------- routes ----------

function reconnect() {
  return json(424, RECONNECT, "calendar_reconnect");
}

async function providerGet(url, token) {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  // 401: the grant is gone. A 403 is usually setup (for example the
  // Calendar API not enabled for the Google project), so it is logged.
  if (response.status === 401) return { reconnect: true };
  if (!response.ok) {
    console.error("calendar provider error", response.status);
    return { response: json(502, "Your calendar couldn't be read. Try again.") };
  }
  return {
    response: new Response(response.body, {
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    }),
  };
}

const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function validTime(value) {
  return value === undefined || value === null || (typeof value === "string" && RFC3339.test(value));
}

export function googleEventsUrl(input) {
  const url = new URL(
    `${GOOGLE_API}/calendars/${encodeURIComponent(input.calendar_id)}/events`,
  );
  const map = {
    time_min: "timeMin",
    time_max: "timeMax",
    max_results: "maxResults",
    page_token: "pageToken",
    single_events: "singleEvents",
    order_by: "orderBy",
  };
  for (const [from, to] of Object.entries(map)) {
    const value = input[from];
    if (value !== undefined && value !== null) url.searchParams.set(to, String(value));
  }
  return url.toString();
}

// The same mapping as crates/api-calendar/src/outlook/routes.rs and
// crates/outlook-calendar/src/client.rs.
export function outlookEventsUrl(input) {
  const id = encodeURIComponent(input.calendar_id);
  const view = Boolean(input.time_min && input.time_max);
  const params = [];
  if (input.time_min) {
    params.push(`startDateTime=${encodeURIComponent(input.time_min)}`);
  }
  if (input.time_max) {
    params.push(`endDateTime=${encodeURIComponent(input.time_max)}`);
  }
  if (input.max_results) params.push(`$top=${Number(input.max_results)}`);
  if (input.order_by) {
    const orderBy =
      input.order_by === "startTime"
        ? "start/dateTime"
        : input.order_by === "updated"
          ? "lastModifiedDateTime"
          : input.order_by;
    params.push(`$orderby=${encodeURIComponent(orderBy)}`);
  }
  const base = `${GRAPH_API}/me/calendars/${id}/${view ? "calendarView" : "events"}`;
  return params.length ? `${base}?${params.join("&")}` : base;
}

function validEventsInput(input) {
  return (
    typeof input?.connection_id === "string" &&
    typeof input?.calendar_id === "string" &&
    input.calendar_id.length > 0 &&
    input.calendar_id.length <= 512 &&
    validTime(input.time_min) &&
    validTime(input.time_max) &&
    (input.max_results === undefined ||
      input.max_results === null ||
      (Number.isInteger(input.max_results) &&
        input.max_results > 0 &&
        input.max_results <= 2500)) &&
    (input.page_token === undefined ||
      input.page_token === null ||
      (typeof input.page_token === "string" && input.page_token.length <= 2048)) &&
    (input.order_by === undefined ||
      input.order_by === null ||
      ["startTime", "updated"].includes(input.order_by))
  );
}

export async function handleCalendar(request, env, pathname) {
  const account = await requireAccount(request, env);
  if (!account) return signInRequired();
  if (await userRateLimited(env, "calendar", account.id)) {
    return json(429, "Too many calendar requests. Try again in a minute.");
  }
  if (!env.CALENDAR_TOKEN_KEY || !env.SUPABASE_SECRET_KEY) {
    return json(503, "Calendar sync isn't available yet.");
  }

  if (request.method === "GET" && pathname === "/nango/connections") {
    const rows = await connectionsFor(env, account.id);
    return Response.json(
      {
        connections: rows
          .filter((row) => Object.hasOwn(INTEGRATION_BY_PROVIDER, row.provider))
          .map((row) => ({
            integration_id: INTEGRATION_BY_PROVIDER[row.provider],
            connection_id: INTEGRATION_BY_PROVIDER[row.provider],
          })),
      },
      { headers: { "cache-control": "no-store" } },
    );
  }

  const match = /^\/calendar\/(google|outlook)\/(list-calendars|list-events)$/.exec(
    pathname,
  );
  if (request.method !== "POST" || !match) return json(404, "Not found");
  const [, kind, action] = match;
  const provider = kind === "google" ? "google" : "azure";

  const input = await readSmallJson(request);
  if (
    !input ||
    PROVIDER_BY_INTEGRATION[input.connection_id] !== provider ||
    (action === "list-events" && !validEventsInput(input))
  ) {
    return json(400, "Invalid request");
  }

  let token;
  try {
    token = await accessTokenFor(env, account, provider);
  } catch (error) {
    if (error instanceof ReconnectNeeded) return reconnect();
    console.error("calendar token error");
    return json(502, "Your calendar couldn't be read. Try again.");
  }

  const url =
    action === "list-calendars"
      ? kind === "google"
        ? `${GOOGLE_API}/users/me/calendarList`
        : `${GRAPH_API}/me/calendars`
      : kind === "google"
        ? googleEventsUrl(input)
        : outlookEventsUrl(input);
  const result = await providerGet(url, token);
  if (result.reconnect) {
    accessCache.delete(`${account.id}:${provider}`);
    return reconnect();
  }
  return result.response;
}
