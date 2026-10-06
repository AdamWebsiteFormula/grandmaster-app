import { Trans, useLingui } from "@lingui/react/macro";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRef, useState } from "react";

import {
  commands as localSttCommands,
  type LocalModel,
} from "@anlg/plugin-local-stt";
import { commands as miscCommands } from "@anlg/plugin-misc";
import { commands as openerCommands } from "@anlg/plugin-opener2";
import type { AIProviderStorage } from "@anlg/store";
import {
  CircleNotch,
  FolderOpen,
  Trash,
  Warning,
} from "@anlg/ui/components/icons";
import { Input } from "@anlg/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@anlg/ui/components/ui/select";
import { toast } from "@anlg/ui/components/ui/toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@anlg/ui/components/ui/tooltip";
import { useMountEffect } from "@anlg/ui/hooks/use-mount-effect";
import { useSquircleRef } from "@anlg/ui/hooks/use-squircle";
import { chipSquircle } from "@anlg/ui/lib/squircle";
import { cn } from "@anlg/utils";

import { useSttSettings } from "./context";
import { HealthStatusIndicator, useConnectionHealth } from "./health";
import { LocalFileModel } from "./local-file-model";
import { LocalModelBackendBadge, LocalModelLabel } from "./model-icon";
import { recommendOnDeviceModel } from "./on-device-recommendation";
import {
  getDefaultSttSelection,
  getLanguageSupportIssue,
  resolveLiveLanguageSupportMode,
} from "./selection";
import {
  displayModelLabel,
  formatDownloadProgress,
  formatModelSize,
  isDeprecatedSttModel,
  type ProviderId,
  PROVIDERS,
  sttModelQueries,
} from "./shared";

import { useBillingAccess } from "~/auth/billing-context";
import { useNotifications } from "~/contexts/notifications";
import {
  providerRowId,
  ProviderIconSlot,
  requiresKeyVerification,
  useProviderAvailability,
} from "~/settings/ai/shared";
import {
  getProviderSelectionBlockers,
  requiresEntitlement,
} from "~/settings/ai/shared/eligibility";
import { PersistAiSelection } from "~/settings/ai/shared/persist-selection";
import {
  getConfiguredProviderIds,
  getConfiguredProviders,
  getVisibleModelSelection,
} from "~/settings/ai/shared/selection";
import { getBaseLanguageDisplayName } from "~/settings/general/language";
import { SettingsSectionTitle } from "~/settings/page-title";
import { useAiProvidersState } from "~/settings/providers";
import { useSetSettingValues } from "~/settings/queries";
import { SETTING_CONTROL_CLASS } from "~/settings/setting-row";
import { useConfigValues } from "~/shared/config";
import { isMac } from "~/shared/shortcut-label";
import { DestructiveConfirmationDialog } from "~/shared/ui/destructive-confirmation-dialog";
import { SettingsAlertToast } from "~/shared/ui/settings-alert";
import {
  canAppleSpeechTranscribe,
  isConfiguredSttModel,
  getSttModelTranscriptionMode,
  isDesktopLocalSttAvailable,
  isUpshotCloudSttAvailable,
  isLiveTranscriptionSupported,
  isLocalFileSttModel,
  isOnDeviceSttModel,
  isRealtimeLocalModel,
  isSupportedLanguagesBatch,
  isSupportedLanguagesLive,
  isSupportedLocalSttModel,
} from "~/stt/capabilities";
import {
  getDefaultSttModel,
  getPreferredProviderModel,
} from "~/stt/model-selection";

