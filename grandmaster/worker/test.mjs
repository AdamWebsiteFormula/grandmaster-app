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
import worker from "./src/index.js";
import {
  AUTO_MODEL,
  isProModelSlug,
  resolveModel,
  verifyPro,
} from "./src/model.js";

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
    };
    const body = JSON.stringify({
      model: "openai/gpt-6.1-sol",
      messages: [{ role: "user", content: "Hi" }],
      max_tokens: 99_999,
      tool_choice: "required",
      user: "drop me",
    });
    const response = await worker.fetch(
      new Request("https://w/llm/chat/completions", { method: "POST", body }),
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
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("", { status: 402 });
  try {
    const response = await worker.fetch(
      new Request("https://w/llm/chat/completions", {
        method: "POST",
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

// ---------- Accounts and Pro (billing.js, auth.js) ----------

const TOKEN = "eyJhbGciOiJIUzI1NiJ9.user-token.signature";
const baseEnv = {
  OPENROUTER_API_KEY: "test",
  RATE_LIMITER: { limit: async () => ({ success: true }) },
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
  assert.match(done.headers.get("content-security-policy"), /img-src 'self'/);

  const cancel = await (await get("/billing/cancel")).text();
  assert.match(cancel, /Checkout canceled/);
  assert.match(cancel, /Nothing was charged./);
  assert.doesNotMatch(cancel, /class="check"/);
  assert.match(cancel, /upshot-logo-orange-on-light.png/);

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

async function chatModelFor({ token, status, model }) {
  let sent;
  const mock = mockFetch([
    ...proRoutes(status),
    [
      "https://openrouter.ai/",
      (_url, init) => {
        sent = JSON.parse(init.body);
        return Response.json({});
      },
    ],
  ]);
  try {
    const headers = token ? { authorization: `Bearer ${token}` } : {};
    await worker.fetch(
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
    return { sent, calls: mock.calls };
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

test("auth: wrong password and existing email get plain messages", async () => {
  const signupBodies = [
    [
      422,
      {
        code: 422,
        error_code: "user_already_exists",
        msg: "User already registered",
      },
    ],
    [200, { id: "fake", email: "judge@example.com", identities: [] }],
  ];
  let signupCall = 0;
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
    [
      "https://sb.test/auth/v1/signup",
      () => {
        const [status, body] = signupBodies[signupCall++];
        return Response.json(body, { status });
      },
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
    for (let i = 0; i < signupBodies.length; i++) {
      const signup = await post("/auth/signup");
      assert.equal(signup.status, 409);
      assert.deepEqual(await signup.json(), {
        error: {
          message:
            "An account with this email already exists. Sign in instead.",
          code: "account_exists",
        },
      });
    }
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
