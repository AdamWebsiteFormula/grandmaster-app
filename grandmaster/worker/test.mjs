// Worker unit checks with Node built-ins only: node grandmaster/worker/test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

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

test("until Pro verification lands, every pick falls back to Auto", () => {
  assert.equal(verifyPro(new Request("https://x/"), {}), false);
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
