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
};

export const useUpshotAccount = create<AccountState>(() => ({
  session: null,
  loaded: false,
  checkoutPendingSince: null,
}));

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

function parseSession(raw: string | null): UpshotSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<UpshotSession>;
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
}

export async function signOutUpshot(): Promise<void> {
  await saveSession(null);
}

let refreshing: Promise<UpshotSession | null> | null = null;

async function refresh(session: UpshotSession): Promise<UpshotSession | null> {
  try {
    const data = await workerFetch<WorkerSession>("/auth/refresh", {
      body: { refresh_token: session.refresh_token },
    });
    const next = toSession(data, session.email);
    await saveSession(next);
    return next;
  } catch (error) {
    // A rejected refresh token means the session is over; a network error
    // keeps it for the next try.
    if (error instanceof UpshotRequestError && error.status === 401) {
      await saveSession(null);
    }
    return null;
  }
}

/** A valid access token, refreshed when it is about to expire, or null. */
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
  return (await refreshing)?.access_token ?? null;
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

/**
 * fetch for the Upshot AI LLM proxy when a Pro model is picked: adds
 * "Authorization: Bearer <access token>" so the Worker can check Pro.
 * Auto requests use plain providerFetch and carry no token.
 */
export const upshotAuthFetch: typeof fetch = async (input, init) => {
  const token = await getUpshotAccessToken();
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else {
    headers.delete("Authorization");
  }
  return providerFetch(input, { ...init, headers });
};

/** Test helper: forget the in-memory session and load state. */
export function resetUpshotAccountForTests(): void {
  loading = null;
  refreshing = null;
  useUpshotAccount.setState({
    session: null,
    loaded: false,
    checkoutPendingSince: null,
  });
}
