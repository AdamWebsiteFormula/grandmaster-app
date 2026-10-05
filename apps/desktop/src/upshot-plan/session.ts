// Fork: the Upshot account session (Supabase Auth through the Upshot AI
// Worker). The app holds no Supabase or Stripe key: it calls only the Worker,
// which holds every key (docs.stripe.com/keys-best-practices,
// supabase.com/docs/guides/api/api-keys).
//
// The session lives in the macOS Keychain through the same secure store as
// AI provider keys (plugin-store2 get/set/deleteSecret), never in settings.
import { create } from "zustand";

import { commands as store2Commands } from "@anlg/plugin-store2";

import { providerFetch } from "~/ai/provider-fetch";
import { env } from "~/env";

const SECRET_SCOPE = "upshot-account";
const SECRET_KEY = "session";
// Refresh a minute early so a request never leaves with an expired token.
const REFRESH_MARGIN_SECONDS = 60;

export type UpshotSession = {
  access_token: string;
  refresh_token: string;
  /** Unix seconds. */
  expires_at: number;
  email: string;
};

type AccountState = {
  session: UpshotSession | null;
  loaded: boolean;
  /** Set when a checkout opened in the browser; cleared when Pro shows. */
  checkoutPendingSince: number | null;
  /** The Worker rejected the refresh token, so this Mac signed out. */
  sessionEnded: boolean;
};

export const useUpshotAccount = create<AccountState>(() => ({
  session: null,
  loaded: false,
  checkoutPendingSince: null,
  sessionEnded: false,
}));

export const SESSION_ENDED = "Your session ended. Sign in again.";

export class UpshotRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** The Worker's error code, e.g. "account_exists". */
    readonly code?: string,
  ) {
    super(message);
  }
}

/** The Worker origin (same host as the Upshot AI LLM proxy), or null. */
export function upshotWorkerOrigin(): string | null {
  if (!env.VITE_AI_API_URL) return null;
  try {
    return new URL(env.VITE_AI_API_URL).origin;
  } catch {
    return null;
  }
}

async function workerFetch<T>(
  path: string,
  init: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const origin = upshotWorkerOrigin();
  if (!origin) {
    throw new UpshotRequestError("Upshot Pro is not available here.", 0);
  }
  const headers = new Headers({ "content-type": "application/json" });
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  let response: Response;
  try {
    response = await providerFetch(`${origin}${path}`, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers,
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new UpshotRequestError(
      "Could not reach Upshot. Check your connection.",
      0,
    );
  }
  const data = (await response.json().catch(() => null)) as
    | (T & { error?: { message?: string; code?: string } })
    | null;
  if (!response.ok) {
    throw new UpshotRequestError(
      data?.error?.message ?? "Something went wrong. Try again.",
      response.status,
      data?.error?.code,
    );
  }
  return data as T;
}

// ---------- persistence ----------

/**
 * Fork: Upshot 1.0.0 signed in with email and password. Those sessions
 * can't use Upshot AI now (Google or Microsoft only, as Granola), so drop
 * them and show Sign in. Supabase puts the sign-in methods in the access
 * token's app_metadata.providers. A token that doesn't decode is kept.
 */
export function isPasswordOnlySession(accessToken: string): boolean {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return false;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const providers = (
      JSON.parse(json) as { app_metadata?: { providers?: unknown } }
    ).app_metadata?.providers;
    return (
      Array.isArray(providers) &&
      !providers.some((name) => name === "google" || name === "azure")
    );
  } catch {
    return false;
  }
}

/**
 * Fork: Google or Microsoft, the provider this account signed in with, so
 * Connect calendar asks the same one (grandmaster/sops/calendar-from-sign-in.md).
 * Supabase names it in the access token's app_metadata.provider.
 */
export function upshotAccountProvider(
  accessToken: string,
): UpshotOAuthProvider | null {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const appMetadata = (
      JSON.parse(json) as {
        app_metadata?: { provider?: unknown; providers?: unknown };
      }
    ).app_metadata;
    const names = [
      appMetadata?.provider,
      ...(Array.isArray(appMetadata?.providers) ? appMetadata.providers : []),
    ];
    return (
      names.find(
        (name): name is UpshotOAuthProvider =>
          name === "google" || name === "azure",
      ) ?? null
    );
  } catch {
    return null;
  }
}

function parseSession(raw: string | null): UpshotSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<UpshotSession>;
    if (
      typeof value.access_token === "string" &&
      isPasswordOnlySession(value.access_token)
    ) {
      return null;
    }
    return typeof value.access_token === "string" &&
      typeof value.refresh_token === "string" &&
      typeof value.expires_at === "number"
      ? {
          access_token: value.access_token,
          refresh_token: value.refresh_token,
          expires_at: value.expires_at,
          email: typeof value.email === "string" ? value.email : "",
        }
      : null;
  } catch {
    return null;
  }
}

let loading: Promise<void> | null = null;

