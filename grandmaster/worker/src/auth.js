// Upshot accounts: Google or Microsoft through Supabase Auth (GoTrue).
// The app talks only to this Worker, so no Supabase key ships in the app
// (supabase.com/docs/guides/api/api-keys: the publishable key may be public,
// but Upshot keeps every key on the server anyway).
//
// Routes: POST /auth/refresh; GET /auth/oauth/start and POST
// /auth/oauth/exchange (Google or Microsoft, PKCE); POST /stt/pass. Fork:
// accounts come only from Google or Microsoft, as Granola ("Granola only
// supports Google and Microsoft single sign on": docs.granola.ai setup
// guide), so /auth/signup and the old password /auth/login answer 410.
// Upshot AI and transcription need such an account (requireAccount, below).
// getUser(): supabase.com/docs/guides/auth/jwts, "GET /auth/v1/user" with
// apikey = publishable key and Authorization: Bearer <access token>.

import {
  calendarProviderEnabled,
  MICROSOFT_CALENDAR_SCOPES,
  saveCalendarConnection,
} from "./calendar.js";
import {
  bearerToken,
  json,
  ok,
  rateLimited,
  readSmallJson,
  sessionToken,
} from "./http.js";

function supabaseHeaders(env) {
  return {
    apikey: env.SUPABASE_PUBLISHABLE_KEY,
    "content-type": "application/json",
  };
}

function configured(env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY);
}

// Fork: plain messages instead of raw Supabase errors (ux-audit-oct3 D,
// NN/g #9).
const TOO_MANY = "Too many tries. Wait a minute, then try again.";

export function sessionPayload(body) {
  const expiresAt =
    Number(body.expires_at) ||
    Math.floor(Date.now() / 1000) + Number(body.expires_in ?? 3600);
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: expiresAt,
    user: { id: body.user?.id, email: body.user?.email },
  };
}

