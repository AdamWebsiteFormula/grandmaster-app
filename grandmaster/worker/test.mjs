// Worker unit checks with Node built-ins only: node grandmaster/worker/test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CHECKOUT_API_VERSION,
  checkoutParams,
  handleEvent,
  invoiceSubscriptionId,
  periodEnd,
  signPayload,
  statusPayload,
  verifyStripeSignature,
} from "./src/billing.js";
import { clearAccountCacheForTests } from "./src/auth.js";
import {
  clearCalendarCacheForTests,
  decryptToken,
  encryptToken,
} from "./src/calendar.js";
import worker from "./src/index.js";
import {
  AUTO_MODEL,
  isProModelSlug,
  isProRow,
  resolveModel,
  verifyPro,
} from "./src/model.js";

// The app's AI SDK sends this header; the Worker refuses anything else.
const JSON_TYPE = { "content-type": "application/json" };

test("slug rule: only Anthropic, OpenAI and Google slugs", () => {
  assert.equal(isProModelSlug("anthropic/claude-sonnet-5.5"), true);
  assert.equal(isProModelSlug("openai/gpt-6.1-sol"), true);
  assert.equal(isProModelSlug("google/gemini-3.8-flash"), true);
  assert.equal(isProModelSlug("meta/llama-5"), false);
  assert.equal(isProModelSlug("openai/GPT-6"), false);
  assert.equal(isProModelSlug("openai/gpt-6:free"), false);
  assert.equal(isProModelSlug("openai/../x y"), false);
  assert.equal(isProModelSlug(42), false);
});

test("Auto or absent uses AUTO_MODEL at medium effort", () => {
  for (const model of ["Auto", undefined, null]) {
    assert.deepEqual(resolveModel(model, true), {
      model: AUTO_MODEL,
      reasoning: { effort: "medium" },
    });
  }
});

test("a verified Pro user gets a valid pick, with no reasoning field", () => {
  assert.deepEqual(resolveModel("openai/gpt-6.1-sol", true), {
    model: "openai/gpt-6.1-sol",
  });
  assert.equal(resolveModel("meta/llama-5", true).model, AUTO_MODEL);
});

test("no token means not Pro, so a pick falls back to Auto", async () => {
  assert.equal(await verifyPro(new Request("https://x/"), {}), false);
  assert.equal(resolveModel("openai/gpt-6.1-sol", false).model, AUTO_MODEL);
});

