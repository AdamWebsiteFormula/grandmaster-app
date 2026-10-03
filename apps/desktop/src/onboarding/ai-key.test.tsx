import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  setAiProvider: vi.fn(),
  setSettingValues: vi.fn(),
  openUrl: vi.fn(),
}));

vi.mock("@anlg/provider-validation", () => ({
  verifyProviderCredentials: mocks.verify,
}));
vi.mock("@anlg/plugin-opener2", () => ({
  commands: { openUrl: mocks.openUrl },
}));
vi.mock("~/ai/provider-fetch", () => ({ providerFetch: vi.fn() }));
vi.mock("~/settings/providers", () => ({ setAiProvider: mocks.setAiProvider }));
vi.mock("~/settings/queries", () => ({
  setSettingValues: mocks.setSettingValues,
}));
vi.mock("~/settings/ai/llm/shared", () => ({
  PROVIDERS: [
    {
      id: "google_generative_ai",
      displayName: "Google Gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    },
    {
      id: "anthropic",
      displayName: "Anthropic",
      baseUrl: "https://api.anthropic.com/v1",
    },
  ],
}));
vi.mock("~/settings/ai/shared/model-list-enrich", () => ({
  getRecommendedModel: (provider: string) =>
    provider === "anthropic" ? "claude-sonnet-5-5" : "gemini-3.5-flash",
}));
vi.mock("~/settings/ai/shared/model-display", () => ({
  displayLlmModelId: (_provider: string, model: string) =>
    model === "claude-sonnet-5-5" ? "Claude Sonnet 5.5" : "Gemini 3.5 Flash",
}));

import { AiKeySection } from "./ai-key";

const KEY = "sk-ant-test-onboarding-key";

function renderSection() {
  const onContinue = vi.fn();
  const onSkip = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AiKeySection onContinue={onContinue} onSkip={onSkip} />
    </QueryClientProvider>,
  );
  return { onContinue, onSkip };
}

function pasteKey(provider: string, key: string) {
  fireEvent.click(screen.getByRole("radio", { name: provider }));
  fireEvent.change(screen.getByLabelText(`${provider} API key`), {
    target: { value: key },
  });
  fireEvent.click(screen.getByRole("button", { name: "Connect" }));
}

describe("AiKeySection", () => {
  beforeEach(() => {
    mocks.verify.mockReset().mockResolvedValue(undefined);
    mocks.setAiProvider.mockReset().mockResolvedValue(undefined);
    mocks.setSettingValues.mockReset().mockResolvedValue(undefined);
    mocks.openUrl.mockReset().mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  it("starts on Google with the free-key link", () => {
    renderSection();

    expect(
      screen
        .getByRole("radio", { name: "Google" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    fireEvent.click(screen.getByText("Get a free key from Google AI Studio"));
    expect(mocks.openUrl).toHaveBeenCalledWith(
      "https://aistudio.google.com/apikey",
      null,
    );
  });

  it("verifies, saves and selects the chosen provider with its recommended model", async () => {
    const { onContinue } = renderSection();
    pasteKey("Anthropic", KEY);

    expect(
      await screen.findByText("Connected: Anthropic · Claude Sonnet 5.5"),
    ).toBeTruthy();
    expect(mocks.verify).toHaveBeenCalledWith(
      {
        type: "llm",
        provider: "anthropic",
        baseUrl: "https://api.anthropic.com/v1",
        apiKey: KEY,
      },
      expect.any(Function),
    );
    expect(mocks.setAiProvider).toHaveBeenCalledWith("llm", "anthropic", {
      base_url: "https://api.anthropic.com/v1",
      api_key: KEY,
    });
    expect(mocks.setSettingValues).toHaveBeenCalledWith({
      current_llm_provider: "anthropic",
      current_llm_model: "claude-sonnet-5-5",
      current_llm_reasoning_effort: "default",
    });
    // The key is never shown back.
    expect(document.body.textContent).not.toContain(KEY);

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalledWith(true);
  });

  it("shows a plain error and saves nothing when the key fails", async () => {
    mocks.verify.mockRejectedValue(new Error(`rejected ${KEY}`));
    const { onContinue } = renderSection();
    pasteKey("Anthropic", KEY);

    expect(
      await screen.findByText("That key didn't work. Check it and try again."),
    ).toBeTruthy();
    expect(mocks.setAiProvider).not.toHaveBeenCalled();
    expect(mocks.setSettingValues).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain(KEY);

    // Continue still works after a failure.
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalledWith(false);
  });

  it("skips without saving anything", async () => {
    const { onSkip } = renderSection();
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));

    expect(onSkip).toHaveBeenCalled();
    await waitFor(() => expect(mocks.verify).not.toHaveBeenCalled());
    expect(mocks.setSettingValues).not.toHaveBeenCalled();
  });
});