export function SelectProviderAndModel() {
  const { t } = useLingui();
  const { current_stt_provider, current_stt_model } = useConfigValues([
    "current_stt_provider",
    "current_stt_model",
  ] as const);
  const billing = useBillingAccess();
  const { providers: configuredProviders, isReady: providerSettingsReady } =
    useConfiguredMapping();
  const { startDownload, startTrial } = useSttSettings();
  const health = useConnectionHealth();
  const [pendingProvider, setPendingProvider] = useState<ProviderId | null>(
    null,
  );

  const selectedSttModel = isConfiguredSttModel(
    current_stt_provider,
    current_stt_model,
  )
    ? current_stt_model
    : undefined;
  const selectedProvider = current_stt_provider as ProviderId | undefined;
  const selectedProviderConfigured = selectedProvider
    ? (configuredProviders[selectedProvider]?.configured ?? false)
    : false;
  const visibleSelection = getVisibleModelSelection(
    selectedProvider,
    selectedSttModel,
    selectedProviderConfigured,
  );
  const selectableProviders = PROVIDERS.filter(({ disabled }) => !disabled);
  const configuredProviderIds = getConfiguredProviderIds(
    selectableProviders,
    configuredProviders,
    selectedProvider,
  );
  const defaultSelection =
    providerSettingsReady && !visibleSelection.model
      ? getDefaultSttSelection(
          configuredProviderIds,
          configuredProviders,
          selectedProvider,
          current_stt_model,
        )
      : null;
  const effectiveSelection = pendingProvider
    ? { provider: pendingProvider, model: "" }
    : (defaultSelection ?? visibleSelection);
  const visibleProvider = effectiveSelection.provider as ProviderId | "";
  const isConfigured = !!(visibleProvider && effectiveSelection.model);
  const hasError = isConfigured && health.status === "error";
  const alertDescription = !providerSettingsReady
    ? undefined
    : !isConfigured
      ? t`Choose a transcription model to start recording.`
      : hasError
        ? health.message
        : undefined;
  const selectedModels = visibleProvider
    ? (configuredProviders[visibleProvider]?.models ?? [])
    : [];
  const displayedSttModel =
    visibleProvider === "custom" || visibleProvider === "nvidia"
      ? effectiveSelection.model
      : effectiveSelection.model
        ? getPreferredProviderModel(effectiveSelection.model, selectedModels, {
            keepUnavailableSavedModel: true,
          })
        : undefined;
  const selectedModel = selectedModels.find(
    (model) => model.id === displayedSttModel,
  );
  const providerOptions = getConfiguredProviders(
    selectableProviders,
    configuredProviders,
  );

  const setSelection = useSetSettingValues();
  const lastSelectedModelsRef = useRef<Record<string, string>>(
    current_stt_provider && selectedSttModel
      ? { [current_stt_provider]: selectedSttModel }
      : {},
  );
  const rememberModel = (provider?: string, model?: string) => {
    if (!provider || model === undefined) {
      return;
    }

    lastSelectedModelsRef.current[provider] = model;
  };

  const handleProviderChange = (provider: string) => {
    rememberModel(current_stt_provider, selectedSttModel);

    const providerId = provider as ProviderId;
    const nextModels = configuredProviders[providerId]?.models ?? [];
    const nextModel =
      getPreferredProviderModel(
        lastSelectedModelsRef.current[provider],
        nextModels,
        {
          allowSavedModelWithoutChoices:
            providerId === "custom" || providerId === "nvidia",
        },
      ) ||
      getDefaultSttModel(providerId) ||
      "";

    if (!nextModel) {
      setPendingProvider(providerId);
      return;
    }

    setPendingProvider(null);
    rememberModel(provider, nextModel);
    setSelection({
      current_stt_provider: provider,
      current_stt_model: nextModel,
    });
  };

  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<ModelEntry | null>(null);

  // Fork: Download, Cancel download and Upgrade are menu items, so they are
  // always visible and reachable from the keyboard (ux-audit-oct3 E,
  // WCAG 2.1.1, NN/g #3).
  const handleModelValueChange = (value: string) => {
    const action = parseModelAction(value);
    if (!action) {
      handleModelChange(value);
      return;
    }
    if (action.kind === "download") {
      startDownload(action.model as LocalModel);
    } else if (action.kind === "cancel") {
      void localSttCommands.cancelDownload(action.model as LocalModel);
    } else {
      startTrial();
    }
  };

  const handleModelChange = (model: string) => {
    if (!visibleProvider) {
      return;
    }

    rememberModel(visibleProvider, model);
    setPendingProvider(null);
    setSelection({
      current_stt_provider: visibleProvider,
      current_stt_model: model,
    });
  };
  return (
    // Fork: the title sits as close to its dropdowns as Dictionary's to its
    // card: gap-2 and a 24 px title row (Apple HIG, Layout).
    <div className="flex flex-col gap-2">
      {defaultSelection && !pendingProvider ? (
        <PersistAiSelection
          key={`stt:${defaultSelection.provider}:${defaultSelection.model}`}
          type="stt"
          provider={defaultSelection.provider}
          model={defaultSelection.model}
        />
      ) : null}
      <SettingsAlertToast
        id="stt-settings-alert"
        description={alertDescription}
        variant={hasError ? "error" : "warning"}
        lifecycle="condition-bound"
      />
      {!alertDescription && <TranscriptionLanguageWarningToast />}

      {/* Fork: inset like every other section title (SettingsGroup px-1),
          and both dropdowns use the Settings select look: the default
          squircle and a chevron at all times (NN/g #4; NN/g "Beyond Blue
          Links"). */}
      <SettingsSectionTitle className="flex min-h-6 items-center">
        <Trans>Model being used</Trans>
      </SettingsSectionTitle>
      {/* Fork: Provider and Model sit in a card, as every other Settings
          section does (picture review, Oct 6; Apple HIG, Settings: group
          related controls). */}
      <div className="border-border bg-card dark:bg-muted flex flex-col gap-2 rounded-xl border p-4">
        {/* Fork: small Provider and Model labels over the two pickers, in
          place of a bare "/" between them (backlog item 7; NN/g heuristic
          6, recognition over recall). The pickers keep their own names. */}
        <div
          aria-hidden="true"
          className="text-muted-foreground -mb-1 flex flex-row gap-4 text-xs"
        >
          <span className="min-w-0 flex-2">{t`Provider`}</span>
          <span className="min-w-0 flex-3">{t`Model`}</span>
        </div>
        <div className="flex flex-row items-center gap-4">
          <div className="min-w-0 flex-2" data-stt-provider-selector>
            <Select
              value={visibleProvider}
              onValueChange={handleProviderChange}
            >
              <SelectTrigger
                aria-label={t`Transcription provider`}
                className={SETTING_CONTROL_CLASS}
              >
                <SelectValue placeholder={t`Select a provider`} />
              </SelectTrigger>
              <SelectContent>
                {providerOptions.length === 0 && (
                  <div className="text-muted-foreground px-2 py-3 text-center text-sm">
                    <Trans>No providers found.</Trans>
                  </div>
                )}
                {providerOptions.map((provider) => {
                  const configured =
                    configuredProviders[provider.id]?.configured ?? false;
                  const requiresPro = requiresEntitlement(
                    provider.requirements,
                    "pro",
                  );
                  const locked = requiresPro && !billing.isPaid;
                  return (
                    <SelectItem
                      key={provider.id}
                      value={provider.id}
                      disabled={provider.disabled || locked}
                      className={cn([
                        "data-disabled:text-muted-foreground data-disabled:!opacity-100",
                        !configured && !locked && "text-muted-foreground",
                      ])}
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <ProviderIconSlot>{provider.icon}</ProviderIconSlot>
                          <span>{provider.displayName}</span>
                          {requiresPro ? (
                            <span className="border-border text-muted-foreground rounded-full border px-2 py-0.5 text-xs">
                              <Trans>Pro</Trans>
                            </span>
                          ) : null}
                        </div>
                        {locked ? (
                          <span className="text-muted-foreground text-xs">
                            <Trans>Upgrade to Pro to use this provider.</Trans>
                          </span>
                        ) : "description" in provider &&
                          provider.description ? (
                          <span className="text-muted-foreground text-xs">
                            {provider.description}
                          </span>
                        ) : null}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {visibleProvider === "local_file" ? (
            <div className="min-w-0 flex-3">
              <LocalFileModel healthStatus={health.status} />
            </div>
          ) : visibleProvider === "custom" || visibleProvider === "nvidia" ? (
            <div className="min-w-0 flex-3">
              <Input
                value={displayedSttModel || ""}
                onChange={(event) => handleModelChange(event.target.value)}
                aria-label={t`Model ID`}
                className="text-xs"
                placeholder={t`Enter a model ID`}
              />
            </div>
          ) : (
            <div className="min-w-0 flex-3">
              <Select
                value={displayedSttModel || ""}
                onValueChange={handleModelValueChange}
                open={modelMenuOpen}
                onOpenChange={setModelMenuOpen}
                disabled={selectedModels.length === 0}
              >
                <SelectTrigger
                  aria-label={t`Transcription model`}
                  className={cn([
                    SETTING_CONTROL_CLASS,
                    "gap-2 text-left",
                    "[&>span]:!flex [&>span]:w-full [&>span]:min-w-0 [&>span]:items-center [&>span]:justify-start [&>span]:gap-2 [&>span]:overflow-visible [&>span]:[-webkit-line-clamp:unset]",
                  ])}
                >
                  <SelectValue placeholder={t`Select a model`}>
                    {selectedModel ? (
                      <ModelSelectedValue model={selectedModel} />
                    ) : undefined}
                  </SelectValue>
                  {/* Fork: no unlabeled check here; the spinner and the
                    alert toast report checking and failure (NN/g Icon
                    Usability; WCAG 2.2 SC 1.1.1). */}
                  {isConfigured && <HealthStatusIndicator />}
                </SelectTrigger>
                <SelectContent align="end">
                  {selectedModels.map((model, i) => {
                    const prevCategory =
                      i > 0 ? selectedModels[i - 1].category : null;
                    const showHeader =
                      model.category && model.category !== prevCategory;
                    const categoryLabel = showHeader
                      ? getModelCategoryLabel(model.category)
                      : null;
                    return (
                      <span key={model.id}>
                        {categoryLabel && (
                          <div className="text-muted-foreground px-2 pt-2 pb-1 text-xs font-medium">
                            {categoryLabel}
                          </div>
                        )}
                        <ModelSelectItem
                          model={model}
                          onRequestDelete={() => {
                            setModelMenuOpen(false);
                            setModelToDelete(model);
                          }}
                        />
                      </span>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>
      <DeleteLocalModelDialog
        model={modelToDelete}
        onClose={() => setModelToDelete(null)}
      />
    </div>
  );
}

type ModelAction = {
  kind: "download" | "cancel" | "upgrade";
  model: string;
};

const MODEL_ACTION_SEPARATOR = "::model-action::";

function modelActionValue(kind: ModelAction["kind"], model: string) {
  return `${kind}${MODEL_ACTION_SEPARATOR}${model}`;
}

export function parseModelAction(value: string): ModelAction | null {
  const index = value.indexOf(MODEL_ACTION_SEPARATOR);
  if (index === -1) return null;
  const kind = value.slice(0, index);
  if (kind !== "download" && kind !== "cancel" && kind !== "upgrade") {
    return null;
  }
  return { kind, model: value.slice(index + MODEL_ACTION_SEPARATOR.length) };
}

const TRANSCRIPTION_LANGUAGE_WARNING_TOAST_ID =
  "transcription-language-warning";
const MAX_DISMISSED_TRANSCRIPTION_LANGUAGE_WARNINGS = 128;
const DISMISSED_TRANSCRIPTION_LANGUAGE_WARNINGS_KEY =
  "anarlog:dismissed-transcription-language-warnings";

function rememberDismissedTranscriptionLanguageWarning(warningKey: string) {
  try {
    const warnings = readDismissedTranscriptionLanguageWarnings().filter(
      (key) => key !== warningKey,
    );
    warnings.push(warningKey);
    localStorage.setItem(
      DISMISSED_TRANSCRIPTION_LANGUAGE_WARNINGS_KEY,
      JSON.stringify(
        warnings.slice(-MAX_DISMISSED_TRANSCRIPTION_LANGUAGE_WARNINGS),
      ),
    );
  } catch {
    return;
  }
}

function isTranscriptionLanguageWarningDismissed(warningKey: string) {
  return readDismissedTranscriptionLanguageWarnings().includes(warningKey);
}

function readDismissedTranscriptionLanguageWarnings(): string[] {
  try {
    const stored = JSON.parse(
      localStorage.getItem(DISMISSED_TRANSCRIPTION_LANGUAGE_WARNINGS_KEY) ??
        "[]",
    );
    return Array.isArray(stored)
      ? stored.filter((key): key is string => typeof key === "string")
      : [];
  } catch {
    return [];
  }
}

function TranscriptionLanguageWarningToast() {
  const { i18n, t } = useLingui();
  const warning = useTranscriptionLanguageWarning();

  if (!warning || isTranscriptionLanguageWarningDismissed(warning.key)) {
    return null;
  }

  const model = displayModelLabel(warning.model);
  const unsupportedLanguages = warning.unsupportedLanguages.map((language) =>
    getBaseLanguageDisplayName(language, i18n.locale),
  );
  // Apple Speech is limited to languages added in System Settings, so a language it
  // supports needs a different fix than one it cannot transcribe at all.
  const needsSystemSettings =
    warning.model === "apple-speech"
      ? warning.unsupportedLanguages
          .filter((language) => canAppleSpeechTranscribe(language))
          .map((language) => getBaseLanguageDisplayName(language, i18n.locale))
      : [];

  const more = (count: number) => t`${count} more`;
  const description =
    needsSystemSettings.length > 0
      ? t`Add ${formatLanguageList(needsSystemSettings, more)} in System Settings › General › Language & Region to transcribe with ${model}, or choose another model.`
      : unsupportedLanguages.length > 0
        ? t`${model} can’t transcribe ${formatLanguageList(unsupportedLanguages, more)}. Try another model or change your spoken languages.`
        : t`${model} can’t transcribe all selected languages together. Try another model or use fewer spoken languages.`;

  return (
    <TranscriptionLanguageWarningToastLifecycle
      key={warning.key}
      warningKey={warning.key}
      description={description}
      actionLabel={t`Got it`}
    />
  );
}

function TranscriptionLanguageWarningToastLifecycle({
  warningKey,
  description,
  actionLabel,
}: {
  warningKey: string;
  description: string;
  actionLabel: string;
}) {
  useMountEffect(() => {
    let shouldRememberDismissal = true;
    toast.warning(description, {
      id: TRANSCRIPTION_LANGUAGE_WARNING_TOAST_ID,
      duration: Infinity,
      icon: (
        <Warning className="size-4 shrink-0 text-amber-600 dark:text-amber-500" />
      ),
      action: {
        label: actionLabel,
        onClick: () => {
          shouldRememberDismissal = false;
          rememberDismissedTranscriptionLanguageWarning(warningKey);
          clearTranscriptionLanguageWarningToast();
        },
      },
      onDismiss: () => {
        if (shouldRememberDismissal) {
          rememberDismissedTranscriptionLanguageWarning(warningKey);
        }
      },
    });

    return () => {
      shouldRememberDismissal = false;
      clearTranscriptionLanguageWarningToast();
    };
  });

  return null;
}

function clearTranscriptionLanguageWarningToast() {
  toast.dismiss(TRANSCRIPTION_LANGUAGE_WARNING_TOAST_ID);
}

function useTranscriptionLanguageWarning() {
  const {
    ai_language,
    current_stt_provider,
    current_stt_model,
    spoken_languages,
  } = useConfigValues([
    "ai_language",
    "current_stt_provider",
    "current_stt_model",
    "spoken_languages",
  ] as const);
  const health = useConnectionHealth();

  const selectedSttModel = isConfiguredSttModel(
    current_stt_provider,
    current_stt_model,
  )
    ? current_stt_model
    : undefined;
  const isConfigured = !!(current_stt_provider && selectedSttModel);
  const isOnDeviceModel =
    isOnDeviceSttModel(current_stt_provider, selectedSttModel) ||
    isLocalFileSttModel(current_stt_provider, selectedSttModel);
  const useLiveOnDeviceModel =
    isOnDeviceModel && isRealtimeLocalModel(selectedSttModel);
  const hasError = isConfigured && health.status === "error";
  const liveSupport = useQuery({
    queryKey: ["stt-live-support", current_stt_provider, selectedSttModel],
    queryFn: () =>
      isLiveTranscriptionSupported(current_stt_provider, selectedSttModel),
    enabled: isConfigured,
  });
  const useLiveMode = resolveLiveLanguageSupportMode({
    isOnDeviceModel,
    useLiveOnDeviceModel,
    liveSupported: liveSupport.data,
  });

  const languageSupportIssue = useQuery({
    queryKey: [
      "stt-language-support",
      current_stt_provider,
      selectedSttModel,
      useLiveMode,
      ai_language,
      spoken_languages,
    ],
    queryFn: async () => {
      const isSupported = (languages: readonly string[]) =>
        useLiveMode
          ? isSupportedLanguagesLive(
              current_stt_provider!,
              selectedSttModel ?? null,
              languages,
            )
          : isSupportedLanguagesBatch(
              current_stt_provider!,
              selectedSttModel ?? null,
              languages,
            );

      return await getLanguageSupportIssue(
        ai_language,
        spoken_languages,
        isSupported,
      );
    },
    enabled: isConfigured && liveSupport.data !== undefined && !!ai_language,
  });

  if (
    !isConfigured ||
    !selectedSttModel ||
    !languageSupportIssue.data ||
    hasError
  ) {
    return null;
  }

  return {
    key: [
      current_stt_provider,
      selectedSttModel,
      ai_language,
      ...(spoken_languages ?? []),
    ].join(":"),
    model: selectedSttModel,
    unsupportedLanguages: languageSupportIssue.data.unsupportedLanguages,
  };
}

function formatLanguageList(
  languages: string[],
  more: (count: number) => string,
) {
  const visibleLanguages = languages.slice(0, 3);
  const remainingCount = languages.length - visibleLanguages.length;

  if (remainingCount > 0) {
    visibleLanguages.push(more(remainingCount));
  }

  return visibleLanguages.join(", ");
}

type ModelCategory = "hardware" | "latest" | null;
type ModelEntry = {
  id: string;
  isDownloaded: boolean;
  displayName?: string;
  isDeprecated?: boolean;
  category?: ModelCategory;
  sizeBytes?: number | null;
  mode?: "realtime" | "batch";
};

function getModelCategoryLabel(category?: ModelCategory) {
  if (category === "latest") {
    return <Trans>Recommended</Trans>;
  }

  if (category === "hardware") {
    // Fork: "this computer" off a Mac (NN/g heuristic #2, the user's words).
    return isMac() ? (
      <Trans>Best for this Mac</Trans>
    ) : (
      <Trans>Best for this computer</Trans>
    );
  }

  return null;
}

export function useConfiguredMapping(): {
  providers: Record<
    ProviderId,
    {
      configured: boolean;
      models: ModelEntry[];
    }
  >;
  isReady: boolean;
} {
  const billing = useBillingAccess();
  const availability = useProviderAvailability("stt", PROVIDERS);
  const { providers: configuredProviders, isReady } =
    useAiProvidersState("stt");
  const { local_stt_model_path } = useConfigValues([
    "local_stt_model_path",
  ] as const);

  const deviceInfo = useQuery({
    queryKey: ["device-info"],
    queryFn: async () => {
      const result = await miscCommands.getDeviceInfo(null);
      return result.status === "ok" ? result.data : null;
    },
    staleTime: Infinity,
  });

  const supportedModels = useQuery({
    queryKey: ["list-supported-models"],
    queryFn: async () => {
      const result = await localSttCommands.listSupportedModels();
      return result.status === "ok" ? result.data : [];
    },
    staleTime: Infinity,
  });

  const localModels = supportedModels.data ?? [];
  const soniqoModels = localModels.filter((m) => m.model_type === "soniqo");
  // Listed only when the backend reports macOS 26 with Apple Speech available.
  const appleSpeechModels = localModels.filter(
    (m) => m.model_type === "appleSpeech",
  );

  const soniqoDownloaded = useQueries({
    queries: [...soniqoModels.map((m) => sttModelQueries.isDownloaded(m.key))],
  });

  const appleSpeechDownloaded = useQueries({
    queries: [
      ...appleSpeechModels.map((m) => sttModelQueries.isDownloaded(m.key)),
    ],
  });

  const providers = Object.fromEntries(
    PROVIDERS.map((provider) => {
      const config = configuredProviders[providerRowId("stt", provider.id)] as
        | AIProviderStorage
        | undefined;
      const baseUrl = String(config?.base_url || provider.baseUrl || "").trim();
      const apiKey = String(config?.api_key || "").trim();

      const eligible =
        getProviderSelectionBlockers(provider.requirements, {
          isAuthenticated: true,
          isPaid: billing.isPaid,
          config: { base_url: baseUrl, api_key: apiKey },
        }).length === 0;

      if (
        !eligible ||
        (requiresKeyVerification(provider) &&
          availability[provider.id] !== true)
      ) {
        return [provider.id, { configured: false, models: [] }];
      }

      // Fork: Upshot transcription (the Upshot Worker's keyless Deepgram
      // proxy) is offered on every computer and is the default; Apple
      // Silicon also lists its on-device engines (stt/capabilities.ts).
      if (provider.id === "anarlog") {
        const available =
          !!deviceInfo.data?.platform &&
          isUpshotCloudSttAvailable(
            deviceInfo.data.platform,
            deviceInfo.data.arch ?? "",
          );
        return [
          provider.id,
          {
            configured: available,
            models: available
              ? [{ id: "cloud", isDownloaded: true, mode: "realtime" as const }]
              : [],
          },
        ];
      }

      if (provider.id === "soniqo") {
        const models = buildOnDeviceModelEntries(
          soniqoModels,
          soniqoDownloaded,
          deviceInfo.data?.totalMemoryBytes,
        );
        return [provider.id, { configured: models.length > 0, models }];
      }

      if (provider.id === "apple_speech") {
        // Fork: on-device engines only where Upshot runs them (Apple
        // Silicon); elsewhere a pick would be swapped for Upshot
        // transcription at the next launch (auth/billing.tsx repair).
        const models = isDesktopLocalSttAvailable(
          deviceInfo.data?.platform ?? "",
          deviceInfo.data?.arch ?? "",
        )
          ? buildOnDeviceModelEntries(
              appleSpeechModels,
              appleSpeechDownloaded,
              deviceInfo.data?.totalMemoryBytes,
            )
          : [];
        return [provider.id, { configured: models.length > 0, models }];
      }

      if (provider.id === "local_file") {
        const available = isDesktopLocalSttAvailable(
          deviceInfo.data?.platform ?? "",
          deviceInfo.data?.arch ?? "",
        );
        return [
          provider.id,
          {
            configured: available,
            models: [
              {
                id: "local-file",
                isDownloaded: !!local_stt_model_path?.trim(),
                mode: "batch" as const,
              },
            ],
          },
        ];
      }

      if (provider.id === "custom" || provider.id === "nvidia") {
        return [provider.id, { configured: true, models: [] }];
      }

      return [
        provider.id,
        {
          configured: true,
          models: provider.models.map((model) => {
            const mode = getSttModelTranscriptionMode(provider.id, model);
            return {
              id: model,
              isDownloaded: true,
              mode: mode === "live" ? "realtime" : mode,
              isDeprecated: isDeprecatedSttModel(provider.id, model),
            };
          }),
        },
      ];
    }),
  ) as Record<
    ProviderId,
    {
      configured: boolean;
      models: ModelEntry[];
    }
  >;

  return {
    providers,
    isReady:
      isReady &&
      supportedModels.isFetched &&
      deviceInfo.isFetched &&
      Object.values(availability).every((value) => value !== undefined),
  };
}

function buildOnDeviceModelEntries(
  models: Array<{
    key: LocalModel;
    display_name: string;
    size_bytes: number | null;
    supports_realtime: boolean;
    recommended_memory_bytes: number;
  }>,
  downloads: Array<{ data?: boolean }>,
  totalMemoryBytes?: number,
): ModelEntry[] {
  const recommendedModel = recommendOnDeviceModel(
    models.map((model) => ({
      id: model.key,
      recommendedMemoryBytes: model.recommended_memory_bytes,
    })),
    totalMemoryBytes,
  );

  return models
    .map((model, index) => ({
      id: model.key,
      isDownloaded: downloads[index]?.data ?? false,
      displayName: model.display_name,
      sizeBytes: model.size_bytes,
      mode: model.supports_realtime
        ? ("realtime" as const)
        : ("batch" as const),
      category: model.key === recommendedModel ? ("hardware" as const) : null,
    }))
    .sort(
      (a, b) =>
        Number(b.id === recommendedModel) - Number(a.id === recommendedModel),
    );
}

function ModelSelectItem({
  model,
  onRequestDelete,
}: {
  model: ModelEntry;
  onRequestDelete: () => void;
}) {
  const isCloud = model.id === "cloud";
  const { activeDownloads } = useNotifications();
  const { queuedDownloads } = useSttSettings();
  const downloadInfo = activeDownloads.find((d) => d.model === model.id);
  const isDownloading =
    !!downloadInfo || queuedDownloads.includes(model.id as LocalModel);

  const label = displayModelLabel(model.id, model.displayName);
  const sizeLabel = formatModelSize(model.sizeBytes);
  const showLocalActions = model.isDownloaded && isLocalModelId(model.id);
  const isDeprecated = model.isDeprecated === true;
  const content = (
    <div
      className={cn(["flex min-w-0 flex-1 items-center justify-between gap-3"])}
    >
      <LocalModelLabel
        model={model.id}
        label={label}
        title={label}
        className="min-w-0 flex-1"
      />
      <div className="flex shrink-0 items-center gap-2 text-xs">
        <LocalModelBackendBadge model={model.id} />
        {isDeprecated && <DeprecatedBadge />}
        {model.mode !== "realtime" && <ModelModeBadge mode={model.mode} />}
        {!model.isDownloaded && sizeLabel && (
          <span className="text-muted-foreground font-mono">{sizeLabel}</span>
        )}
      </div>
    </div>
  );

  if (model.isDownloaded) {
    return (
      <div className="group/model-row relative overflow-hidden rounded-full has-[[data-model-actions-pending]]:[&>*:first-child>span:first-child]:opacity-0">
        <SelectItem
          key={model.id}
          value={model.id}
          className={cn([
            "group-hover/model-row:bg-accent group-hover/model-row:text-accent-foreground",
            showLocalActions &&
              "pr-20 group-focus-within/model-row:[&>span:first-child]:opacity-0 group-hover/model-row:[&>span:first-child]:opacity-0",
            isDeprecated && "text-muted-foreground focus:text-muted-foreground",
          ])}
        >
          {content}
        </SelectItem>
        {showLocalActions && (
          <LocalModelDropdownActions
            model={model.id as LocalModel}
            onRequestDelete={onRequestDelete}
          />
        )}
      </div>
    );
  }

  const actionKind: ModelAction["kind"] = isDownloading
    ? "cancel"
    : isCloud
      ? "upgrade"
      : "download";

  return (
    <SelectItem
      value={modelActionValue(actionKind, model.id)}
      className="pr-2 [&>span:first-child]:hidden [&>span:last-child]:min-w-0 [&>span:last-child]:flex-1"
    >
      <div className="flex w-full min-w-0 items-center gap-2">
        <div className="text-muted-foreground min-w-0 flex-1">{content}</div>
        {isDownloading ? (
          <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs">
            <CircleNotch className="size-3 animate-spin" />
            {downloadInfo ? (
              formatDownloadProgress(downloadInfo.progress)
            ) : (
              <Trans>Starting</Trans>
            )}
            <span className="text-foreground font-medium">
              <Trans>Cancel download</Trans>
            </span>
          </span>
        ) : (
          <span
            className={cn([
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
              isCloud
                ? "bg-primary text-primary-foreground"
                : "bg-accent text-foreground",
            ])}
          >
            {isCloud ? <Trans>Upgrade to use</Trans> : <Trans>Download</Trans>}
          </span>
        )}
      </div>
    </SelectItem>
  );
}

function ModelSelectedValue({ model }: { model: ModelEntry }) {
  const isDeprecated = model.isDeprecated === true;
  const label = displayModelLabel(model.id, model.displayName);

  return (
    <div className="flex max-w-full min-w-0 items-center gap-2">
      <LocalModelLabel
        model={model.id}
        label={label}
        title={label}
        className={cn(["min-w-0", isDeprecated && "opacity-60"])}
        labelClassName={cn([isDeprecated && "text-muted-foreground"])}
      />
      {isDeprecated && <DeprecatedBadge />}
      <ModelModeBadge mode={model.mode} />
    </div>
  );
}

function DeprecatedBadge() {
  const ref = useSquircleRef<HTMLSpanElement>(undefined, chipSquircle);
  return (
    <span
      ref={ref}
      className={cn([
        "shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium",
        "bg-amber-50 text-amber-800",
      ])}
    >
      <Trans>Deprecated</Trans>
    </span>
  );
}

function ModelModeBadge({ mode }: { mode?: ModelEntry["mode"] }) {
  const ref = useSquircleRef<HTMLSpanElement>(undefined, chipSquircle);
  if (!mode) {
    return null;
  }

  const isRealtime = mode === "realtime";

  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <span
          ref={ref}
          className={cn([
            "shrink-0 cursor-help rounded-md px-1.5 py-0.5 text-xs font-medium",
            // Fork: neutral chips that adapt to dark mode, no fixed blue
            // (Apple HIG Dark Mode; design-system "The one accent").
            isRealtime
              ? "bg-muted text-foreground"
              : "bg-muted text-muted-foreground",
          ])}
        >
          {isRealtime ? <Trans>Live</Trans> : <Trans>After recording</Trans>}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-64 text-xs">
        {isRealtime ? (
          <Trans>Can transcribe while the meeting is happening.</Trans>
        ) : (
          <Trans>
            Runs after the recording finishes, not during the meeting.
          </Trans>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function isLocalModelId(model: string): model is LocalModel {
  return isSupportedLocalSttModel(model);
}

function LocalModelDropdownActions({
  model,
  onRequestDelete,
}: {
  model: LocalModel;
  onRequestDelete: () => void;
}) {
  const { t } = useLingui();

  const stopSelect = (event: React.SyntheticEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleOpen = () => {
    const resultPromise = String(model).startsWith("soniqo-")
      ? localSttCommands.soniqoModelDir(model)
      : localSttCommands.modelsDir();

    void resultPromise.then((result) => {
      if (result.status === "ok") {
        void openerCommands.openPath(result.data, null);
      }
    });
  };

  return (
    <div
      className={cn([
        "absolute top-0 right-0 bottom-0 flex items-center justify-end gap-1 rounded-r-full pl-6",
        "pointer-events-none opacity-0 transition-opacity duration-150",
        "group-hover/model-row:pointer-events-auto group-hover/model-row:opacity-100",
        "group-focus-within/model-row:pointer-events-auto group-focus-within/model-row:opacity-100",
      ])}
    >
      <button
        type="button"
        aria-label={t`Show in Finder`}
        className={cn([
          "flex size-6 items-center justify-center rounded-full",
          "text-muted-foreground hover:text-foreground",
        ])}
        onPointerDown={stopSelect}
        onClick={(event) => {
          stopSelect(event);
          handleOpen();
        }}
      >
        <FolderOpen className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label={t`Delete model`}
        className={cn([
          "flex size-6 items-center justify-center rounded-full",
          "text-destructive hover:bg-destructive/10",
          "disabled:opacity-70",
        ])}
        onPointerDown={stopSelect}
        onClick={(event) => {
          stopSelect(event);
          onRequestDelete();
        }}
      >
        <Trash className="size-3.5" />
      </button>
    </div>
  );
}

// Fork: deleting a downloaded model asks first, because getting it back
// means downloading it again (ux-audit-oct3 E, NN/g #5; HIG alerts).
export function DeleteLocalModelDialog({
  model,
  onClose,
}: {
  model: ModelEntry | null;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const queryClient = useQueryClient();
  const deleteModel = useMutation({
    mutationFn: (id: LocalModel) => localSttCommands.deleteModel(id),
    onSuccess: (result, id) => {
      if (result.status === "ok") {
        void queryClient.invalidateQueries({
          queryKey: sttModelQueries.isDownloaded(id).queryKey,
        });
        onClose();
      } else {
        toast.error(t`Couldn’t delete the model`, {
          description: result.error,
        });
      }
    },
  });

  const label = model ? displayModelLabel(model.id, model.displayName) : "";
  const size = model ? formatModelSize(model.sizeBytes) : null;

  return (
    <DestructiveConfirmationDialog
      open={model !== null}
      onOpenChange={(open) => {
        if (!open && !deleteModel.isPending) onClose();
      }}
      title={t`Delete ${label}?`}
      description={
        size
          ? t`You’ll need to download it again (${size}) to use it.`
          : t`You’ll need to download it again to use it.`
      }
      confirmLabel={t`Delete`}
      pendingLabel={t`Deleting…`}
      isPending={deleteModel.isPending}
      onConfirm={() => {
        if (!model || deleteModel.isPending) return;
        deleteModel.mutate(model.id as LocalModel);
      }}
    />
  );
}