test("fetch handler forwards Auto and an allowlisted body", async () => {
  const realFetch = globalThis.fetch;
  let sent;
  globalThis.fetch = async (_url, init) => {
    sent = JSON.parse(init.body);
    return new Response("{}", {
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const env = {
      OPENROUTER_API_KEY: "test",
      RATE_LIMITER: { limit: async () => ({ success: true }) },
    REQUIRE_ACCOUNT: "0",
      REQUIRE_ACCOUNT: "0",
    };
    const body = JSON.stringify({
      model: "openai/gpt-6.1-sol",
      messages: [{ role: "user", content: "Hi" }],
      max_tokens: 99_999,
      tool_choice: "required",
      user: "drop me",
    });
    const response = await worker.fetch(
      new Request("https://w/llm/chat/completions", {
        method: "POST",
        headers: JSON_TYPE,
        body,
      }),
      env,
    );
    assert.equal(response.status, 200);
    assert.equal(sent.model, AUTO_MODEL);
    assert.deepEqual(sent.reasoning, { effort: "medium" });
    assert.equal(sent.max_tokens, 8000);
    assert.equal(sent.tool_choice, undefined);
    assert.equal(sent.user, undefined);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("error messages never ask for a key", async () => {
  const env = {
    OPENROUTER_API_KEY: "test",
    RATE_LIMITER: { limit: async () => ({ success: true }) },
    REQUIRE_ACCOUNT: "0",
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("", { status: 402 });
  try {
    const response = await worker.fetch(
      new Request("https://w/llm/chat/completions", {
        method: "POST",
        headers: JSON_TYPE,
        body: JSON.stringify({ messages: [{ role: "user", content: "Hi" }] }),
      }),
      env,
    );
    assert.equal(response.status, 402);
    const { error } = await response.json();
    assert.doesNotMatch(error.message, /key|Settings/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

// Fork: journey-after P2 "Chat provider error".
test("provider errors become plain sentences, never raw JSON", async () => {
  const env = {
    OPENROUTER_API_KEY: "test",
    RATE_LIMITER: { limit: async () => ({ success: true }) },
    REQUIRE_ACCOUNT: "0",
  };
  const realFetch = globalThis.fetch;
  const cases = [
    [429, 429, "Upshot AI is busy. Try again in a minute."],
    [500, 502, "Upshot AI had a problem answering. Try again."],
    [400, 502, "Upshot AI had a problem answering. Try again."],
  ];
  const realError = console.error;
  console.error = () => {};
  try {
    for (const [upstreamStatus, status, message] of cases) {
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({ error: { message: "Provider returned error" } }),
          { status: upstreamStatus },
        );
      const response = await worker.fetch(
        new Request("https://w/llm/chat/completions", {
          method: "POST",
          headers: JSON_TYPE,
          body: JSON.stringify({ messages: [{ role: "user", content: "Hi" }] }),
        }),
        env,
      );
      assert.equal(response.status, status);
      const { error } = await response.json();
      assert.equal(error.message, message);
      assert.doesNotMatch(error.message, /Provider returned/);
    }
  } finally {
    globalThis.fetch = realFetch;
    console.error = realError;
  }
});

// ---------- Accounts and Pro (billing.js, auth.js) ----------

const TOKEN = "eyJhbGciOiJIUzI1NiJ9.user-token.signature";
const baseEnv = {
  OPENROUTER_API_KEY: "test",
  RATE_LIMITER: { limit: async () => ({ success: true }) },
  REQUIRE_ACCOUNT: "0",
  SUPABASE_URL: "https://sb.test",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  SUPABASE_SECRET_KEY: "sb_secret_test",
  STRIPE_SECRET_KEY: "rk_test_x",
  STRIPE_WEBHOOK_SECRET: "whsec_test",
  STRIPE_PRICE_MONTHLY: "price_month",
  STRIPE_PRICE_YEARLY: "price_year",
};

/** Route fetch calls to handlers by URL prefix; record every call. */
function mockFetch(routes) {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    for (const [prefix, handler] of routes) {
      if (url.startsWith(prefix)) return handler(url, init);
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  return { calls, restore: () => (globalThis.fetch = realFetch) };
}

test("webhook signature: valid, wrong, stale", async () => {
  const payload = '{"id":"evt_1"}';
  const now = 1_800_000_000;
  const sig = await signPayload("whsec_test", now, payload);
  assert.equal(
    await verifyStripeSignature(
      payload,
      `t=${now},v1=${sig}`,
      "whsec_test",
      now,
    ),
    true,
  );
  // A rolled secret adds a second v1; either may match.
  assert.equal(
    await verifyStripeSignature(
      payload,
      `t=${now},v1=${"0".repeat(64)},v1=${sig}`,
      "whsec_test",
      now,
    ),
    true,
  );
  assert.equal(
    await verifyStripeSignature(
      payload,
      `t=${now},v1=${sig}`,
      "whsec_other",
      now,
    ),
    false,
  );
  assert.equal(
    await verifyStripeSignature(
      `${payload} `,
      `t=${now},v1=${sig}`,
      "whsec_test",
      now,
    ),
    false,
  );
  assert.equal(
    await verifyStripeSignature(
      payload,
      `t=${now},v1=${sig}`,
      "whsec_test",
      now + 301,
    ),
    false,
  );
  assert.equal(
    await verifyStripeSignature(payload, "", "whsec_test", now),
    false,
  );
});

test("webhook route: 400 on a bad signature, 200 on an unhandled type", async () => {
  const bad = await worker.fetch(
    new Request("https://w/billing/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=00" },
      body: "{}",
    }),
    baseEnv,
  );
  assert.equal(bad.status, 400);

  const payload = JSON.stringify({
    type: "customer.created",
    data: { object: {} },
  });
  const t = Math.floor(Date.now() / 1000);
  const sig = await signPayload("whsec_test", t, payload);
  const good = await worker.fetch(
    new Request("https://w/billing/webhook", {
      method: "POST",
      headers: { "stripe-signature": `t=${t},v1=${sig}` },
      body: payload,
    }),
    baseEnv,
  );
  assert.equal(good.status, 200);
  assert.equal((await good.json()).result, "ignored");
});

const subscriptionOld = {
  id: "sub_1",
  status: "active",
  customer: "cus_1",
  metadata: { user_id: "user-1" },
  current_period_end: 1_800_000_000,
  items: { data: [{ price: { recurring: { interval: "month" } } }] },
};
const subscriptionNew = {
  id: "sub_1",
  status: "active",
  customer: "cus_1",
  metadata: {},
  items: {
    data: [
      {
        current_period_end: 1_800_000_000,
        price: { recurring: { interval: "year" } },
      },
    ],
  },
};

for (const [shape, subscription] of [
  ["2022-11-15", subscriptionOld],
  ["newer", subscriptionNew],
]) {
  test(`webhook upsert maps a subscription (API ${shape})`, async () => {
    let upserted;
    const mock = mockFetch([
      [
        "https://api.stripe.com/v1/subscriptions/sub_1",
        () => Response.json(subscription),
      ],
      [
        "https://sb.test/rest/v1/subscriptions?",
        (url) =>
          Response.json(
            url.includes("stripe_customer_id=eq.cus_1")
              ? [{ user_id: "user-1" }]
              : [],
          ),
      ],
      [
        "https://sb.test/rest/v1/subscriptions",
        (_url, init) => {
          upserted = { body: JSON.parse(init.body), headers: init.headers };
          return new Response(null, { status: 201 });
        },
      ],
    ]);
    try {
      assert.equal(
        await handleEvent(baseEnv, {
          type: "customer.subscription.updated",
          data: { object: { id: "sub_1" } },
        }),
        "saved",
      );
      assert.equal(upserted.body.user_id, "user-1");
      assert.equal(upserted.body.status, "active");
      assert.equal(upserted.body.stripe_customer_id, "cus_1");
      assert.equal(upserted.body.stripe_subscription_id, "sub_1");
      assert.equal(
        upserted.body.current_period_end,
        "2027-01-15T08:00:00.000Z",
      );
      assert.equal(upserted.headers.apikey, "sb_secret_test");
      assert.equal(upserted.headers.authorization, undefined);
      assert.match(upserted.headers.prefer, /resolution=merge-duplicates/);
    } finally {
      mock.restore();
    }
  });
}

test("checkout.session.completed uses client_reference_id", async () => {
  let upserted;
  const mock = mockFetch([
    [
      "https://api.stripe.com/v1/subscriptions/sub_9",
      () => Response.json({ ...subscriptionNew, id: "sub_9" }),
    ],
    ["https://sb.test/rest/v1/subscriptions?", () => Response.json([])],
    [
      "https://sb.test/rest/v1/subscriptions",
      (_url, init) => {
        upserted = JSON.parse(init.body);
        return new Response(null, { status: 201 });
      },
    ],
  ]);
  try {
    await handleEvent(baseEnv, {
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          client_reference_id: "user-9",
          customer: "cus_1",
          subscription: "sub_9",
        },
      },
    });
    assert.equal(upserted.user_id, "user-9");
    assert.equal(upserted.stripe_subscription_id, "sub_9");
  } finally {
    mock.restore();
  }
});

test("an old canceled subscription never overwrites a newer active one", async () => {
  let wrote = false;
  const mock = mockFetch([
    [
      "https://api.stripe.com/v1/subscriptions/sub_old",
      () =>
        Response.json({
          ...subscriptionOld,
          id: "sub_old",
          status: "canceled",
        }),
    ],
    [
      "https://sb.test/rest/v1/subscriptions?",
      () =>
        Response.json([
          {
            user_id: "user-1",
            status: "active",
            stripe_subscription_id: "sub_new",
          },
        ]),
    ],
    [
      "https://sb.test/rest/v1/subscriptions",
      () => {
        wrote = true;
        return new Response(null, { status: 201 });
      },
    ],
  ]);
  try {
    const result = await handleEvent(baseEnv, {
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_old" } },
    });
    assert.equal(result, "stale");
    assert.equal(wrote, false);
  } finally {
    mock.restore();
  }
});

test("invoice subscription id for both API shapes", () => {
  assert.equal(invoiceSubscriptionId({ subscription: "sub_1" }), "sub_1");
  assert.equal(
    invoiceSubscriptionId({
      parent: { subscription_details: { subscription: "sub_2" } },
    }),
    "sub_2",
  );
  assert.equal(invoiceSubscriptionId({}), null);
  assert.equal(periodEnd({}), null);
});

test("checkout form encoding", () => {
  const user = { id: "user-1", email: "judge@example.com" };
  const params = checkoutParams(baseEnv, "https://w.dev", user, null, "year");
  assert.equal(params.get("mode"), "subscription");
  assert.equal(params.get("line_items[0][price]"), "price_year");
  assert.equal(params.get("line_items[0][quantity]"), "1");
  assert.equal(params.get("client_reference_id"), "user-1");
  assert.equal(params.get("customer_email"), "judge@example.com");
  assert.equal(params.get("customer"), null);
  assert.equal(params.get("subscription_data[metadata][user_id]"), "user-1");
  assert.equal(
    params.get("success_url"),
    "https://w.dev/billing/done?session_id={CHECKOUT_SESSION_ID}",
  );
  assert.equal(params.get("cancel_url"), "https://w.dev/billing/cancel");
  assert.equal(params.get("allow_promotion_codes"), "false");
  assert.match(params.toString(), /line_items%5B0%5D%5Bprice%5D=price_year/);

  const again = checkoutParams(
    baseEnv,
    "https://w.dev",
    user,
    { stripe_customer_id: "cus_1" },
    "month",
  );
  assert.equal(again.get("customer"), "cus_1");
  assert.equal(again.get("customer_email"), null);
  assert.equal(again.get("line_items[0][price]"), "price_month");
});

test("checkout branding, Link hidden, and the renewal terms", () => {
  const user = { id: "user-1", email: "judge@example.com" };
  const year = checkoutParams(baseEnv, "https://w.dev", user, null, "year");
  assert.equal(year.get("branding_settings[display_name]"), "Upshot");
  assert.equal(year.get("branding_settings[background_color]"), "#FFFFFF");
  assert.equal(year.get("branding_settings[button_color]"), "#C74200");
  assert.equal(year.get("branding_settings[font_family]"), "inter");
  assert.equal(year.get("branding_settings[border_style]"), "rounded");
  assert.equal(year.get("branding_settings[logo][type]"), "url");
  assert.equal(
    year.get("branding_settings[logo][url]"),
    "https://w.dev/brand/upshot-logo-orange-on-light.png",
  );
  // Stripe rejects a session with both a logo and an icon.
  assert.equal(year.get("branding_settings[icon][type]"), null);
  assert.equal(year.get("wallet_options[link][display]"), "never");
  assert.equal(year.get("payment_method_types[0]"), null);
  assert.match(
    year.get("custom_text[submit][message]"),
    /^\$132 today, then every year/,
  );
  const month = checkoutParams(baseEnv, "https://w.dev", user, null, "month");
  assert.match(
    month.get("custom_text[submit][message]"),
    /^\$14 today, then every month/,
  );
  assert.ok(month.get("custom_text[submit][message]").length <= 1200);
});

test("billing pages: white, logo, checkmark on success, a way back", async () => {
  const get = (path) => worker.fetch(new Request(`https://w${path}`), baseEnv);
  const done = await get("/billing/done?session_id=cs_test");
  const html = await done.text();
  assert.match(html, /background:#fff/);
  assert.match(
    html,
    /<img class="logo" src="\/brand\/upshot-logo-orange-on-light.png" alt="Upshot">/,
  );
  assert.match(html, /class="check"/);
  assert.match(html, /You're on Upshot Pro/);
  assert.match(
    html,
    /Pro turns on in Upshot within a minute. You can close this tab./,
  );
  assert.match(html, /href="upshot:\/\/">Open Upshot</);
  assert.match(html, /class="note">Test mode/);
  assert.match(html, /<a href="\/privacy">Privacy policy<\/a>/);
  assert.match(done.headers.get("content-security-policy"), /img-src 'self'/);

  const cancel = await (await get("/billing/cancel")).text();
  assert.match(cancel, /Checkout canceled/);
  assert.match(cancel, /Nothing was charged./);
  assert.doesNotMatch(cancel, /class="check"/);
  assert.match(cancel, /upshot-logo-orange-on-light.png/);
  assert.match(cancel, /href="\/privacy"/);

  const portal = await (await get("/billing/done-portal")).text();
  assert.match(portal, /Your plan is up to date/);
  assert.doesNotMatch(portal, /class="dot"/);
});

test("status mapping", () => {
  assert.deepEqual(statusPayload(null), {
    pro: false,
    status: null,
    current_period_end: null,
    interval: null,
    cancel_at_period_end: false,
  });
  for (const [status, pro] of [
    ["active", true],
    ["trialing", true],
    ["past_due", false],
    ["canceled", false],
    ["incomplete", false],
  ]) {
    assert.equal(statusPayload({ status }).pro, pro);
  }
  const live = statusPayload(
    { status: "active" },
    {
      ...subscriptionNew,
      cancel_at_period_end: true,
    },
  );
  assert.equal(live.interval, "year");
  assert.equal(live.cancel_at_period_end, true);
});

function proRoutes(status) {
  return [
    [
      "https://sb.test/auth/v1/user",
      (_url, init) =>
        init.headers.authorization === `Bearer ${TOKEN}` &&
        init.headers.apikey === "sb_publishable_test"
          ? Response.json({ id: "user-1", email: "judge@example.com" })
          : new Response("{}", { status: 401 }),
    ],
    [
      "https://sb.test/rest/v1/subscriptions?",
      () => Response.json(status ? [{ user_id: "user-1", status }] : []),
    ],
  ];
}

async function chatModelFor({ token, status, model, upstreamStatus = 200 }) {
  let sent;
  const mock = mockFetch([
    ...proRoutes(status),
    [
      "https://openrouter.ai/",
      (_url, init) => {
        sent = JSON.parse(init.body);
        return Response.json({}, { status: upstreamStatus });
      },
    ],
  ]);
  try {
    const headers = token
      ? { ...JSON_TYPE, authorization: `Bearer ${token}` }
      : JSON_TYPE;
    const response = await worker.fetch(
      new Request("https://w/llm/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Hi" }],
        }),
      }),
      baseEnv,
    );
    return { sent, calls: mock.calls, response };
  } finally {
    mock.restore();
  }
}

test("LLM Pro gating: only a verified Pro user gets the picked model", async () => {
  const pro = await chatModelFor({
    token: TOKEN,
    status: "active",
    model: "openai/gpt-6.1-sol",
  });
  assert.equal(pro.sent.model, "openai/gpt-6.1-sol");
  assert.equal(pro.sent.reasoning, undefined);

  for (const args of [
    { token: TOKEN, status: "canceled", model: "openai/gpt-6.1-sol" },
    { token: TOKEN, status: null, model: "openai/gpt-6.1-sol" },
    { token: null, status: "active", model: "openai/gpt-6.1-sol" },
    {
      token: "bad-token-but-long-enough-x",
      status: "active",
      model: "openai/gpt-6.1-sol",
    },
    { token: TOKEN, status: "active", model: "meta/llama-5" },
  ]) {
    const { sent } = await chatModelFor(args);
    assert.equal(sent.model, AUTO_MODEL, JSON.stringify(args));
  }

  // Auto never calls Supabase.
  const auto = await chatModelFor({
    token: TOKEN,
    status: "active",
    model: "Auto",
  });
  assert.equal(auto.sent.model, AUTO_MODEL);
  assert.equal(auto.calls.filter((c) => c.url.includes("sb.test")).length, 0);
});

test("billing status needs a token and reads the row", async () => {
  const mock = mockFetch(proRoutes("trialing"));
  try {
    const anon = await worker.fetch(
      new Request("https://w/billing/status"),
      baseEnv,
    );
    assert.equal(anon.status, 401);
    const response = await worker.fetch(
      new Request("https://w/billing/status", {
        headers: { authorization: `Bearer ${TOKEN}` },
      }),
      baseEnv,
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.pro, true);
    assert.equal(body.status, "trialing");
  } finally {
    mock.restore();
  }
});

test("checkout route posts form data to Stripe and returns the url", async () => {
  let form;
  const mock = mockFetch([
    ...proRoutes(null),
    [
      "https://api.stripe.com/v1/checkout/sessions?",
      () => Response.json({ data: [] }),
    ],
    [
      "https://api.stripe.com/v1/checkout/sessions",
      (_url, init) => {
        form = new URLSearchParams(init.body);
        assert.equal(init.headers.authorization, "Bearer rk_test_x");
        assert.equal(init.headers["stripe-version"], CHECKOUT_API_VERSION);
        return Response.json({
          url: "https://checkout.stripe.com/c/pay/cs_test",
        });
      },
    ],
  ]);
  try {
    const response = await worker.fetch(
      new Request("https://upshot.test/billing/checkout", {
        method: "POST",
        headers: { authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ interval: "year" }),
      }),
      baseEnv,
    );
    assert.deepEqual(await response.json(), {
      url: "https://checkout.stripe.com/c/pay/cs_test",
    });
    assert.equal(form.get("line_items[0][price]"), "price_year");
    assert.equal(form.get("cancel_url"), "https://upshot.test/billing/cancel");
  } finally {
    mock.restore();
  }
});

// journey-account-settings P2 "already_pro" and P3 "one subscription".
function checkoutRequest() {
  return new Request("https://upshot.test/billing/checkout", {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ interval: "month" }),
  });
}

