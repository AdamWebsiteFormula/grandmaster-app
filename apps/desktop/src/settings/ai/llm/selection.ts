type PreferredProviderModelOptions = {
  allowSavedModelWithoutChoices?: boolean;
};

export function isSameModelSelection(
  provider: string | undefined,
  model: string | undefined,
  otherProvider: string | undefined,
  otherModel: string | undefined,
) {
  return provider === otherProvider && model === otherModel;
}

export function getPreferredProviderModel(
  savedModel: string | undefined,
  models: string[],
  options?: PreferredProviderModelOptions,
) {
  if (savedModel && models.includes(savedModel)) {
    return savedModel;
  }

  if (models.length > 0) {
    return models[0];
  }

  if (options?.allowSavedModelWithoutChoices) {
    return savedModel ?? "";
  }

  return "";
}

/** The chosen provider is saved but the UI's provider state lags behind. */
export class ProviderStateSettlingError extends Error {
  constructor(provider: string) {
    super(`Provider state for ${provider} is still loading`);
  }
}

// Fork (Granola standard: the default is a strong model picked for the user;
// docs.granola.ai/help-center/getting-more-from-your-notes/understanding-model-selection-in-granola-chat).
// Apple Intelligence is a small on-device model: it stays in the picker for a
// manual choice, but is never chosen automatically.
export const MANUAL_ONLY_LLM_PROVIDERS: ReadonlySet<string> = new Set([
  "apple_foundation",
]);

export function isAutoSelectableLlmProvider(
  provider: string,
  currentProvider?: string,
) {
  return (
    provider === currentProvider || !MANUAL_ONLY_LLM_PROVIDERS.has(provider)
  );
}

export async function getDefaultLlmSelection(
  providerIds: readonly string[],
  currentProvider: string | undefined,
  currentModel: string | undefined,
  loadModels: (provider: string) => Promise<string[]>,
  options?: { hasSavedConfig?: (provider: string) => Promise<boolean> },
) {
  // Right after a first key, the provider and model can land before the
  // provider rows and key do. Falling through here would save the next
  // configured provider (often Apple Intelligence) over the user's choice.
  if (
    currentProvider &&
    !providerIds.includes(currentProvider) &&
    (await options?.hasSavedConfig?.(currentProvider))
  ) {
    throw new ProviderStateSettlingError(currentProvider);
  }

  for (const provider of providerIds) {
    if (!isAutoSelectableLlmProvider(provider, currentProvider)) {
      continue;
    }
    try {
      const models = await loadModels(provider);
      const model = getPreferredProviderModel(
        provider === currentProvider ? currentModel : undefined,
        models,
        { allowSavedModelWithoutChoices: provider === "custom" },
      );

      if (model) {
        return { provider, model };
      }
    } catch {
      continue;
    }
  }

  return null;
}

export function shouldShowMissingModelWarning({
  isConfigured,
  isResolvingSelection,
  providerSettingsReady,
  settingsReady,
}: {
  isConfigured: boolean;
  isResolvingSelection: boolean;
  providerSettingsReady: boolean;
  settingsReady: boolean;
}) {
  return (
    providerSettingsReady &&
    settingsReady &&
    !isResolvingSelection &&
    !isConfigured
  );
}
