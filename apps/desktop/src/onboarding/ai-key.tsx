import { Trans, useLingui } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";

import { commands as openerCommands } from "@anlg/plugin-opener2";
import { verifyProviderCredentials } from "@anlg/provider-validation";
import { Input } from "@anlg/ui/components/ui/input";
import { cn } from "@anlg/utils";

import { OnboardingButton, StepRow } from "./shared";

import { providerFetch } from "~/ai/provider-fetch";
import { PROVIDERS } from "~/settings/ai/llm/shared";
import { displayLlmModelId } from "~/settings/ai/shared/model-display";
import { getRecommendedModel } from "~/settings/ai/shared/model-list-enrich";
import { setAiProvider } from "~/settings/providers";
import { setSettingValues } from "~/settings/queries";

// Fork: pick a provider, paste its key, verify, with a link to get a key; the
// pattern in manual.raycast.com/ai/bring-your-own-key, cursor.com/help/models-and-usage/api-keys
// and zed.dev/docs/ai/use-api-access (none detects the provider from the key).
// Google first: the Gemini API has a free tier (ai.google.dev/gemini-api/docs/pricing).
export const AI_KEY_PROVIDERS = [
  {
    id: "google_generative_ai",
    name: "Google",
    keyUrl: "https://aistudio.google.com/apikey",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "openai",
    name: "OpenAI",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    keyUrl: "https://openrouter.ai/settings/keys",
  },
] as const;

export type AiKeyProviderId = (typeof AI_KEY_PROVIDERS)[number]["id"];

export type AiKeyConnection = {
  providerName: string;
  modelName: string | null;
};

/**
 * Verify the key the way Settings › Intelligence does, save it to the same
 * Keychain-backed store, then make it the current provider with the
 * catalog's recommended model. Throws if the key does not work.
 */
export async function connectAiKey(
  providerId: AiKeyProviderId,
  rawKey: string,
): Promise<AiKeyConnection> {
  const provider = PROVIDERS.find((candidate) => candidate.id === providerId);
  const apiKey = rawKey.trim();
  const baseUrl = String(provider?.baseUrl ?? "").trim();

  await verifyProviderCredentials(
    { type: "llm", provider: providerId, baseUrl, apiKey },
    providerFetch,
  );
  await setAiProvider("llm", providerId, {
    base_url: baseUrl,
    api_key: apiKey,
  });

  const model = getRecommendedModel(providerId);
  await setSettingValues({
    current_llm_provider: providerId,
    current_llm_model: model ?? "",
    current_llm_reasoning_effort: "default",
  });

  return {
    providerName: provider?.displayName ?? providerId,
    modelName: model ? displayLlmModelId(providerId, model) : null,
  };
}

type Phase =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "connected"; connection: AiKeyConnection }
  | { kind: "failed" };

export function AiKeySection({
  onContinue,
  onSkip,
}: {
  onContinue: (connected: boolean) => void;
  onSkip: () => void;
}) {
  const { t } = useLingui();
  const queryClient = useQueryClient();
  const [providerId, setProviderId] = useState<AiKeyProviderId>(
    AI_KEY_PROVIDERS[0].id,
  );
  const [apiKey, setApiKey] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const selected =
    AI_KEY_PROVIDERS.find((option) => option.id === providerId) ??
    AI_KEY_PROVIDERS[0];

  const chooseProvider = (id: AiKeyProviderId) => {
    setProviderId(id);
    if (phase.kind === "failed") setPhase({ kind: "idle" });
  };

  const connect = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!apiKey.trim() || phase.kind === "checking") return;
    setPhase({ kind: "checking" });
    try {
      const connection = await connectAiKey(providerId, apiKey);
      setApiKey("");
      setPhase({ kind: "connected", connection });
      // Same refresh as saving a key in Settings › Intelligence.
      void queryClient.invalidateQueries({
        queryKey: ["ai-provider-api-keys", "llm"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["default-ai-selection", "llm"],
      });
    } catch {
      // Never log the error: it can carry request details for the key.
      setPhase({ kind: "failed" });
    }
  };

  const connected = phase.kind === "connected";

  return (
    <div className="flex flex-col gap-4">
      <div
        role="radiogroup"
        aria-label={t`AI provider`}
        className="flex flex-wrap gap-2"
      >
        {AI_KEY_PROVIDERS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={option.id === providerId}
            onClick={() => chooseProvider(option.id)}
            className={cn([
              "rounded-full border px-4 py-1.5 text-sm transition-colors",
              option.id === providerId
                ? "border-primary text-foreground"
                : "border-border/60 text-muted-foreground hover:text-foreground",
            ])}
          >
            {option.name}
          </button>
        ))}
      </div>

      <form
        className="flex max-w-md flex-col gap-2"
        onSubmit={(event) => void connect(event)}
      >
        <div className="flex items-center gap-2">
          <Input
            type="password"
            autoComplete="off"
            spellCheck={false}
            aria-label={t`${selected.name} API key`}
            placeholder={t`Paste your ${selected.name} API key`}
            value={apiKey}
            onChange={(event) => {
              setApiKey(event.target.value);
              if (phase.kind === "failed") setPhase({ kind: "idle" });
            }}
            className="bg-card"
          />
          <OnboardingButton
            type="submit"
            variant="secondary"
            className="shrink-0 py-1.5"
            disabled={!apiKey.trim() || phase.kind === "checking"}
          >
            <Trans>Connect</Trans>
          </OnboardingButton>
        </div>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground w-fit text-sm underline underline-offset-4"
          onClick={() => void openerCommands.openUrl(selected.keyUrl, null)}
        >
          {selected.id === "google_generative_ai" ? (
            <Trans>Get a free key from Google AI Studio</Trans>
          ) : (
            <Trans>Get a key from {selected.name}</Trans>
          )}
        </button>
      </form>

      {phase.kind === "checking" && (
        <StepRow status="active" label={<Trans>Checking the key…</Trans>} />
      )}
      {phase.kind === "connected" && (
        <StepRow
          status="done"
          label={
            phase.connection.modelName ? (
              <Trans>
                Connected: {phase.connection.providerName} ·{" "}
                {phase.connection.modelName}
              </Trans>
            ) : (
              <Trans>Connected: {phase.connection.providerName}</Trans>
            )
          }
        />
      )}
      {phase.kind === "failed" && (
        <StepRow
          status="failed"
          label={<Trans>That key didn't work. Check it and try again.</Trans>}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <OnboardingButton onClick={() => onContinue(connected)}>
          <Trans>Continue</Trans>
        </OnboardingButton>
        {!connected && (
          <OnboardingButton variant="ghost" onClick={onSkip}>
            <Trans>Skip for now</Trans>
          </OnboardingButton>
        )}
      </div>
    </div>
  );
}