function rowRoute(row) {
  return [
    "https://sb.test/rest/v1/subscriptions?",
    () => Response.json(row ? [row] : []),
  ];
}

test("checkout: a Pro row answers 409 with code already_pro", async () => {
  const mock = mockFetch(proRoutes("active"));
  try {
    const response = await worker.fetch(checkoutRequest(), baseEnv);
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.error.code, "already_pro");
    assert.equal(body.error.message, "You already have Upshot Pro.");
    assert.equal(
      mock.calls.filter((c) => c.url.includes("api.stripe.com")).length,
      0,
    );
  } finally {
    mock.restore();
  }
});

test("checkout: a live Stripe subscription before the webhook is already_pro", async () => {
  let created = false;
  const mock = mockFetch([
    proRoutes(null)[0],
    rowRoute({
      user_id: "user-1",
      status: "canceled",
      stripe_customer_id: "cus_1",
    }),
    [
      "https://api.stripe.com/v1/subscriptions?",
      (url) => {
        const query = new URL(url).searchParams;
        assert.equal(query.get("customer"), "cus_1");
        return Response.json({ data: [{ id: "sub_2", status: "active" }] });
      },
    ],
    [
      "https://api.stripe.com/v1/checkout/sessions",
      () => {
        created = true;
        return Response.json({ url: "https://checkout.stripe.com/x" });
      },
    ],
  ]);
  try {
    const response = await worker.fetch(checkoutRequest(), baseEnv);
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, "already_pro");
    assert.equal(created, false);
  } finally {
    mock.restore();
  }
});

test("checkout: earlier open sessions are expired before a new one", async () => {
  const expired = [];
  const mock = mockFetch([
    proRoutes(null)[0],
    rowRoute(null),
    [
      "https://api.stripe.com/v1/checkout/sessions?",
      (url) => {
        const query = new URL(url).searchParams;
        assert.equal(query.get("status"), "open");
        assert.equal(query.get("customer"), null);
        return Response.json({
          data: [
            { id: "cs_mine", client_reference_id: "user-1" },
            { id: "cs_other", client_reference_id: "user-2" },
          ],
        });
      },
    ],
    [
      "https://api.stripe.com/v1/checkout/sessions/",
      (url, init) => {
        assert.equal(init.method, "POST");
        expired.push(url.split("/").at(-2));
        return Response.json({});
      },
    ],
    [
      "https://api.stripe.com/v1/checkout/sessions",
      () => Response.json({ url: "https://checkout.stripe.com/new" }),
    ],
  ]);
  try {
    const response = await worker.fetch(checkoutRequest(), baseEnv);
    assert.equal(response.status, 200);
    assert.deepEqual(expired, ["cs_mine"]);
  } finally {
    mock.restore();
  }
});

test("checkout: Stripe list errors never block a new checkout", async () => {
  const mock = mockFetch([
    proRoutes(null)[0],
    rowRoute({ user_id: "user-1", status: null, stripe_customer_id: "cus_1" }),
    [
      "https://api.stripe.com/v1/subscriptions?",
      () => new Response("{}", { status: 500 }),
    ],
    [
      "https://api.stripe.com/v1/checkout/sessions?",
      () => new Response("{}", { status: 500 }),
    ],
    [
      "https://api.stripe.com/v1/checkout/sessions",
      () => Response.json({ url: "https://checkout.stripe.com/new" }),
    ],
  ]);
  try {
    const response = await worker.fetch(checkoutRequest(), baseEnv);
    assert.equal(response.status, 200);
  } finally {
    mock.restore();
  }
});

// journey-account-settings P3 "account removal".
function deleteRequest(token = TOKEN) {
  return new Request("https://upshot.test/account/delete", {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

test("account delete: Stripe customer first, then the Supabase user", async () => {
  const order = [];
  const mock = mockFetch([
    proRoutes(null)[0],
    rowRoute({
      user_id: "user-1",
      status: "active",
      stripe_customer_id: "cus_1",
    }),
    [
      "https://api.stripe.com/v1/customers/cus_1",
      (_url, init) => {
        assert.equal(init.method, "DELETE");
        order.push("stripe");
        return Response.json({ deleted: true });
      },
    ],
    [
      "https://sb.test/auth/v1/admin/users/user-1",
      (_url, init) => {
        assert.equal(init.method, "DELETE");
        assert.equal(init.headers.apikey, "sb_secret_test");
        order.push("supabase");
        return Response.json({});
      },
    ],
  ]);
  try {
    const response = await worker.fetch(deleteRequest(), baseEnv);
    assert.equal(response.status, 200);
    assert.deepEqual(order, ["stripe", "supabase"]);
  } finally {
    mock.restore();
  }
});

test("account delete: keeps the account when billing can't be stopped", async () => {
  let deletedUser = false;
  const mock = mockFetch([
    proRoutes(null)[0],
    rowRoute({
      user_id: "user-1",
      status: "active",
      stripe_customer_id: "cus_1",
    }),
    [
      "https://api.stripe.com/v1/customers/cus_1",
      () => new Response("{}", { status: 500 }),
    ],
    [
      "https://sb.test/auth/v1/admin/users/",
      () => {
        deletedUser = true;
        return Response.json({});
      },
    ],
  ]);
  try {
    const response = await worker.fetch(deleteRequest(), baseEnv);
    assert.equal(response.status, 502);
    assert.match((await response.json()).error.message, /account was kept/);
    assert.equal(deletedUser, false);
  } finally {
    mock.restore();
  }
});

test("account delete: no customer skips Stripe; no token is 401", async () => {
  const mock = mockFetch([
    proRoutes(null)[0],
    rowRoute(null),
    ["https://sb.test/auth/v1/admin/users/user-1", () => Response.json({})],
  ]);
  try {
    assert.equal(
      (await worker.fetch(deleteRequest(null), baseEnv)).status,
      401,
    );
    const response = await worker.fetch(deleteRequest(), baseEnv);
    assert.equal(response.status, 200);
    assert.equal(
      mock.calls.filter((c) => c.url.includes("api.stripe.com/v1/customers"))
        .length,
      0,
    );
  } finally {
    mock.restore();
  }
});

test("webhook after account deletion is ignored, not retried", async () => {
  const mock = mockFetch([
    [
      "https://api.stripe.com/v1/subscriptions/sub_9",
      () =>
        Response.json({
          id: "sub_9",
          status: "canceled",
          customer: "cus_9",
          metadata: { user_id: "gone-user" },
        }),
    ],
    ["https://sb.test/rest/v1/subscriptions?", () => Response.json([])],
    [
      "https://sb.test/rest/v1/subscriptions",
      () => new Response('{"code":"23503"}', { status: 409 }),
    ],
  ]);
  try {
    assert.equal(
      await handleEvent(baseEnv, {
        type: "customer.subscription.deleted",
        data: { object: { id: "sub_9" } },
      }),
      "orphan",
    );
    // A canceled subscription needs no cancel call.
    assert.equal(
      mock.calls.filter((c) => c.init.method === "DELETE").length,
      0,
    );
  } finally {
    mock.restore();
  }
});

test("auth: wrong password gets a plain message; sign-up is gone", async () => {
  const mock = mockFetch([
    [
      "https://sb.test/auth/v1/token?grant_type=password",
      () =>
        Response.json(
          {
            error: "invalid_grant",
            error_description: "Invalid login credentials",
          },
          { status: 400 },
        ),
    ],
  ]);
  const post = (path) =>
    worker.fetch(
      new Request(`https://w${path}`, {
        method: "POST",
        body: JSON.stringify({
          email: "judge@example.com",
          password: "password123",
        }),
      }),
      baseEnv,
    );
  try {
    const login = await post("/auth/login");
    assert.equal(login.status, 400);
    assert.deepEqual(await login.json(), {
      error: { message: "Wrong email or password." },
    });
    // Fork: new accounts come only from Google or Microsoft.
    const signup = await post("/auth/signup");
    assert.equal(signup.status, 410);
    const gone = await signup.json();
    assert.equal(gone.error.code, "use_google_or_microsoft");
    assert.match(gone.error.message, /releases\/latest/);
    assert.ok(!mock.calls.some((call) => call.url.includes("/signup")));
  } finally {
    mock.restore();
  }
});

test("auth: login forwards to Supabase and validates input", async () => {
  const mock = mockFetch([
    [
      "https://sb.test/auth/v1/token?grant_type=password",
      (_url, init) => {
        assert.equal(init.headers.apikey, "sb_publishable_test");
        return Response.json({
          access_token: "a",
          refresh_token: "r",
          expires_at: 123,
          user: { id: "user-1", email: "judge@example.com" },
        });
      },
    ],
  ]);
  try {
    const bad = await worker.fetch(
      new Request("https://w/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "nope", password: "x" }),
      }),
      baseEnv,
    );
    assert.equal(bad.status, 400);
    const good = await worker.fetch(
      new Request("https://w/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "Judge@Example.com",
          password: "password123",
        }),
      }),
      baseEnv,
    );
    assert.deepEqual(await good.json(), {
      access_token: "a",
      refresh_token: "r",
      expires_at: 123,
      user: { id: "user-1", email: "judge@example.com" },
    });
  } finally {
    mock.restore();
  }
});

