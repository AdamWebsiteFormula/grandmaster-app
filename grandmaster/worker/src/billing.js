// Upshot Pro billing: Stripe Checkout in subscription mode, the customer
// portal, and webhooks that keep public.subscriptions in Supabase current.
//
// Sources:
// - docs.stripe.com/billing/subscriptions/build-subscriptions: Checkout
//   Session with mode=subscription, then provision from webhooks
//   (checkout.session.completed, customer.subscription.*, invoice.paid,
//   invoice.payment_failed).
// - docs.stripe.com/webhooks: verify the Stripe-Signature header (HMAC
//   SHA-256 over "t.payload", constant-time compare, 5-minute tolerance),
//   return 2xx fast, handle duplicates and out-of-order events.
// - docs.stripe.com/customer-management/integrate-customer-portal: a portal
//   session per request, for the customer on file.
// - docs.stripe.com/keys-best-practices: a restricted test key, held only
//   as a Worker secret.
// - supabase.com/docs/guides/api/api-keys: the secret key goes in the
//   `apikey` header (not Authorization) and bypasses RLS; server only.
//
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_MONTHLY,
// STRIPE_PRICE_YEARLY, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY,
// SUPABASE_SECRET_KEY.

import { getUser } from "./auth.js";
import { json, ok, rateLimited, readSmallJson } from "./http.js";

const STRIPE = "https://api.stripe.com/v1";
const SIGNATURE_TOLERANCE_SECONDS = 300;
const PRO_STATUSES = new Set(["active", "trialing"]);

export function isProStatus(status) {
  return PRO_STATUSES.has(status);
}

// ---------- Supabase (PostgREST) ----------

/**
 * Headers for public.subscriptions. The secret key bypasses RLS; without it
 * (not set yet) a user's own token can still read their row under RLS.
 */
function restHeaders(env, userToken) {
  if (env.SUPABASE_SECRET_KEY) {
    return { apikey: env.SUPABASE_SECRET_KEY };
  }
  if (userToken) {
    return {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${userToken}`,
    };
  }
  return null;
}

async function selectRow(env, filter, userToken) {
  const headers = restHeaders(env, userToken);
  if (!headers) throw new Error("SUPABASE_SECRET_KEY is not set");
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/subscriptions?${filter}&select=*&limit=1`,
    { headers: { ...headers, accept: "application/json" } },
  );
  if (!response.ok) throw new Error(`Supabase read ${response.status}`);
  const rows = await response.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

export function rowForUser(env, userId, userToken) {
  return selectRow(env, `user_id=eq.${encodeURIComponent(userId)}`, userToken);
}

function rowForCustomer(env, customerId) {
  return selectRow(
    env,
    `stripe_customer_id=eq.${encodeURIComponent(customerId)}`,
  );
}

async function upsertRow(env, row) {
  if (!env.SUPABASE_SECRET_KEY)
    throw new Error("SUPABASE_SECRET_KEY is not set");
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/subscriptions`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!response.ok) throw new Error(`Supabase upsert ${response.status}`);
}

// ---------- Stripe ----------

async function stripe(env, method, path, params) {
  const response = await fetch(`${STRIPE}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      ...(params
        ? { "content-type": "application/x-www-form-urlencoded" }
        : {}),
    },
    body: params ? params.toString() : undefined,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Stripe ${path} ${response.status}`);
  }
  return body;
}

/** API 2022-11-15 has the period end on the subscription; newer, on items. */
export function periodEnd(subscription) {
  const seconds =
    subscription?.current_period_end ??
    subscription?.items?.data?.[0]?.current_period_end;
  return Number.isFinite(seconds)
    ? new Date(seconds * 1000).toISOString()
    : null;
}

export function subscriptionInterval(subscription) {
  const item = subscription?.items?.data?.[0];
  return item?.price?.recurring?.interval ?? item?.plan?.interval ?? null;
}

function idOf(value) {
  return typeof value === "string" ? value : (value?.id ?? null);
}

/** The row to store for a Stripe subscription. */
export function rowFromSubscription(userId, subscription) {
  return {
    user_id: userId,
    status: subscription.status,
    stripe_customer_id: idOf(subscription.customer),
    stripe_subscription_id: subscription.id,
    current_period_end: periodEnd(subscription),
    updated_at: new Date().toISOString(),
  };
}

/** What the app sees. `subscription` (live from Stripe) adds the details. */
export function statusPayload(row, subscription = null) {
  return {
    pro: isProStatus(row?.status),
    status: row?.status ?? null,
    current_period_end: row?.current_period_end ?? null,
    interval: subscriptionInterval(subscription),
    cancel_at_period_end: subscription?.cancel_at_period_end === true,
  };
}

export function checkoutParams(env, origin, user, row, interval) {
  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set(
    "line_items[0][price]",
    interval === "year" ? env.STRIPE_PRICE_YEARLY : env.STRIPE_PRICE_MONTHLY,
  );
  params.set("line_items[0][quantity]", "1");
  params.set("client_reference_id", user.id);
  if (row?.stripe_customer_id) {
    params.set("customer", row.stripe_customer_id);
  } else if (user.email) {
    params.set("customer_email", user.email);
  }
  params.set("subscription_data[metadata][user_id]", user.id);
  params.set(
    "success_url",
    `${origin}/billing/done?session_id={CHECKOUT_SESSION_ID}`,
  );
  params.set("cancel_url", `${origin}/billing/cancel`);
  params.set("allow_promotion_codes", "false");
  return params;
}

// ---------- Webhook signature ----------

const encoder = new TextEncoder();

function toHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function signPayload(secret, timestamp, payload) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${payload}`),
  );
  return toHex(mac);
}

