import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { renderHook } from "@testing-library/react";
import { generateText } from "ai";
import { expect, it, vi } from "vitest";

import { useLanguageModel, useLLMConnectionStatus } from "./useLLMConnection";

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
vi.mock("~/shared/config", () => ({
  useConfigValues: () => ({
    current_llm_provider: "anarlog",
    current_llm_model: "Auto",
    current_llm_reasoning_effort: "default",
  }),
}));

// Fork: Upshot AI works signed out, like Granola's hosted "Auto".
it("calls the Upshot AI Worker with no session, token or fingerprint", async () => {
  vi.mocked(tauriFetch).mockImplementation(async (input, init) => {
    expect(String(input)).toBe(
      "https://upshot-ai.example.workers.dev/llm/chat/completions",
    );
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization") ?? "").not.toMatch(/Bearer \S/);
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

it("shows the Worker's out-of-credit message", async () => {
  vi.mocked(tauriFetch).mockResolvedValue(
    Response.json(
      {
        error: {
          message:
            "Upshot AI is out of credit for now. Add your own key in Settings › Intelligence.",
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