// CalOPPA §22575(b): the privacy page lists what it must, and Workers
// static assets serve public/privacy.html at /privacy (html_handling
// "auto-trailing-slash"), so the Worker script never sees the path.
test("privacy policy: served from public/ with the CalOPPA items", async () => {
  const { readFile } = await import("node:fs/promises");
  const html = await readFile(
    new URL("./public/privacy.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /<title>Upshot privacy policy<\/title>/);
  assert.match(html, /src="\/brand\/upshot-logo-orange-on-light.png"/);
  assert.match(html, /background:#fff/);
  assert.match(html, /Effective October 6, 2026/);
  assert.match(html, /Limited Use requirements/);
  assert.match(html, /sign in with Google or Microsoft/);
  for (const heading of [
    "What leaves your computer, and who gets it",
    "Your choices and rights",
    "Do Not Track",
    "Changes to this policy",
    "How long we keep it",
    "Who we are",
  ]) {
    assert.match(html, new RegExp(`<h2>${heading}</h2>`));
  }
  for (const name of [
    "OpenRouter",
    "Supabase",
    "Stripe",
    "Cloudflare",
    "Deepgram",
  ]) {
    assert.match(html, new RegExp(name));
  }
  assert.match(html, /Settings › Profile › Delete account/);
  assert.match(html, /~\/Library\/Application Support\/anarlog\//);
  // Upshot ships for Mac, Windows and Linux (owner, Oct 3): every data path is listed.
  assert.match(html, /%APPDATA%\\anarlog\\/);
  assert.match(html, /~\/.local\/share\/anarlog\//);
  // American spelling in the page text (the source comment cites ico.org.uk URLs).
  assert.doesNotMatch(
    html.split("</head>")[1],
    /\b(colour|centre|behaviour|organis|analys|licence|cancelled|grey|favourite|catalogue)/i,
  );
  const config = await readFile(
    new URL("./wrangler.jsonc", import.meta.url),
    "utf8",
  );
  assert.match(config, /"directory": "\.\/public"/);
  assert.doesNotMatch(config, /"html_handling"/);
  // Only the video runs through the Worker first (media.js answers its byte ranges).
  assert.deepEqual([...config.matchAll(/"run_worker_first": (\[[^\]]*\]|\w+)/g)].map((m) => m[1]), ['["/media/*"]']);
});

// ---------- Hardening (Oct 3) ----------

function chatRequest(body, headers = JSON_TYPE) {
  return new Request("https://w/llm/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

test("chat: only application/json reaches OpenRouter (no preflight-free POST)", async () => {
  const mock = mockFetch([["https://openrouter.ai/", () => Response.json({})]]);
  try {
    const messages = [{ role: "user", content: "Hi" }];
    for (const headers of [{}, { "content-type": "text/plain" }]) {
      const response = await worker.fetch(
        chatRequest({ messages }, headers),
        baseEnv,
      );
      assert.equal(response.status, 415);
      assert.equal((await response.json()).error.message, "Invalid request");
    }
    assert.equal(mock.calls.length, 0);
    const ok = await worker.fetch(
      chatRequest(
        { messages },
        { "content-type": "application/json; charset=utf-8" },
      ),
      baseEnv,
    );
    assert.equal(ok.status, 200);
  } finally {
    mock.restore();
  }
});

test("chat: image and file parts are dropped; only text reaches the model", async () => {
  const mock = mockFetch([["https://openrouter.ai/", () => Response.json({})]]);
  try {
    for (const part of [
      { type: "image_url", image_url: { url: "https://x.test/big.png" } },
      { type: "file", file: { file_data: "https://x.test/big.pdf" } },
      { type: "input_audio" },
      null,
    ]) {
      const response = await worker.fetch(
        chatRequest({
          messages: [
            { role: "user", content: [{ type: "text", text: "Hi" }, part] },
          ],
        }),
        baseEnv,
      );
      // A note with a pasted picture still gets its summary (owner test,
      // Oct 4); the picture never leaves the Worker.
      assert.equal(response.status, 200, JSON.stringify(part));
    }
    assert.equal(mock.calls.length, 4);
    for (const call of mock.calls) {
      const sent = JSON.parse(call.init.body);
      assert.deepEqual(sent.messages[0].content, [{ type: "text", text: "Hi" }]);
    }
    const pictureOnly = await worker.fetch(
      chatRequest({
        messages: [
          {
            role: "user",
            content: [{ type: "image_url", image_url: { url: "https://x.test/a.png" } }],
          },
        ],
      }),
      baseEnv,
    );
    assert.equal(pictureOnly.status, 200);
    assert.deepEqual(JSON.parse(mock.calls.at(-1).init.body).messages[0].content, [
      { type: "text", text: "(image omitted)" },
    ]);
    const ok = await worker.fetch(
      chatRequest({
        messages: [
          { role: "system", content: "Be brief." },
          { role: "user", content: [{ type: "text", text: "Hi" }] },
        ],
      }),
      baseEnv,
    );
    assert.equal(ok.status, 200);
  } finally {
    mock.restore();
  }
});

test("slug rule: non-chat models and dated snapshots run on Auto", () => {
  for (const slug of [
    "openai/gpt-6-image",
    "google/gemma-4-27b",
    "openai/gpt-6-sol-search",
    "openai/codex-6",
    "openai/chatgpt-4o-latest",
    "openai/gpt-4o-2024-11-20",
    "anthropic/claude-opus-5.5-20260922",
    "openai/gpt-3.5-turbo-0613",
  ]) {
    assert.equal(isProModelSlug(slug), false, slug);
    assert.equal(resolveModel(slug, true).model, AUTO_MODEL, slug);
  }
  assert.equal(isProModelSlug("anthropic/claude-opus-5.5"), true);
  assert.equal(isProModelSlug("google/gemini-3.8-flash-lite"), true);
});

test("Pro row: a period that ended over 2 days ago is not Pro", async () => {
  const now = Date.parse("2026-10-03T12:00:00Z");
  const day = 24 * 60 * 60 * 1000;
  const at = (ms) => new Date(ms).toISOString();
  assert.equal(isProRow({ status: "active" }, now), true);
  assert.equal(
    isProRow({ status: "active", current_period_end: null }, now),
    true,
  );
  assert.equal(
    isProRow({ status: "active", current_period_end: at(now + 20 * day) }, now),
    true,
  );
  assert.equal(
    isProRow({ status: "trialing", current_period_end: at(now - day) }, now),
    true,
  );
  assert.equal(
    isProRow({ status: "active", current_period_end: at(now - 3 * day) }, now),
    false,
  );
  // PostgREST reads timestamptz back with an offset.
  assert.equal(
    isProRow(
      { status: "active", current_period_end: "2026-09-29T08:00:00+00:00" },
      now,
    ),
    false,
  );
  assert.equal(
    isProRow({ status: "canceled", current_period_end: at(now + day) }, now),
    false,
  );

  const mock = mockFetch([
    proRoutes(null)[0],
    rowRoute({
      user_id: "user-1",
      status: "active",
      current_period_end: "2020-01-01T00:00:00+00:00",
    }),
  ]);
  try {
    const request = new Request("https://w/", {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    assert.equal(await verifyPro(request, baseEnv), false);
  } finally {
    mock.restore();
  }
});

test("chat: a retired Pro model says to switch to Auto; Auto keeps the generic line", async () => {
  const realError = console.error;
  console.error = () => {};
  try {
    for (const upstreamStatus of [400, 404]) {
      const pro = await chatModelFor({
        token: TOKEN,
        status: "active",
        model: "openai/gpt-6.1-sol",
        upstreamStatus,
      });
      assert.equal(pro.sent.model, "openai/gpt-6.1-sol");
      assert.equal(pro.response.status, 400);
      assert.equal(
        (await pro.response.json()).error.message,
        "This model isn't available anymore. Switch to Auto.",
      );
      const auto = await chatModelFor({
        token: null,
        status: null,
        model: "Auto",
        upstreamStatus,
      });
      assert.equal(auto.response.status, 502);
      assert.equal(
        (await auto.response.json()).error.message,
        "Upshot AI had a problem answering. Try again.",
      );
    }
  } finally {
    console.error = realError;
  }
});

test("rate limit: 60 requests a minute per IP", async () => {
  const { readFile } = await import("node:fs/promises");
  const config = await readFile(
    new URL("./wrangler.jsonc", import.meta.url),
    "utf8",
  );
  assert.match(config, /"simple": \{ "limit": 60, "period": 60 \}/);
});

test("account delete: open Checkout Sessions expire before the customer goes", async () => {
  const order = [];
  const mock = mockFetch([
    proRoutes(null)[0],
    rowRoute({
      user_id: "user-1",
      status: "active",
      stripe_customer_id: "cus_1",
    }),
    [
      "https://api.stripe.com/v1/checkout/sessions?",
      (url) => {
        assert.match(url, /status=open/);
        assert.match(url, /customer=cus_1/);
        return Response.json({ data: [{ id: "cs_open" }] });
      },
    ],
    [
      "https://api.stripe.com/v1/checkout/sessions/cs_open/expire",
      () => {
        order.push("expire");
        return Response.json({});
      },
    ],
    [
      "https://api.stripe.com/v1/customers/cus_1",
      () => {
        order.push("customer");
        return Response.json({ deleted: true });
      },
    ],
    [
      "https://sb.test/auth/v1/admin/users/user-1",
      () => {
        order.push("user");
        return Response.json({});
      },
    ],
  ]);
  try {
    const response = await worker.fetch(deleteRequest(), baseEnv);
    assert.equal(response.status, 200);
    assert.deepEqual(order, ["expire", "customer", "user"]);
  } finally {
    mock.restore();
  }
});

test("webhook: a live subscription for a deleted account is canceled", async () => {
  const realError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args.join(" "));
  try {
    for (const cancelStatus of [200, 403]) {
      const mock = mockFetch([
        [
          "https://api.stripe.com/v1/subscriptions/sub_9",
          (_url, init) =>
            init.method === "DELETE"
              ? Response.json({}, { status: cancelStatus })
              : Response.json({
                  id: "sub_9",
                  status: "active",
                  customer: "cus_9",
                  metadata: { user_id: "gone-user" },
                }),
        ],
        ["https://sb.test/rest/v1/subscriptions?", () => Response.json([])],
        [
          "https://sb.test/rest/v1/subscriptions",
          () => new Response('{"code":"23503"}', { status: 409 }),
        ],
      ]);
      try {
        assert.equal(
          await handleEvent(baseEnv, {
            type: "customer.subscription.created",
            data: { object: { id: "sub_9" } },
          }),
          "orphan",
        );
        assert.equal(
          mock.calls.filter((c) => c.init.method === "DELETE").length,
          1,
        );
      } finally {
        mock.restore();
      }
    }
    // A key without Subscriptions write: logged, and the event still succeeds.
    assert.equal(logged.length, 1);
    assert.match(logged[0], /orphan subscription not canceled/);
  } finally {
    console.error = realError;
  }
});

// ---------- Upshot transcription (/stt) ----------

const sttEnv = {
  DEEPGRAM_API_KEY: "dg-test",
  RATE_LIMITER: { limit: async () => ({ success: true }) },
  REQUIRE_ACCOUNT: "0",
};

async function withFetch(handler, run) {
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  };
  try {
    await run(calls);
  } finally {
    globalThis.fetch = realFetch;
  }
}

test("stt: a missing DEEPGRAM_API_KEY is a clear 503, never a crash", async () => {
  for (const init of [
    { headers: { upgrade: "websocket" } },
    { method: "POST", headers: { "content-type": "audio/wav" }, body: "x" },
  ]) {
    const response = await worker.fetch(
      new Request("https://w/stt/listen?model=cloud", init),
      { RATE_LIMITER: sttEnv.RATE_LIMITER },
    );
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.error.code, "stt_unavailable");
    assert.match(body.error.message, /Upshot transcription isn't available/);
  }
});

test("stt live: WebSocket goes to Deepgram with the server key and allowlisted params", async () => {
  const socket = { webSocket: {}, status: 101 };
  await withFetch(
    () => socket,
    async (calls) => {
      const response = await worker.fetch(
        new Request(
          "https://w/stt/listen?model=nova-3&channels=2&sample_rate=16000&encoding=linear16&diarize=true&interim_results=true&multichannel=true&language=en&keyterm=Upshot&callback=https://evil.test&tag=x",
          { headers: { upgrade: "websocket", authorization: "Token " } },
        ),
        sttEnv,
      );
      assert.equal(response, socket);
      const sent = new URL(calls[0].url);
      assert.equal(
        sent.origin + sent.pathname,
        "https://api.deepgram.com/v1/listen",
      );
      assert.equal(calls[0].init.headers.authorization, "Token dg-test");
      assert.equal(calls[0].init.headers.upgrade, "websocket");
      assert.equal(sent.searchParams.get("model"), "nova-3");
      assert.equal(sent.searchParams.get("channels"), "2");
      assert.equal(sent.searchParams.get("encoding"), "linear16");
      assert.equal(sent.searchParams.get("language"), "en");
      assert.equal(sent.searchParams.get("keyterm"), "Upshot");
      assert.equal(sent.searchParams.get("mip_opt_out"), "true");
      assert.equal(sent.searchParams.has("callback"), false);
      assert.equal(sent.searchParams.has("tag"), false);
    },
  );
});

test("stt: non-Deepgram or meta models run on nova-3", async () => {
  const { sttModel } = await import("./src/stt.js");
  assert.equal(sttModel("cloud"), "nova-3");
  assert.equal(sttModel("flux-general-en"), "nova-3");
  assert.equal(sttModel(null), "nova-3");
  assert.equal(sttModel("nova-2"), "nova-2");
  assert.equal(sttModel("nova-3-medical"), "nova-3-medical");
});

test("stt live: Deepgram refusing the key is a 503, busy is a 429", async () => {
  for (const [status, expected] of [
    [401, 503],
    [402, 503],
    [429, 429],
    [500, 503],
  ]) {
    await withFetch(
      () => new Response("{}", { status }),
      async () => {
        const response = await worker.fetch(
          new Request("https://w/stt/listen?model=cloud", {
            headers: { upgrade: "websocket" },
          }),
          sttEnv,
        );
        assert.equal(response.status, expected);
      },
    );
  }
});

test("stt batch: the recorded file streams to Deepgram pre-recorded", async () => {
  await withFetch(
    () => Response.json({ metadata: {}, results: { channels: [] } }),
    async (calls) => {
      const response = await worker.fetch(
        new Request(
          "https://w/stt/listen?model=cloud&channels=2&sample_rate=48000&language=en&language=es&keyword=Upshot&num_speakers=3",
          {
            method: "POST",
            headers: { "content-type": "audio/wav", authorization: "Bearer " },
            body: "RIFF",
          },
        ),
        sttEnv,
      );
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        metadata: {},
        results: { channels: [] },
      });
      const sent = new URL(calls[0].url);
      assert.equal(calls[0].init.method, "POST");
      assert.equal(calls[0].init.headers.authorization, "Token dg-test");
      assert.equal(calls[0].init.headers["content-type"], "audio/wav");
      assert.equal(sent.searchParams.get("model"), "nova-3");
      assert.equal(sent.searchParams.get("multichannel"), "true");
      assert.equal(sent.searchParams.get("diarize"), "true");
      assert.equal(sent.searchParams.get("mip_opt_out"), "true");
      assert.deepEqual(sent.searchParams.getAll("detect_language"), [
        "true",
        "en",
        "es",
      ]);
      assert.equal(sent.searchParams.has("language"), false);
      assert.equal(sent.searchParams.get("keyterm"), "Upshot");
      assert.equal(sent.searchParams.has("sample_rate"), false);
      assert.equal(sent.searchParams.has("num_speakers"), false);
    },
  );
});

test("stt: browsers, other paths, methods and body types are refused", async () => {
  await withFetch(
    () => {
      throw new Error("must not reach Deepgram");
    },
    async () => {
      const cases = [
        [
          new Request("https://w/stt/listen", {
            headers: { upgrade: "websocket", origin: "https://evil.test" },
          }),
          403,
        ],
        [
          new Request("https://w/stt/listen", {
            method: "POST",
            headers: { "content-type": "text/plain" },
            body: "x",
          }),
          415,
        ],
        [new Request("https://w/stt/listen"), 405],
        [new Request("https://w/stt/other", { method: "POST" }), 404],
      ];
      for (const [request, status] of cases) {
        assert.equal((await worker.fetch(request, sttEnv)).status, status);
      }
      const limited = await worker.fetch(
        new Request("https://w/stt/listen", {
          headers: { upgrade: "websocket" },
        }),
        {
          ...sttEnv,
          RATE_LIMITER: { limit: async () => ({ success: false }) },
        },
      );
      assert.equal(limited.status, 429);
    },
  );
});

// ---------- Free account required (Adam, Oct 5): Google or Microsoft ----------

const GOOGLE_TOKEN = "eyJhbGciOiJIUzI1NiJ9.google-user.signature";
const PASSWORD_TOKEN = "eyJhbGciOiJIUzI1NiJ9.password-user.signature";
const accountEnv = {
  OPENROUTER_API_KEY: "test",
  DEEPGRAM_API_KEY: "dg-test",
  RATE_LIMITER: { limit: async () => ({ success: true }) },
  USER_RATE_LIMITER: { limit: async () => ({ success: true }) },
  SUPABASE_URL: "https://sb.test",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};

function supabaseUser(url, init) {
  const auth = new Headers(init?.headers).get("authorization");
  if (auth === `Bearer ${GOOGLE_TOKEN}`) {
    return Response.json({
      id: "u-google",
      email: "pat@example.com",
      app_metadata: { provider: "google", providers: ["google"] },
    });
  }
  if (auth === `Bearer ${PASSWORD_TOKEN}`) {
    return Response.json({
      id: "u-password",
      email: "pat@example.com",
      app_metadata: { provider: "email", providers: ["email"] },
    });
  }
  return Response.json({ msg: "invalid JWT" }, { status: 401 });
}

const accountChatRequest = (headers = {}) =>
  new Request("https://w/llm/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ model: "Auto", messages: [{ role: "user", content: "hi" }] }),
  });

test("account: chat without a session is 401 with the download link, and costs nothing", async () => {
  clearAccountCacheForTests();
  const mock = mockFetch([["https://sb.test/auth/v1/user", supabaseUser]]);
  try {
    for (const headers of [{}, { authorization: "Bearer not-a-real-token-at-all-xx" }]) {
      const response = await worker.fetch(accountChatRequest(headers), accountEnv);
      assert.equal(response.status, 401);
      const body = await response.json();
      assert.equal(body.error.code, "sign_in_required");
      assert.match(body.error.message, /^Sign in to use Upshot AI and transcription/);
      assert.match(
        body.error.message,
        /https:\/\/github\.com\/AdamWebsiteFormula\/grandmaster-app\/releases\/latest/,
      );
    }
    assert.ok(!mock.calls.some((call) => call.url.includes("openrouter")));
  } finally {
    mock.restore();
  }
});

test("account: a password-only account is refused; Google or Microsoft is required", async () => {
  clearAccountCacheForTests();
  const mock = mockFetch([["https://sb.test/auth/v1/user", supabaseUser]]);
  try {
    const response = await worker.fetch(
      accountChatRequest({ authorization: `Bearer ${PASSWORD_TOKEN}` }),
      accountEnv,
    );
    assert.equal(response.status, 401);
  } finally {
    mock.restore();
  }
});

test("account: a Google account reaches OpenRouter with the server key; Supabase is asked once a minute", async () => {
  clearAccountCacheForTests();
  const mock = mockFetch([
    ["https://sb.test/auth/v1/user", supabaseUser],
    ["https://openrouter.ai/", () => Response.json({ choices: [] })],
  ]);
  try {
    for (let i = 0; i < 2; i++) {
      const response = await worker.fetch(
        accountChatRequest({ authorization: `Bearer ${GOOGLE_TOKEN}` }),
        accountEnv,
      );
      assert.equal(response.status, 200);
    }
    const upstream = mock.calls.filter((call) => call.url.includes("openrouter"));
    assert.equal(upstream.length, 2);
    assert.equal(upstream[0].init.headers.authorization, "Bearer test");
    assert.equal(
      mock.calls.filter((call) => call.url.includes("/auth/v1/user")).length,
      1,
    );
  } finally {
    mock.restore();
  }
});

test("account: the per-account limit answers 429 in plain words", async () => {
  clearAccountCacheForTests();
  const keys = [];
  const env = {
    ...accountEnv,
    USER_RATE_LIMITER: {
      limit: async ({ key }) => {
        keys.push(key);
        return { success: false };
      },
    },
  };
  const mock = mockFetch([["https://sb.test/auth/v1/user", supabaseUser]]);
  try {
    const response = await worker.fetch(
      accountChatRequest({ authorization: `Bearer ${GOOGLE_TOKEN}` }),
      env,
    );
    assert.equal(response.status, 429);
    assert.match((await response.json()).error.message, /a lot/);
    assert.deepEqual(keys, ["chat:u-google"]);
  } finally {
    mock.restore();
  }
});

test("account: transcription takes the session as Token and never forwards it", async () => {
  clearAccountCacheForTests();
  await withFetch(
    (url, init) => {
      if (url.startsWith("https://sb.test/auth/v1/user")) return supabaseUser(url, init);
      return Object.assign(new Response(null, { status: 200 }), { webSocket: {} });
    },
    async (calls) => {
      const signedOut = await worker.fetch(
        new Request("https://w/stt/listen?model=cloud", {
          headers: { upgrade: "websocket" },
        }),
        accountEnv,
      );
      assert.equal(signedOut.status, 401);
      assert.equal((await signedOut.json()).error.code, "sign_in_required");

      await worker.fetch(
        new Request("https://w/stt/listen?model=cloud", {
          headers: { upgrade: "websocket", authorization: `Token ${GOOGLE_TOKEN}` },
        }),
        accountEnv,
      );
      const deepgram = calls.find((call) => call.url.startsWith("https://api.deepgram.com"));
      assert.ok(deepgram);
      assert.equal(deepgram.init.headers.authorization, "Token dg-test");
    },
  );
});

test("oauth start: only Google or Microsoft, a PKCE challenge and a loopback redirect", async () => {
  const challenge = "a".repeat(43);
  const start = (query) =>
    worker.fetch(new Request(`https://w/auth/oauth/start?${query}`), accountEnv);
  const good = await start(
    `provider=azure&code_challenge=${challenge}&redirect_to=${encodeURIComponent("http://127.0.0.1:51234/auth/callback")}`,
  );
  assert.equal(good.status, 302);
  const location = new URL(good.headers.get("location"));
  assert.equal(location.origin + location.pathname, "https://sb.test/auth/v1/authorize");
  assert.equal(location.searchParams.get("provider"), "azure");
  assert.equal(location.searchParams.get("code_challenge"), challenge);
  assert.equal(location.searchParams.get("code_challenge_method"), "s256");
  assert.equal(location.searchParams.get("scopes"), "email");
  assert.equal(
    location.searchParams.get("redirect_to"),
    "http://127.0.0.1:51234/auth/callback",
  );
  for (const query of [
    `provider=github&code_challenge=${challenge}&redirect_to=${encodeURIComponent("http://127.0.0.1:5/auth/callback")}`,
    `provider=google&code_challenge=short&redirect_to=${encodeURIComponent("http://127.0.0.1:51234/auth/callback")}`,
    `provider=google&code_challenge=${challenge}&redirect_to=${encodeURIComponent("https://evil.example/auth/callback")}`,
    `provider=google&code_challenge=${challenge}&redirect_to=${encodeURIComponent("http://127.0.0.1.evil.example:80/auth/callback")}`,
  ]) {
    assert.equal((await start(query)).status, 400, query);
  }
});

test("oauth exchange: the code and verifier go to Supabase's PKCE token grant", async () => {
  let sent;
  const mock = mockFetch([
    [
      "https://sb.test/auth/v1/token?grant_type=pkce",
      (url, init) => {
        sent = JSON.parse(init.body);
        return sent.auth_code === "good-code-123"
          ? Response.json({
              access_token: "access",
              refresh_token: "refresh",
              expires_in: 3600,
              user: { id: "u-google", email: "pat@example.com" },
            })
          : Response.json({ error_code: "flow_state_not_found" }, { status: 404 });
      },
    ],
  ]);
  const exchange = (code) =>
    worker.fetch(
      new Request("https://w/auth/oauth/exchange", {
        method: "POST",
        body: JSON.stringify({ code, code_verifier: "v".repeat(43) }),
      }),
      accountEnv,
    );
  try {
    const good = await exchange("good-code-123");
    assert.equal(good.status, 200);
    const session = await good.json();
    assert.equal(session.user.email, "pat@example.com");
    assert.deepEqual(sent, { auth_code: "good-code-123", code_verifier: "v".repeat(43) });
    const bad = await exchange("stale-code-456");
    assert.equal(bad.status, 400);
    assert.equal((await bad.json()).error.message, "Sign-in didn't finish. Try again.");
  } finally {
    mock.restore();
  }
});

// ---------- Calendar through the Upshot account (calendar.js) ----------

const CAL_KEY = Buffer.from(new Uint8Array(32).fill(7)).toString("base64");
const calendarEnv = {
  ...accountEnv,
  CALENDAR_GOOGLE: "1",
  CALENDAR_OUTLOOK: "1",
  SUPABASE_SECRET_KEY: "sb_secret_test",
  CALENDAR_TOKEN_KEY: CAL_KEY,
  GOOGLE_CLIENT_ID: "g-client",
  GOOGLE_CLIENT_SECRET: "g-secret",
  MICROSOFT_CLIENT_ID: "m-client",
  MICROSOFT_CLIENT_SECRET: "m-secret",
};

function calendarFetch(rows, extra = []) {
  return mockFetch([
    ["https://sb.test/auth/v1/user", supabaseUser],
    [
      "https://sb.test/rest/v1/calendar_connections",
      (url, init) => {
        if ((init.method ?? "GET") === "GET") return Response.json(rows);
        if (init.method === "POST") rows.push(JSON.parse(init.body));
        return new Response(null, { status: 204 });
      },
    ],
    ...extra,
  ]);
}

const calendarPost = (path, body) =>
  worker.fetch(
    new Request(`https://w${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${GOOGLE_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }),
    calendarEnv,
  );

test("calendar: refresh tokens are stored encrypted and round-trip", async () => {
  const sealed = await encryptToken(calendarEnv, "1//refresh-secret");
  assert.ok(!sealed.includes("refresh-secret"));
  assert.equal(await decryptToken(calendarEnv, sealed), "1//refresh-secret");
  assert.notEqual(await encryptToken(calendarEnv, "1//refresh-secret"), sealed);
});

test("calendar: routes need the Upshot session", async () => {
  clearAccountCacheForTests();
  const mock = calendarFetch([]);
  try {
    const response = await worker.fetch(
      new Request("https://w/nango/connections"),
      calendarEnv,
    );
    assert.equal(response.status, 401);
  } finally {
    mock.restore();
  }
});

test("calendar: connections list the stored providers in the upstream shape", async () => {
  clearAccountCacheForTests();
  const rows = [
    { provider: "google", refresh_token: "x", email: "pat@example.com" },
    { provider: "azure", refresh_token: "y", email: "pat@example.com" },
  ];
  const mock = calendarFetch(rows);
  try {
    const response = await worker.fetch(
      new Request("https://w/nango/connections", {
        headers: { authorization: `Bearer ${GOOGLE_TOKEN}` },
      }),
      calendarEnv,
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      connections: [
        { integration_id: "google-calendar", connection_id: "google-calendar" },
        { integration_id: "outlook", connection_id: "outlook" },
      ],
    });
    const rowRead = mock.calls.find((c) => c.url.includes("calendar_connections"));
    assert.match(rowRead.url, /user_id=eq\.u-google/);
    assert.equal(rowRead.init.headers.apikey, "sb_secret_test");
  } finally {
    mock.restore();
  }
});

test("calendar: Google events go to the Calendar API with a refreshed token and mapped params", async () => {
  clearAccountCacheForTests();
  clearCalendarCacheForTests();
  const rows = [
    {
      provider: "google",
      refresh_token: await encryptToken(calendarEnv, "1//g-refresh"),
      email: "pat@example.com",
    },
  ];
  let refreshBody;
  const mock = calendarFetch(rows, [
    [
      "https://oauth2.googleapis.com/token",
      (url, init) => {
        refreshBody = new URLSearchParams(init.body);
        return Response.json({ access_token: "g-access", expires_in: 3600 });
      },
    ],
    [
      "https://www.googleapis.com/calendar/v3/",
      () => Response.json({ kind: "calendar#events", items: [{ id: "e1" }] }),
    ],
  ]);
  try {
    const response = await calendarPost("/calendar/google/list-events", {
      connection_id: "google-calendar",
      calendar_id: "primary",
      time_min: "2026-10-05T00:00:00Z",
      time_max: "2026-10-12T00:00:00Z",
      max_results: 250,
      single_events: true,
      order_by: "startTime",
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).items[0].id, "e1");
    assert.equal(refreshBody.get("refresh_token"), "1//g-refresh");
    assert.equal(refreshBody.get("client_secret"), "g-secret");
    const api = mock.calls.find((c) => c.url.startsWith("https://www.googleapis.com/"));
    const url = new URL(api.url);
    assert.equal(url.pathname, "/calendar/v3/calendars/primary/events");
    assert.equal(url.searchParams.get("timeMin"), "2026-10-05T00:00:00Z");
    assert.equal(url.searchParams.get("singleEvents"), "true");
    assert.equal(url.searchParams.get("orderBy"), "startTime");
    assert.equal(url.searchParams.get("maxResults"), "250");
    assert.equal(api.init.headers.authorization, "Bearer g-access");
  } finally {
    mock.restore();
  }
});

test("calendar: Outlook uses calendarView with a time window, and keeps a rotated refresh token", async () => {
  clearAccountCacheForTests();
  clearCalendarCacheForTests();
  const rows = [
    {
      provider: "azure",
      refresh_token: await encryptToken(calendarEnv, "m-refresh-1"),
      email: "pat@example.com",
    },
  ];
  const mock = calendarFetch(rows, [
    [
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      () =>
        Response.json({
          access_token: "m-access",
          refresh_token: "m-refresh-2",
          expires_in: 3600,
        }),
    ],
    ["https://graph.microsoft.com/", () => Response.json({ value: [] })],
  ]);
  try {
    const response = await calendarPost("/calendar/outlook/list-events", {
      connection_id: "outlook",
      calendar_id: "AAMk==",
      time_min: "2026-10-05T00:00:00Z",
      time_max: "2026-10-12T00:00:00Z",
      max_results: 50,
      order_by: "startTime",
    });
    assert.equal(response.status, 200);
    const api = mock.calls.find((c) => c.url.startsWith("https://graph.microsoft.com/"));
    assert.match(api.url, /\/me\/calendars\/AAMk%3D%3D\/calendarView\?startDateTime=/);
    assert.match(api.url, /\$top=50/);
    assert.match(api.url, /\$orderby=start%2FdateTime/);
    const saved = rows.at(-1);
    assert.equal(saved.provider, "azure");
    assert.equal(await decryptToken(calendarEnv, saved.refresh_token), "m-refresh-2");
  } finally {
    mock.restore();
  }
});

test("calendar: a revoked grant is 424 and the stored token is removed", async () => {
  clearAccountCacheForTests();
  clearCalendarCacheForTests();
  const rows = [
    {
      provider: "google",
      refresh_token: await encryptToken(calendarEnv, "1//revoked"),
      email: null,
    },
  ];
  const mock = calendarFetch(rows, [
    [
      "https://oauth2.googleapis.com/token",
      () => Response.json({ error: "invalid_grant" }, { status: 400 }),
    ],
  ]);
  try {
    const response = await calendarPost("/calendar/google/list-calendars", {
      connection_id: "google-calendar",
    });
    assert.equal(response.status, 424);
    assert.equal((await response.json()).error.code, "calendar_reconnect");
    assert.ok(mock.calls.some((c) => c.init?.method === "DELETE"));
  } finally {
    mock.restore();
  }
});

test("calendar: bad input and mismatched connections are refused", async () => {
  clearAccountCacheForTests();
  const mock = calendarFetch([]);
  try {
    for (const [path, body] of [
      ["/calendar/google/list-calendars", { connection_id: "outlook" }],
      ["/calendar/google/list-events", { connection_id: "google-calendar" }],
      ["/calendar/google/list-events", { connection_id: "google-calendar", calendar_id: "primary", time_min: "yesterday" }],
      ["/calendar/outlook/list-events", { connection_id: "outlook", calendar_id: "x", order_by: "drop table" }],
    ]) {
      assert.equal((await calendarPost(path, body)).status, 400, path);
    }
  } finally {
    mock.restore();
  }
});

test("oauth: calendar=1 asks for read-only calendar access with a refresh token", async () => {
  const challenge = "a".repeat(43);
  const redirect = encodeURIComponent("http://127.0.0.1:51234/auth/callback");
  const start = async (provider, extra = "") =>
    new URL(
      (
        await worker.fetch(
          new Request(
            `https://w/auth/oauth/start?provider=${provider}&code_challenge=${challenge}&redirect_to=${redirect}${extra}`,
          ),
          { ...accountEnv, CALENDAR_GOOGLE: "1", CALENDAR_OUTLOOK: "1" },
        )
      ).headers.get("location"),
    ).searchParams;
  const google = await start("google", "&calendar=1");
  assert.equal(google.get("scopes"), "https://www.googleapis.com/auth/calendar.readonly");
  assert.equal(google.get("access_type"), "offline");
  assert.equal(google.get("prompt"), "consent");
  assert.equal(google.get("include_granted_scopes"), "true");
  assert.equal((await start("azure", "&calendar=1")).get("scopes"), "email offline_access Calendars.Read");
  const plain = await start("google");
  assert.equal(plain.get("scopes"), null);
  assert.equal(plain.get("access_type"), null);
});