/** Read the saved session from the Keychain once. */
export function ensureUpshotSessionLoaded(): Promise<void> {
  if (useUpshotAccount.getState().loaded) return Promise.resolve();
  loading ??= store2Commands
    .getSecret(SECRET_SCOPE, SECRET_KEY)
    .then((result) => {
      const session = result.status === "ok" ? parseSession(result.data) : null;
      useUpshotAccount.setState({ session, loaded: true });
    })
    .catch(() => {
      useUpshotAccount.setState({ loaded: true });
    });
  return loading;
}

async function saveSession(session: UpshotSession | null): Promise<void> {
  useUpshotAccount.setState({
    session,
    loaded: true,
    ...(session ? {} : { checkoutPendingSince: null }),
  });
  try {
    if (session) {
      await store2Commands.setSecret(
        SECRET_SCOPE,
        SECRET_KEY,
        JSON.stringify(session),
      );
    } else {
      await store2Commands.deleteSecret(SECRET_SCOPE, SECRET_KEY);
    }
  } catch {
    // The session still works for this launch; the Keychain may be locked.
  }
}

// ---------- sign in, sign up, refresh ----------

type WorkerSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email: string | null };
};

function toSession(data: WorkerSession, email: string): UpshotSession {
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    email: data.user?.email ?? email,
  };
}

export async function signInUpshot(
  mode: "signin" | "signup",
  email: string,
  password: string,
): Promise<void> {
  const data = await workerFetch<WorkerSession>(
    mode === "signup" ? "/auth/signup" : "/auth/login",
    { body: { email, password } },
  );
  await saveSession(toSession(data, email));
  useUpshotAccount.setState({ sessionEnded: false });
}

// ---------- Google and Microsoft sign-in ----------
//
// Fork: Upshot signs in only with Google or Microsoft, as Granola does
// ("Granola only supports Google and Microsoft single sign on":
// docs.granola.ai/help-center/getting-started/setting-up-granola-for-the-first-time).
// OAuth for a desktop app follows RFC 8252: the system browser, PKCE, and a
// loopback redirect to 127.0.0.1 (§7.3), served by the deeplink2 callback
// server, so it works on Mac, Windows and Linux without a URL scheme.

export type UpshotOAuthProvider = "google" | "azure";

type PendingOAuth = {
  verifier: string;
  /** Set for Connect calendar; the Worker keeps the calendar grant. */
  calendar?: { provider: UpshotOAuthProvider };
};
let pendingOAuth: PendingOAuth | null = null;