/** docs.stripe.com/webhooks#verify-manually */
export async function verifyStripeSignature(
  payload,
  header,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  if (!header || !secret) return false;
  let timestamp = null;
  const signatures = [];
  for (const part of header.split(",")) {
    const [key, value] = part.split("=", 2).map((s) => s?.trim());
    if (key === "t") timestamp = Number(value);
    if (key === "v1" && value) signatures.push(value);
  }
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }
  const expected = await signPayload(secret, timestamp, payload);
  return signatures.some((signature) => timingSafeEqual(signature, expected));
}

// ---------- Webhook events ----------

/** Store the latest state of a subscription for its user. */
async function syncSubscription(env, subscriptionId, userIdHint) {
  // Always re-fetch: the newest state wins whatever order events arrive in.
  const subscription = await stripe(
    env,
    "GET",
    `/subscriptions/${encodeURIComponent(subscriptionId)}`,
  );
  const customerId = idOf(subscription.customer);
  let userId = userIdHint || subscription.metadata?.user_id || null;
  let existing = null;
  if (userId) {
    existing = await rowForUser(env, userId);
  } else if (customerId) {
    existing = await rowForCustomer(env, customerId);
    userId = existing?.user_id ?? null;
  }
  if (!userId) return "no_user";
  // An old, ended subscription must not overwrite a newer active one.
  if (
    existing?.stripe_subscription_id &&
    existing.stripe_subscription_id !== subscription.id &&
    isProStatus(existing.status) &&
    !isProStatus(subscription.status)
  ) {
    return "stale";
  }
  await upsertRow(env, rowFromSubscription(userId, subscription));
  return "saved";
}

/** The subscription id on an invoice, for API 2022-11-15 and newer. */
export function invoiceSubscriptionId(invoice) {
  return (
    idOf(invoice?.subscription) ??
    idOf(invoice?.parent?.subscription_details?.subscription) ??
    null
  );
}

export async function handleEvent(env, event) {
  const object = event?.data?.object ?? {};
  switch (event?.type) {
    case "checkout.session.completed": {
      if (object.mode !== "subscription" || !object.subscription) {
        return "ignored";
      }
      return syncSubscription(
        env,
        idOf(object.subscription),
        object.client_reference_id,
      );
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return syncSubscription(env, object.id, null);
    case "invoice.paid":
    case "invoice.payment_failed": {
      const id = invoiceSubscriptionId(object);
      return id ? syncSubscription(env, id, null) : "ignored";
    }
    default:
      return "ignored";
  }
}

async function handleWebhook(request, env) {
  const payload = await request.text();
  if (payload.length > 512_000) return json(400, "Invalid request");
  const valid = await verifyStripeSignature(
    payload,
    request.headers.get("stripe-signature"),
    env.STRIPE_WEBHOOK_SECRET,
  );
  if (!valid) return json(400, "Invalid signature");
  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return json(400, "Invalid request");
  }
  try {
    const result = await handleEvent(env, event);
    return ok({ received: true, result });
  } catch {
    // 5xx: Stripe retries with backoff for up to three days.
    return json(500, "Could not process the event.");
  }
}