test("oauth exchange: a calendar grant keeps the refresh token server side only", async () => {
  const rows = [];
  const mock = calendarFetch(rows, [
    [
      "https://sb.test/auth/v1/token?grant_type=pkce",
      () =>
        Response.json({
          access_token: "access",
          refresh_token: "refresh",
          expires_in: 3600,
          provider_token: "g-access",
          provider_refresh_token: "1//g-refresh",
          user: { id: "u-google", email: "pat@example.com" },
        }),
    ],
  ]);
  const exchange = (extra) =>
    worker.fetch(
      new Request("https://w/auth/oauth/exchange", {
        method: "POST",
        body: JSON.stringify({ code: "good-code-123", code_verifier: "v".repeat(43), ...extra }),
      }),
      calendarEnv,
    );
  try {
    const signIn = await exchange({ provider: "google" });
    assert.equal(rows.length, 0, "plain sign-in stores nothing");
    const connect = await exchange({ provider: "google", calendar: true });
    const session = await connect.json();
    assert.equal(signIn.status, 200);
    assert.ok(!JSON.stringify(session).includes("1//g-refresh"));
    assert.ok(!("provider_refresh_token" in session));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].user_id, "u-google");
    assert.equal(await decryptToken(calendarEnv, rows[0].refresh_token), "1//g-refresh");
  } finally {
    mock.restore();
  }
});