function base64Url(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** RFC 7636: a 43-character verifier and its S256 challenge. */
export async function createPkcePair(): Promise<{
  verifier: string;
  challenge: string;
}> {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

/**
 * Open Google or Microsoft sign-in in the browser. The browser comes back
 * to the loopback server, which emits the code as an /auth/callback deep
 * link; completeUpshotOAuth finishes it.
 */
export async function startUpshotOAuth(
  provider: UpshotOAuthProvider,
  deps: {
    startCallbackServer: () => Promise<number>;
    openUrl: (url: string) => Promise<void>;
  },
  // Fork: calendar access is asked later, from Connect calendar, not at
  // sign-in (Google's incremental authorization; Adam, Oct 5).
  options: { calendar?: boolean } = {},
): Promise<void> {
  const origin = upshotWorkerOrigin();
  if (!origin) {
    throw new UpshotRequestError("Sign-in is not available here.", 0);
  }
  const { verifier, challenge } = await createPkcePair();
  const port = await deps.startCallbackServer();
  const url = new URL(`${origin}/auth/oauth/start`);
  url.searchParams.set("provider", provider);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("redirect_to", `http://127.0.0.1:${port}/auth/callback`);
  if (options.calendar) url.searchParams.set("calendar", "1");
  pendingOAuth = options.calendar
    ? { verifier, calendar: { provider } }
    : { verifier };
  await deps.openUrl(url.toString());
}

export function cancelUpshotOAuth(): void {
  pendingOAuth = null;
}

export function isUpshotOAuthPending(): boolean {
  return pendingOAuth !== null;
}

/**
 * Swap the code from the browser for a session. Returns false when no
 * sign-in is waiting (the same code also arrives a second time through the
 * upshot:// link that brings the app to the front).
 */
export async function completeUpshotOAuth(code: string): Promise<boolean> {
  const pending = pendingOAuth;
  if (!pending) return false;
  pendingOAuth = null;
  const data = await workerFetch<WorkerSession>("/auth/oauth/exchange", {
    // Fork: the Worker is stateless between start and exchange, so Connect
    // calendar says what it asked for (grandmaster/worker calendar routes).
    body: pending.calendar
      ? {
          code,
          code_verifier: pending.verifier,
          provider: pending.calendar.provider,
          calendar: true,
        }
      : { code, code_verifier: pending.verifier },
  });
  await saveSession(toSession(data, data.user?.email ?? ""));
  useUpshotAccount.setState({ sessionEnded: false });
  return true;
}

export async function signOutUpshot(): Promise<void> {
  useUpshotAccount.setState({ sessionEnded: false });
  await saveSession(null);
}

/**
 * Delete the Upshot account on the Worker (Stripe customer, then the
 * Supabase user), then sign out on this Mac. Notes stay on the Mac.
 */
export async function deleteUpshotAccount(): Promise<void> {
  await upshotAuthedRequest<{ deleted: boolean }>("/account/delete", {
    method: "POST",
    body: {},
  });
  await signOutUpshot();
}

let refreshing: Promise<UpshotSession> | null = null;

async function refresh(session: UpshotSession): Promise<UpshotSession> {
  try {
    const data = await workerFetch<WorkerSession>("/auth/refresh", {
      body: { refresh_token: session.refresh_token },
    });
    const next = toSession(data, session.email);
    await saveSession(next);
    return next;
  } catch (error) {
    // Fork: only a rejected refresh token ends the session; a network or
    // Worker error keeps it and says what went wrong, instead of a false
    // "Sign in to continue." (journey-account-settings P2; NN/g #9).
    if (error instanceof UpshotRequestError && error.status === 401) {
      await saveSession(null);
      useUpshotAccount.setState({ sessionEnded: true });
      throw new UpshotRequestError(SESSION_ENDED, 401, "session_ended");
    }
    throw error;
  }
}

/**
 * A valid access token, refreshed when it is about to expire, or null when
 * signed out. Throws UpshotRequestError when the refresh fails (status 0
 * offline, 401 when the session ended).
 */
export async function getUpshotAccessToken(
  nowSeconds = Date.now() / 1000,
): Promise<string | null> {
  await ensureUpshotSessionLoaded();
  const session = useUpshotAccount.getState().session;
  if (!session) return null;
  if (session.expires_at - REFRESH_MARGIN_SECONDS > nowSeconds) {
    return session.access_token;
  }
  refreshing ??= refresh(session).finally(() => {
    refreshing = null;
  });
  return (await refreshing).access_token;
}

/**
 * The token Upshot transcription sends: fresh when possible, the saved one
 * when offline (the recording still saves its audio), null when signed out
 * or the session ended.
 */
export async function getUpshotSttToken(): Promise<string | null> {
  try {
    return await getUpshotAccessToken();
  } catch (error) {
    if (error instanceof UpshotRequestError && error.status === 401) {
      return null;
    }
    return useUpshotAccount.getState().session?.access_token ?? null;
  }
}

/** Call the Worker as the signed-in user. */
export async function upshotAuthedRequest<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = await getUpshotAccessToken();
  if (!token) throw new UpshotRequestError("Sign in to continue.", 401);
  return workerFetch<T>(path, { ...init, token });
}

// Fork: Upshot AI and Upshot transcription need a free account (Adam,
// Oct 5; Granola signs in at first launch).
export const SIGN_IN_REQUIRED = "Sign in to use Upshot AI. It's free.";
export const SIGN_IN_REQUIRED_STT =
  "Sign in to use Upshot transcription. It's free.";
export const SIGN_IN_REQUIRED_CODE = "sign_in_required";

/** True for the Worker's or the app's "sign in first" error. */
export function isSignInRequiredError(error: unknown): boolean {
  if (error instanceof UpshotRequestError) {
    return error.code === SIGN_IN_REQUIRED_CODE;
  }
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.startsWith("Sign in to use Upshot");
}

function signInRequiredResponse(): Response {
  return new Response(
    JSON.stringify({
      error: { message: SIGN_IN_REQUIRED, code: SIGN_IN_REQUIRED_CODE },
    }),
    { status: 401, headers: { "content-type": "application/json" } },
  );
}

/**
 * fetch for the Upshot AI LLM proxy: adds "Authorization: Bearer <access
 * token>" so the Worker knows the account (and Pro for a picked model).
 * Signed out, it answers like the Worker would, without a network call.
 */
export const upshotAuthFetch: typeof fetch = async (input, init) => {
  let token: string | null;
  try {
    token = await getUpshotAccessToken();
  } catch (error) {
    if (error instanceof UpshotRequestError && error.status === 401) {
      return signInRequiredResponse();
    }
    // Offline: let the request fail the usual way ("can't be reached").
    return providerFetch(input, init);
  }
  if (!token) return signInRequiredResponse();
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const response = await providerFetch(input, { ...init, headers });
  // The Worker's own message also tells old apps to update; this app only
  // needs to ask for sign-in.
  return response.status === 401 ? signInRequiredResponse() : response;
};

/** Test helper: forget the in-memory session and load state. */
export function resetUpshotAccountForTests(): void {
  loading = null;
  refreshing = null;
  useUpshotAccount.setState({
    session: null,
    loaded: false,
    checkoutPendingSince: null,
    sessionEnded: false,
  });
}
