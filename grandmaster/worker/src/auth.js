// Upshot accounts: email and password through Supabase Auth (GoTrue).
// The app talks only to this Worker, so no Supabase key ships in the app
// (supabase.com/docs/guides/api/api-keys: the publishable key may be public,
// but Upshot keeps every key on the server anyway).
//
// Routes: POST /auth/login, /auth/refresh; GET /auth/oauth/start and
// POST /auth/oauth/exchange (Google or Microsoft, PKCE). Fork: new accounts
// come only from Google or Microsoft, as Granola ("Granola only supports
// Google and Microsoft single sign on": docs.granola.ai setup guide), so
// /auth/signup answers 410. Upshot AI and transcription need such an
// account (requireAccount, below).
// getUser(): supabase.com/docs/guides/auth/jwts, "GET /auth/v1/user" with
// apikey = publishable key and Authorization: Bearer <access token>.

import {
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

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,63}$/;
// bcrypt, which Supabase Auth uses, reads at most 72 bytes.
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72;

function supabaseHeaders(env) {
  return {
    apikey: env.SUPABASE_PUBLISHABLE_KEY,
    "content-type": "application/json",
  };
}

function configured(env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY);
}

/** Supabase Auth error bodies vary by version: msg, error_description, message. */
function authErrorMessage(body, fallback) {
  const text =
    body?.msg ?? body?.error_description ?? body?.message ?? body?.error;
  return typeof text === "string" && text.length < 300 ? text : fallback;
}

// Fork: plain messages instead of raw Supabase errors (ux-audit-oct3 D,
// NN/g #9).
export const WRONG_LOGIN = "Wrong email or password.";
const TOO_MANY = "Too many tries. Wait a minute, then try again.";
const CONFIRM_EMAIL = "Check your email to confirm your account, then sign in.";

// Supabase Auth error codes (supabase.com/docs/guides/auth/debugging/error-codes)
// to fixed sentences; any other code gets the generic line, never raw text.
const KNOWN_ERRORS = {
  weak_password: "Choose a stronger password. This one is too easy to guess.",
  email_address_invalid: "This email address can't be used. Try another one.",
  signup_disabled: "New accounts are paused right now. Try again later.",
  over_email_send_rate_limit:
    "Too many sign-up emails were sent. Try again in an hour.",
};

function knownError(body) {
  return Object.hasOwn(KNOWN_ERRORS, body?.error_code ?? "")
    ? KNOWN_ERRORS[body.error_code]
    : null;
}

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

function credentials(body) {
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!EMAIL.test(email) || email.length > 254) {
    return { error: "Enter a valid email address." };
  }
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
    return {
      error: `Use a password of ${MIN_PASSWORD} to ${MAX_PASSWORD} characters.`,
    };
  }
  return { email, password };
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
const USE_GOOGLE_OR_MICROSOFT = `Upshot now signs in with Google or Microsoft. Download the new Upshot: ${DOWNLOAD_URL}`;
const NOT_FINISHED = "Sign-in didn't finish. Try again.";

const OAUTH_PROVIDERS = new Set(["google", "azure"]);
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
// RFC 7636 §4.2: base64url of a SHA-256 hash is 43 characters.
const CODE_CHALLENGE = /^[A-Za-z0-9_-]{43,128}$/;
const CODE_VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;
// RFC 8252 §7.3: native apps get the code back on a loopback port.
const LOOPBACK_REDIRECT = /^http:\/\/127\.0\.0\.1:\d{2,5}\/auth\/callback$/;

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
  const calendar = url.searchParams.get("calendar") === "1";
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
  const input = await readSmallJson(request);
  const code = input?.code;
  const verifier = input?.code_verifier;
  if (
    typeof code !== "string" ||
    code.length < 8 ||
    code.length > 512 ||
    typeof verifier !== "string" ||
    !CODE_VERIFIER.test(verifier)
  ) {
    return json(400, "Invalid request");
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
  if (pathname === "/auth/signup") {
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

  const parsed = credentials(input);
  if (parsed.error) return json(400, parsed.error);

  // /auth/login
  const { response, body } = await gotrue(
    env,
    "token?grant_type=password",
    parsed,
  );
  if (!response.ok || !body.access_token) {
    if (response.status === 429) return json(429, TOO_MANY);
    if (response.status >= 500) {
      return json(502, "Could not sign in. Try again in a minute.");
    }
    if (body?.error_code === "email_not_confirmed") {
      return json(400, CONFIRM_EMAIL);
    }
    const known = knownError(body);
    if (known) return json(400, known);
    // Supabase answers 400 "Invalid login credentials".
    return json(400, WRONG_LOGIN);
  }
  return ok(sessionPayload(body));
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