// ---------- Google sign-in that returns to upshotnotes.com ----------

const STATE_KEY = Buffer.from(new Uint8Array(32).fill(9)).toString("base64");
const googleEnv = {
  ...calendarEnv,
  OAUTH_STATE_KEY: STATE_KEY,
  PUBLIC_ORIGIN: "https://upshotnotes.com",
};
const LOOPBACK = "http://127.0.0.1:51234/auth/callback";

async function pkce() {
  const verifier = "v".repeat(10) + "x".repeat(33);
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
  );
  const challenge = Buffer.from(digest).toString("base64url");
  return { verifier, challenge };
}

async function googleStart(challenge, extra = "") {
  const response = await worker.fetch(
    new Request(
      `https://w/auth/oauth/start?provider=google&code_challenge=${challenge}&redirect_to=${encodeURIComponent(LOOPBACK)}${extra}`,
    ),
    googleEnv,
  );
  assert.equal(response.status, 302);
  return new URL(response.headers.get("location"));
}

test("google: sign-in goes to Google with Upshot's own callback, not Supabase's", async () => {
  const { challenge } = await pkce();
  const to = await googleStart(challenge);
  assert.equal(to.origin + to.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(to.searchParams.get("redirect_uri"), "https://upshotnotes.com/auth/google/callback");
  assert.equal(to.searchParams.get("client_id"), "g-client");
  assert.equal(to.searchParams.get("scope"), "openid email profile");
  assert.equal(to.searchParams.get("access_type"), null);
  assert.match(to.searchParams.get("nonce"), /^[0-9a-f]{64}$/);
  const state = to.searchParams.get("state");
  assert.ok(!state.includes("127.0.0.1"), "state is sealed");
  const cal = await googleStart(challenge, "&calendar=1");
  assert.match(cal.searchParams.get("scope"), /calendar\.readonly/);
  assert.equal(cal.searchParams.get("access_type"), "offline");
  assert.equal(cal.searchParams.get("include_granted_scopes"), "true");
});

test("google: callback signs in to Supabase with the ID token and only the app's verifier opens the hand-off", async () => {
  clearAccountCacheForTests();
  const rows = [];
  const { verifier, challenge } = await pkce();
  const to = await googleStart(challenge, "&calendar=1");
  let supabaseBody;
  const mock = calendarFetch(rows, [
    [
      "https://oauth2.googleapis.com/token",
      (url, init) => {
        const form = new URLSearchParams(init.body);
        assert.equal(form.get("redirect_uri"), "https://upshotnotes.com/auth/google/callback");
        assert.equal(form.get("client_secret"), "g-secret");
        return Response.json({
          id_token: "google.id.token",
          access_token: "g-access",
          refresh_token: "1//g-refresh",
          expires_in: 3600,
        });
      },
    ],
    [
      "https://sb.test/auth/v1/token?grant_type=id_token",
      (url, init) => {
        supabaseBody = JSON.parse(init.body);
        return Response.json({
          access_token: "sb-access",
          refresh_token: "sb-refresh",
          expires_in: 3600,
          user: { id: "u-google", email: "pat@example.com" },
        });
      },
    ],
  ]);
  try {
    const callback = await worker.fetch(
      new Request(
        `https://upshotnotes.com/auth/google/callback?code=g-code&state=${encodeURIComponent(to.searchParams.get("state"))}`,
      ),
      googleEnv,
    );
    assert.equal(callback.status, 302);
    const back = new URL(callback.headers.get("location"));
    assert.equal(back.origin + back.pathname, LOOPBACK);
    const code = back.searchParams.get("code");
    assert.ok(code.startsWith("u1."));
    assert.ok(!code.includes("sb-access"), "the hand-off is sealed");
    assert.equal(supabaseBody.provider, "google");
    assert.equal(supabaseBody.id_token, "google.id.token");
    // Google got the SHA-256 of the raw nonce Supabase receives.
    const hashed = Buffer.from(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(supabaseBody.nonce)),
    ).toString("hex");
    assert.equal(hashed, to.searchParams.get("nonce"));
    assert.equal(rows.length, 1, "calendar refresh token kept server side");

    const exchange = (v) =>
      worker.fetch(
        new Request("https://w/auth/oauth/exchange", {
          method: "POST",
          body: JSON.stringify({ code, code_verifier: v }),
        }),
        googleEnv,
      );
    const wrong = await exchange("w".repeat(43));
    assert.equal(wrong.status, 400);
    const good = await exchange(verifier);
    assert.equal(good.status, 200);
    const session = await good.json();
    assert.equal(session.access_token, "sb-access");
    assert.equal(session.user.email, "pat@example.com");
    assert.ok(!JSON.stringify(session).includes("1//g-refresh"));
  } finally {
    mock.restore();
  }
});

