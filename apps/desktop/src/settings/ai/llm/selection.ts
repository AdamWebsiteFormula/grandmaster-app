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