// ---------- Pages ----------

function page(title, line) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>
:root{color-scheme:dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#000;color:#f5f5f5;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}
main{max-width:420px;margin:24px;padding:32px;border:1px solid #262626;border-radius:16px;background:#0d0d0d;text-align:center}
.dot{width:12px;height:12px;border-radius:50%;background:#ff6a1f;margin:0 auto 20px}
h1{font-size:23px;line-height:1.3;margin:0 0 8px;text-wrap:balance}p{margin:0;color:#a3a3a3;font-size:13.3px}
</style></head><body><main><div class="dot"></div><h1>${line}</h1><p>Test mode: no real money was charged.</p></main></body></html>`;
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy":
        "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}

// ---------- Routes ----------

export async function handleBilling(request, env, pathname) {
  const method = request.method;
  // The Worker's own origin, e.g. https://upshot-ai.adam-694.workers.dev.
  const origin = new URL(request.url).origin;

  if (method === "GET" && pathname === "/billing/done") {
    return page("Upshot Pro", "You're on Upshot Pro. Go back to Upshot.");
  }
  if (method === "GET" && pathname === "/billing/cancel") {
    return page("Checkout canceled", "Checkout canceled. Go back to Upshot.");
  }
  if (method === "GET" && pathname === "/billing/done-portal") {
    return page("Upshot Pro", "Your plan is up to date. Go back to Upshot.");
  }
  if (method === "POST" && pathname === "/billing/webhook") {
    return handleWebhook(request, env);
  }

  const known =
    (method === "GET" && pathname === "/billing/status") ||
    (method === "POST" &&
      (pathname === "/billing/checkout" || pathname === "/billing/portal"));
  if (!known) return json(404, "Not found");

  if (await rateLimited(request, env, "billing")) {
    return json(429, "Too many requests. Try again in a minute.");
  }
  const user = await getUser(request, env);
  if (!user) return json(401, "Sign in to continue.");

  let row;
  try {
    row = await rowForUser(env, user.id, user.token);
  } catch {
    return json(503, "Billing is not available right now.");
  }

  if (pathname === "/billing/status") {
    // Interval and "ends at period end" are not stored; read them live.
    let subscription = null;
    if (isProStatus(row?.status) && row.stripe_subscription_id) {
      subscription = await stripe(
        env,
        "GET",
        `/subscriptions/${encodeURIComponent(row.stripe_subscription_id)}`,
      ).catch(() => null);
    }
    return ok(statusPayload(row, subscription));
  }

  if (pathname === "/billing/checkout") {
    const input = (await readSmallJson(request)) ?? {};
    const interval = input.interval ?? "month";
    if (interval !== "month" && interval !== "year") {
      return json(400, "Invalid request");
    }
    if (isProStatus(row?.status)) {
      return json(409, "You already have Upshot Pro.");
    }
    try {
      const session = await stripe(
        env,
        "POST",
        "/checkout/sessions",
        checkoutParams(env, origin, user, row, interval),
      );
      return ok({ url: session.url });
    } catch {
      return json(502, "Could not start checkout. Try again.");
    }
  }

  // /billing/portal
  if (!row?.stripe_customer_id) {
    return json(404, "No subscription to manage yet.");
  }
  try {
    const params = new URLSearchParams();
    params.set("customer", row.stripe_customer_id);
    params.set("return_url", `${origin}/billing/done-portal`);
    const session = await stripe(
      env,
      "POST",
      "/billing_portal/sessions",
      params,
    );
    return ok({ url: session.url });
  } catch {
    return json(502, "Could not open subscription settings. Try again.");
  }
}