test("google: a canceled sign-in goes back to the app without a code; a forged state is refused", async () => {
  const { challenge } = await pkce();
  const to = await googleStart(challenge);
  const canceled = await worker.fetch(
    new Request(
      `https://upshotnotes.com/auth/google/callback?error=access_denied&state=${encodeURIComponent(to.searchParams.get("state"))}`,
    ),
    googleEnv,
  );
  const back = new URL(canceled.headers.get("location"));
  assert.equal(back.searchParams.get("code"), null);
  assert.equal(back.searchParams.get("error"), "access_denied");
  const forged = await worker.fetch(
    new Request("https://upshotnotes.com/auth/google/callback?code=x&state=AAAA"),
    googleEnv,
  );
  assert.equal(forged.status, 400);
  assert.match(await forged.text(), /Sign-in expired/);
});

test("google: without the Worker secrets, sign-in still uses the Supabase flow", async () => {
  const { challenge } = await pkce();
  const response = await worker.fetch(
    new Request(
      `https://w/auth/oauth/start?provider=google&code_challenge=${challenge}&redirect_to=${encodeURIComponent(LOOPBACK)}`,
    ),
    accountEnv,
  );
  assert.match(response.headers.get("location"), /^https:\/\/sb\.test\/auth\/v1\/authorize/);
});