async function gotrue(env, path, payload) {
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/${path}`, {
    method: "POST",
    headers: supabaseHeaders(env),
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

export const DOWNLOAD_URL =
  "https://github.com/AdamWebsiteFormula/grandmaster-app/releases/latest";
// Shown by apps from before sign-in existed, too: Upshot 1.0.0 shows this
// text in chat and under a failed summary, so it says where the new app is.
export const SIGN_IN_REQUIRED = `Sign in to use Upshot AI and transcription. It's free. Don't see Sign in? Download the new Upshot: ${DOWNLOAD_URL}`;
// Fork (Oct 9): old apps sign in with a password; tell them how to keep
// their account. Supabase links a Google or Microsoft sign-in to the
// account with the same confirmed email (supabase.com/docs/guides/auth/
// auth-identity-linking), so nobody signs up again.
export const USE_GOOGLE_OR_MICROSOFT = `Upshot now signs in with Google or Microsoft. Use the same email to keep your account and plan. Download the new Upshot: ${DOWNLOAD_URL} No Google or Microsoft email? Write to adam@websiteformula.co.`;
const NOT_FINISHED = "Sign-in didn't finish. Try again.";

const OAUTH_PROVIDERS = new Set(["google", "azure"]);
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
// RFC 7636 §4.2: base64url of a SHA-256 hash is 43 characters.
const CODE_CHALLENGE = /^[A-Za-z0-9_-]{43,128}$/;
const CODE_VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;
// RFC 8252 §7.3: native apps get the code back on a loopback port.
const LOOPBACK_REDIRECT = /^http:\/\/127\.0\.0\.1:\d{2,5}\/auth\/callback$/;

// ---------- Google sign-in that returns to Upshot's own domain ----------
//
// Fork (Adam, Oct 5): Google's screen named the Supabase project
// ("Sign in to <ref>.supabase.co") because Google returned to Supabase.
// Supabase's custom domain is a paid add-on, so Google returns to this
// Worker at PUBLIC_ORIGIN instead. The Worker swaps Google's code for an ID
// token and signs in to Supabase with it (grant_type=id_token,
// supabase.com/docs/reference/javascript/auth-signinwithidtoken), then hands
// the app a sealed one-time code that only the app's PKCE verifier opens
// (RFC 7636). Without GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
// OAUTH_STATE_KEY and PUBLIC_ORIGIN it falls back to the Supabase flow.

const GOOGLE_AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_CALLBACK_PATH = "/auth/google/callback";
const STATE_SECONDS = 600;
const HANDOFF_SECONDS = 300;
const HANDOFF_PREFIX = "u1.";

export function googleViaWorker(env) {
  return Boolean(
    env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET &&
      env.OAUTH_STATE_KEY &&
      env.PUBLIC_ORIGIN,
  );
}

function b64url(bytes) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(text) {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function stateKey(env) {
  const raw = Uint8Array.from(atob(env.OAUTH_STATE_KEY), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error("OAUTH_STATE_KEY must be 32 bytes");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

/** AES-GCM seal: tamper-proof and unreadable outside this Worker. */
export async function seal(env, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await stateKey(env),
      new TextEncoder().encode(JSON.stringify(value)),
    ),
  );
  const out = new Uint8Array(iv.length + sealed.length);
  out.set(iv);
  out.set(sealed, iv.length);
  return b64url(out);
}

/** The sealed value, or null when forged, broken or expired. */
export async function unseal(env, text, now = Date.now()) {
  try {
    const bytes = fromB64url(text);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.slice(0, 12) },
      await stateKey(env),
      bytes.slice(12),
    );
    const value = JSON.parse(new TextDecoder().decode(plain));
    return typeof value?.exp === "number" && value.exp * 1000 > now
      ? value
      : null;
  } catch {
    return null;
  }
}

async function sha256(text) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
  );
}

function hex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function redirect(location) {
  return new Response(null, {
    status: 302,
    headers: { location, "cache-control": "no-store" },
  });
}

async function startGoogleViaWorker(env, { challenge, redirectTo, calendar }) {
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const state = await seal(env, {
    r: redirectTo,
    c: challenge,
    k: calendar,
    n: nonce,
    exp: Math.floor(Date.now() / 1000) + STATE_SECONDS,
  });
  const target = new URL(GOOGLE_AUTHORIZE);
  target.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  target.searchParams.set(
    "redirect_uri",
    `${env.PUBLIC_ORIGIN}${GOOGLE_CALLBACK_PATH}`,
  );
  target.searchParams.set("response_type", "code");
  target.searchParams.set(
    "scope",
    calendar ? `openid email profile ${GOOGLE_CALENDAR_SCOPE}` : "openid email profile",
  );
  target.searchParams.set("state", state);
  // Supabase compares the SHA-256 of the raw nonce with the ID token's.
  target.searchParams.set("nonce", hex(await sha256(nonce)));
  if (calendar) {
    target.searchParams.set("access_type", "offline");
    target.searchParams.set("prompt", "consent");
    target.searchParams.set("include_granted_scopes", "true");
  } else {
    target.searchParams.set("prompt", "select_account");
  }
  return redirect(target.toString());
}

function expiredPage() {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Upshot</title><body style="font:16px -apple-system,system-ui,sans-serif;max-width:480px;margin:96px auto;padding:0 24px;color:#1c1b19"><h1 style="font-size:24px">Sign-in expired</h1><p>Go back to Upshot and click Continue with Google again.</p></body>`,
    {
      status: 400,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}

/** GET /auth/google/callback: Google comes back here. */
export async function handleGoogleCallback(request, env, url) {
  if (!googleViaWorker(env) || !configured(env)) return json(404, "Not found");
  if (await rateLimited(request, env, "auth")) return json(429, TOO_MANY);
  const state = await unseal(env, url.searchParams.get("state") ?? "");
  if (!state || !LOOPBACK_REDIRECT.test(state.r ?? "")) return expiredPage();
  const back = new URL(state.r);
  const code = url.searchParams.get("code");
  if (!code) {
    // Canceled at Google: the app shows "Sign-in didn't finish."
    back.searchParams.set("error", "access_denied");
    return redirect(back.toString());
  }

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${env.PUBLIC_ORIGIN}${GOOGLE_CALLBACK_PATH}`,
      grant_type: "authorization_code",
    }),
  });
  const google = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || typeof google.id_token !== "string") {
    console.error("google token exchange failed", tokenResponse.status);
    back.searchParams.set("error", "server_error");
    return redirect(back.toString());
  }

  const { response, body } = await gotrue(env, "token?grant_type=id_token", {
    provider: "google",
    id_token: google.id_token,
    nonce: state.n,
  });
  if (!response.ok || !body.access_token) {
    console.error("supabase id_token sign-in failed", response.status);
    back.searchParams.set("error", "server_error");
    return redirect(back.toString());
  }

  if (state.k && typeof google.refresh_token === "string" && body.user?.id) {
    await saveCalendarConnection(env, {
      userId: body.user.id,
      provider: "google",
      email: body.user.email ?? null,
      refreshToken: google.refresh_token,
    });
  }

  const handoff = await seal(env, {
    s: sessionPayload(body),
    c: state.c,
    exp: Math.floor(Date.now() / 1000) + HANDOFF_SECONDS,
  });
  back.searchParams.set("code", `${HANDOFF_PREFIX}${handoff}`);
  return redirect(back.toString());
}

/** The session in a sealed hand-off code, if the verifier matches. */
async function openHandoff(env, code, verifier) {
  if (!googleViaWorker(env)) return null;
  const value = await unseal(env, code.slice(HANDOFF_PREFIX.length));
  if (!value?.s?.access_token || typeof value.c !== "string") return null;
  return b64url(await sha256(verifier)) === value.c ? value.s : null;
}

/**
 * GET /auth/oauth/start: send the browser to Supabase's authorize page.
 * The app never holds the Supabase URL or key; it only knows this Worker.
 */
export async function handleOAuthStart(request, env, url) {
  if (!configured(env)) return json(503, "Accounts are not available yet.");
  if (await rateLimited(request, env, "auth")) return json(429, TOO_MANY);
  const provider = url.searchParams.get("provider") ?? "";
  const challenge = url.searchParams.get("code_challenge") ?? "";
  const redirectTo = url.searchParams.get("redirect_to") ?? "";
  if (
    !OAUTH_PROVIDERS.has(provider) ||
    !CODE_CHALLENGE.test(challenge) ||
    !LOOPBACK_REDIRECT.test(redirectTo)
  ) {
    return json(400, "Invalid request");
  }
  const calendar = url.searchParams.get("calendar") === "1";
  // Switched-off calendars never reach Google's or Microsoft's consent
  // screen, even from an old or modified app (calendar.js).
  if (calendar && !calendarProviderEnabled(env, provider)) {
    return json(404, "Calendar connection isn't available yet.", "calendar_unavailable");
  }
  if (provider === "google" && googleViaWorker(env)) {
    return startGoogleViaWorker(env, { challenge, redirectTo, calendar });
  }
  const target = new URL(`${env.SUPABASE_URL}/auth/v1/authorize`);
  target.searchParams.set("provider", provider);
  target.searchParams.set("redirect_to", redirectTo);
  target.searchParams.set("code_challenge", challenge);
  target.searchParams.set("code_challenge_method", "s256");
  // Microsoft needs the email scope for Supabase to read the address
  // (supabase.com/docs/guides/auth/social-login/auth-azure).
  // calendar=1 also asks to read the calendar, with a refresh token the
  // Worker keeps (calendar.js). Google needs access_type=offline and
  // prompt=consent for that (supabase.com/docs/guides/auth/social-login/
  // auth-google, "Saving Google tokens").
  if (provider === "azure") {
    target.searchParams.set(
      "scopes",
      calendar ? `email ${MICROSOFT_CALENDAR_SCOPES}` : "email",
    );
  } else if (calendar) {
    target.searchParams.set("scopes", GOOGLE_CALENDAR_SCOPE);
    target.searchParams.set("access_type", "offline");
    target.searchParams.set("prompt", "consent");
    // Keep the sign-in scopes granted earlier (incremental authorization:
    // developers.google.com/identity/protocols/oauth2/web-server#incrementalAuth).
    target.searchParams.set("include_granted_scopes", "true");
  }
  return new Response(null, {
    status: 302,
    headers: { location: target.toString(), "cache-control": "no-store" },
  });
}

/** POST /auth/oauth/exchange: the PKCE code and verifier for a session. */
export async function handleOAuthExchange(request, env) {
  if (!configured(env)) return json(503, "Accounts are not available yet.");
  if (await rateLimited(request, env, "auth")) return json(429, TOO_MANY);
  const input = await readSmallJson(request, 16_384);
  const code = input?.code;
  const verifier = input?.code_verifier;
  if (
    typeof code !== "string" ||
    code.length < 8 ||
    code.length > 12_000 ||
    typeof verifier !== "string" ||
    !CODE_VERIFIER.test(verifier)
  ) {
    return json(400, "Invalid request");
  }
  if (code.startsWith(HANDOFF_PREFIX)) {
    const session = await openHandoff(env, code, verifier);
    return session ? ok(session) : json(400, NOT_FINISHED);
  }
  const { response, body } = await gotrue(env, "token?grant_type=pkce", {
    auth_code: code,
    code_verifier: verifier,
  });
  if (!response.ok || !body.access_token) {
    if (response.status === 429) return json(429, TOO_MANY);
    return json(400, NOT_FINISHED);
  }
  // The calendar's refresh token stays here; the app never sees it.
  const provider = input.provider;
  if (
    input.calendar === true &&
    typeof body.provider_refresh_token === "string" &&
    body.provider_refresh_token &&
    OAUTH_PROVIDERS.has(provider) &&
    body.user?.id
  ) {
    await saveCalendarConnection(env, {
      userId: body.user.id,
      provider,
      email: body.user.email ?? null,
      refreshToken: body.provider_refresh_token,
    });
  }
  return ok(sessionPayload(body));
}

export async function handleAuth(request, env, pathname) {
  if (!configured(env)) return json(503, "Accounts are not available yet.");
  if (pathname === "/auth/signup" || pathname === "/auth/login") {
    return json(410, USE_GOOGLE_OR_MICROSOFT, "use_google_or_microsoft");
  }
  if (await rateLimited(request, env, "auth")) {
    return json(429, TOO_MANY);
  }
  const input = await readSmallJson(request);
  if (!input) return json(400, "Invalid request");

  if (pathname === "/auth/refresh") {
    const token = input.refresh_token;
    if (typeof token !== "string" || token.length < 8 || token.length > 512) {
      return json(400, "Invalid request");
    }
    const { response, body } = await gotrue(
      env,
      "token?grant_type=refresh_token",
      { refresh_token: token },
    );
    if (!response.ok || !body.access_token) {
      return json(401, "Your session ended. Sign in again.");
    }
    return ok(sessionPayload(body));
  }

  return json(404, "Not found");
}

/** The signed-in user for a request's Bearer token, or null. */
export async function getUser(request, env, token = bearerToken(request)) {
  if (!token || !configured(env)) return null;
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  if (!user?.id) return null;
  const providers = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers
    : [user.app_metadata?.provider].filter(Boolean);
  return { id: user.id, email: user.email ?? null, token, providers };
}

/** Google or Microsoft proved this account's email. */
export function isProvenAccount(user) {
  return Boolean(
    user?.providers?.some((provider) => OAUTH_PROVIDERS.has(provider)),
  );
}

// A short cache so each chat or transcription request doesn't wait on
// Supabase. A token stays valid until it expires (about an hour), so 60 s
// of caching never outlives it by much.
const ACCOUNT_CACHE_MS = 60_000;
const ACCOUNT_CACHE_MAX = 500;
const accountCache = new Map();

export function clearAccountCacheForTests() {
  accountCache.clear();
}

/**
 * The account behind the request, or null. Upshot AI sends "Bearer";
 * the transcription client sends Deepgram's "Token" scheme.
 */
export async function requireAccount(request, env, now = Date.now()) {
  const token = sessionToken(request);
  if (!token) return null;
  const cached = accountCache.get(token);
  if (cached && cached.until > now) return cached.user;
  const user = await getUser(request, env, token);
  const proven = isProvenAccount(user) ? user : null;
  if (proven) {
    if (accountCache.size >= ACCOUNT_CACHE_MAX) {
      accountCache.delete(accountCache.keys().next().value);
    }
    accountCache.set(token, { user: proven, until: now + ACCOUNT_CACHE_MS });
  }
  return proven;
}

/**
 * Off only for the first deploy (wrangler deploy --var REQUIRE_ACCOUNT:0),
 * before the new installers are out; on otherwise.
 */
export function accountRequired(env) {
  return env.REQUIRE_ACCOUNT !== "0";
}

/** 401 with the sign-in message, for chat and transcription. */
export function signInRequired() {
  return json(401, SIGN_IN_REQUIRED, "sign_in_required");
}

// ---------- Meeting pass for Upshot transcription ----------
//
// Fork (Oct 9 bug sweep): a meeting can outlast the one-hour access token,
// and a dropped stream reconnects with the token it started with. Deepgram
// and AssemblyAI check a token only when a stream opens, and AssemblyAI's
// streaming token lets one session run up to 3 hours (assemblyai.com/docs/
// streaming/api-spec/generate-streaming-token). An expired JWT is never
// accepted (RFC 7519 §4.1.4), so the app asks for this pass when recording
// starts: sealed here, for transcription only, valid 3 hours.
const STT_PASS_PREFIX = "sp1.";
export const STT_PASS_SECONDS = 3 * 60 * 60;

/** POST /stt/pass: a transcription-only pass for the signed-in account. */
export async function handleSttPass(request, env) {
  if (!env.OAUTH_STATE_KEY) {
    return json(503, "Upshot transcription isn't available yet.", "stt_pass_unavailable");
  }
  if (await rateLimited(request, env, "auth")) return json(429, TOO_MANY);
  const account = await requireAccount(request, env);
  if (!account) return signInRequired();
  const expiresAt = Math.floor(Date.now() / 1000) + STT_PASS_SECONDS;
  const pass = await seal(env, { p: "stt", u: account.id, exp: expiresAt });
  return ok({ pass: `${STT_PASS_PREFIX}${pass}`, expires_at: expiresAt });
}

/** The account behind a transcription request: a meeting pass or a session. */
export async function sttAccount(request, env, now = Date.now()) {
  const token = sessionToken(request);
  if (!token?.startsWith(STT_PASS_PREFIX)) return requireAccount(request, env, now);
  if (!env.OAUTH_STATE_KEY) return null;
  const value = await unseal(env, token.slice(STT_PASS_PREFIX.length), now);
  return value?.p === "stt" && typeof value.u === "string" ? { id: value.u } : null;
}
