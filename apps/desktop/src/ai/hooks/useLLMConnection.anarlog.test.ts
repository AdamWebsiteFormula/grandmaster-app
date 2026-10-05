import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { renderHook } from "@testing-library/react";
import { generateText } from "ai";
import { beforeEach, expect, it, vi } from "vitest";

import { resetUpshotAccountForTests } from "~/upshot-plan/session";

import { useLanguageModel, useLLMConnectionStatus } from "./useLLMConnection";

const plan = vi.hoisted(() => ({
  isPro: false,
  signedIn: false,
  model: "Auto",
}));

vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));
vi.mock("~/env", () => ({
  env: {
    VITE_AI_API_URL: "https://upshot-ai.example.workers.dev",
    VITE_API_URL: "http://localhost:3001",
  },
}));
vi.mock("~/auth", () => ({ useAuth: () => ({ session: null }) }));
vi.mock("~/auth/billing-context", () => ({
  useBillingAccess: () => ({ isPaid: false }),
}));
vi.mock("~/settings/providers", () => ({ useAiProvider: () => undefined }));
vi.mock("~/upshot-plan", async () => ({
  useUpshotPro: () => plan.isPro,
  upshotAuthFetch: (
    await vi.importActual<typeof import("~/upshot-plan/session")>(
      "~/upshot-plan/session",
    )
  ).upshotAuthFetch,
}));
// The saved Upshot account session (Keychain via plugin-store2).
vi.mock("@anlg/plugin-store2", () => ({
  commands: {
    getSecret: vi.fn(async () => ({
      status: "ok",
      data: plan.signedIn
        ? JSON.stringify({
            access_token: "access-token-123",
            refresh_token: "refresh",
            expires_at: Date.now() / 1000 + 3600,
            email: "judge@example.com",
          })
        : null,
    })),
    setSecret: vi.fn(async () => ({ status: "ok", data: null })),
    deleteSecret: vi.fn(async () => ({ status: "ok", data: null })),
  },
}));
vi.mock("~/shared/config", () => ({
  useConfigValues: () => ({
    current_llm_provider: "anarlog",
    current_llm_model: plan.model,
    current_llm_reasoning_effort: "default",
  }),
}));

// Fork: Upshot AI needs a free account (Google or Microsoft), as Granola
// does. Every test starts signed in unless it says otherwise.
beforeEach(() => {
  plan.isPro = false;
  plan.signedIn = true;
  plan.model = "Auto";
  vi.mocked(tauriFetch).mockReset();
  resetUpshotAccountForTests();
});

it("calls the Upshot AI Worker with the account token and no fingerprint", async () => {
  vi.mocked(tauriFetch).mockImplementation(async (input, init) => {
    expect(String(input)).toBe(
      "https://upshot-ai.example.workers.dev/llm/chat/completions",
    );
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer access-token-123");
    expect(headers.has("x-device-fingerprint")).toBe(false);
    return Response.json({
      id: "hosted",
      model: "auto",
      created: 0,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Hosted summary" },
          finish_reason: "stop",
        },
      ],
    });
  });

  const status = renderHook(() => useLLMConnectionStatus());
  expect(status.result.current).toEqual({
    status: "success",
    providerId: "anarlog",
    isHosted: true,
  });

  const { result } = renderHook(() => useLanguageModel("enhance"));
  const completion = await generateText({
    model: result.current!,
    prompt: "Summarize the meeting",
    maxRetries: 0,
  });
  expect(completion.text).toBe("Hosted summary");
});

it("signed out, Auto asks to sign in and never reaches the Worker", async () => {
  plan.signedIn = false;
  const { result } = renderHook(() => useLanguageModel("enhance"));
  await expect(
    generateText({ model: result.current!, prompt: "Hi", maxRetries: 0 }),
  ).rejects.toThrow("Sign in to use Upshot AI. It's free.");
  expect(tauriFetch).not.toHaveBeenCalled();
});

it("shows the Worker's out-of-credit message", async () => {
  vi.mocked(tauriFetch).mockResolvedValue(
    Response.json(
      {
        error: {
          message: "Upshot AI is out of credit for now. Try again later.",
        },
      },
      { status: 402 },
    ),
  );

  const { result } = renderHook(() => useLanguageModel("enhance"));
  await expect(
    generateText({ model: result.current!, prompt: "Hi", maxRetries: 0 }),
  ).rejects.toThrow("Upshot AI is out of credit for now.");
});

// Fork: free is Auto only; Pro sends the model picked in the chat composer
// (docs.granola.ai/help-center/getting-more-from-your-notes/understanding-model-selection-in-granola-chat).
it.each([
  [false, "openai/gpt-6.1-sol", "Auto"],
  [true, "openai/gpt-6.1-sol", "openai/gpt-6.1-sol"],
  [true, "not a model", "Auto"],
])("Pro %s with %s sends model %s", async (isPro, model, expected) => {
  plan.isPro = isPro;
  plan.model = model;
  let sent: unknown;
  vi.mocked(tauriFetch).mockImplementation(async (_input, init) => {
    sent = JSON.parse(String(init?.body)).model;
    return Response.json({
      id: "hosted",
      model: "auto",
      created: 0,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "ok" },
          finish_reason: "stop",
        },
      ],
    });
  });

  const { result } = renderHook(() => useLanguageModel("chat"));
  await generateText({ model: result.current!, prompt: "Hi", maxRetries: 0 });
  expect(sent).toBe(expected);
});

// Fork: every hosted request sends the account access token so the Worker
// knows the account (and the plan, for a picked model). Auto included.
it.each([
  ["openai/gpt-6.1-sol", "Bearer access-token-123"],
  ["Auto", "Bearer access-token-123"],
])("signed in, model %s sends Authorization %s", async (model, expected) => {
  plan.isPro = true;
  plan.model = model;
  let authorization: string | null = null;
  vi.mocked(tauriFetch).mockImplementation(async (_input, init) => {
    authorization = new Headers(init?.headers).get("Authorization");
    return Response.json({
      id: "hosted",
      model: "auto",
      created: 0,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "ok" },
          finish_reason: "stop",
        },
      ],
    });
  });

  const { result } = renderHook(() => useLanguageModel("chat"));
  await generateText({ model: result.current!, prompt: "Hi", maxRetries: 0 });
  expect(authorization).toBe(expected);
});