test("home page: describes Upshot and links the privacy policy (Google brand review)", async () => {
  const { readFile } = await import("node:fs/promises");
  const html = await readFile(new URL("./public/index.html", import.meta.url), "utf8");
  assert.match(html, /<title>Upshot<\/title>/);
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /releases\/latest/);
  const config = await readFile(new URL("./wrangler.jsonc", import.meta.url), "utf8");
  assert.match(config, /"PUBLIC_ORIGIN": "https:\/\/upshotnotes\.com"/);
});


test("calendar switch: providers are off unless their var is 1, and off means no consent screen", async () => {
  const off = await worker.fetch(new Request("https://w/calendar/providers"), accountEnv);
  assert.equal(off.status, 200);
  assert.deepEqual(await off.json(), { google: false, outlook: false });
  assert.match(off.headers.get("cache-control"), /max-age=300/);
  const on = await worker.fetch(new Request("https://w/calendar/providers"), {
    ...accountEnv,
    CALENDAR_GOOGLE: "1",
  });
  assert.deepEqual(await on.json(), { google: true, outlook: false });

  const challenge = "a".repeat(43);
  const redirect = encodeURIComponent("http://127.0.0.1:51234/auth/callback");
  for (const provider of ["google", "azure"]) {
    const blocked = await worker.fetch(
      new Request(`https://w/auth/oauth/start?provider=${provider}&code_challenge=${challenge}&redirect_to=${redirect}&calendar=1`),
      accountEnv,
    );
    assert.equal(blocked.status, 404, provider);
    assert.equal((await blocked.json()).error.code, "calendar_unavailable");
    const signIn = await worker.fetch(
      new Request(`https://w/auth/oauth/start?provider=${provider}&code_challenge=${challenge}&redirect_to=${redirect}`),
      accountEnv,
    );
    assert.equal(signIn.status, 302, "plain sign-in is never blocked");
  }
});

test("media: the home page video answers byte ranges with 206, as Safari needs", async () => {
  const bytes = new Uint8Array(100).map((_, i) => i);
  const env = { ASSETS: { fetch: async (req) => (new URL(req.url).pathname === "/media/v.mp4" && !req.headers.get("Range")
    ? new Response(bytes, { headers: { "Content-Type": "video/mp4" } })
    : new Response("not found", { status: 404 })) } };
  const get = (range) => worker.fetch(new Request("https://upshotnotes.com/media/v.mp4", range ? { headers: { Range: range } } : {}), env);
  let r = await get("bytes=10-19");
  assert.equal(r.status, 206);
  assert.equal(r.headers.get("Content-Range"), "bytes 10-19/100");
  assert.equal(r.headers.get("Content-Type"), "video/mp4");
  assert.deepEqual([...new Uint8Array(await r.arrayBuffer())], [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  r = await get("bytes=90-");
  assert.equal(r.headers.get("Content-Range"), "bytes 90-99/100");
  r = await get("bytes=-5");
  assert.equal(r.headers.get("Content-Range"), "bytes 95-99/100");
  r = await get("bytes=200-300");
  assert.equal(r.status, 416);
  r = await get(null);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("Accept-Ranges"), "bytes");
  r = await worker.fetch(new Request("https://upshotnotes.com/media/none.mp4"), env);
  assert.equal(r.status, 404);
});
