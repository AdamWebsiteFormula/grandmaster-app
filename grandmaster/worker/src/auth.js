// Upshot accounts: email and password through Supabase Auth (GoTrue).
// The app talks only to this Worker, so no Supabase key ships in the app
// (supabase.com/docs/guides/api/api-keys: the publishable key may be public,
// but Upshot keeps every key on the server anyway).
//
// Routes: POST /auth/signup, /auth/login, /auth/refresh.
// getUser(): supabase.com/docs/guides/auth/jwts, "GET /auth/v1/user" with
// apikey = publishable key and Authorization: Bearer <access token>.

import { bearerToken, json, ok, rateLimited, readSmallJson } from "./http.js";

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

export async function handleAuth(request, env, pathname) {
  if (!configured(env)) return json(503, "Accounts are not available yet.");
  if (await rateLimited(request, env, "auth")) {
    return json(429, "Too many tries. Wait a minute, then try again.");
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

  if (pathname === "/auth/signup") {
    const { response, body } = await gotrue(env, "signup", parsed);
    if (!response.ok) {
      return json(
        response.status === 429 ? 429 : 400,
        authErrorMessage(body, "Could not create your account."),
      );
    }
    // With email confirmation on, Supabase returns the user but no session.
    if (!body.access_token) {
      return json(
        409,
        "Check your email to confirm your account, then sign in.",
      );
    }
    return ok(sessionPayload(body));
  }

  // /auth/login
  const { response, body } = await gotrue(
    env,
    "token?grant_type=password",
    parsed,
  );
  if (!response.ok || !body.access_token) {
    return json(
      response.status === 429 ? 429 : 400,
      authErrorMessage(body, "Wrong email or password."),
    );
  }
  return ok(sessionPayload(body));
}

/** The signed-in user for a request's Bearer token, or null. */
export async function getUser(request, env) {
  const token = bearerToken(request);
  if (!token || !configured(env)) return null;
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  return user?.id ? { id: user.id, email: user.email ?? null, token } : null;
}
