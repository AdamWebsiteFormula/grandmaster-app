import { useLingui } from "@lingui/react/macro";
import { useRef } from "react";

import { toast } from "@anlg/ui/components/ui/toast";

import { getRecommendedModel } from "~/settings/ai/shared/model-list-enrich";
import { setSettingValues } from "~/settings/queries";

export function useProviderSelectionPrompt({
  providerType,
  providerId,
  providerName,
  currentProvider,
  providerStateReady,
  storedApiKey,
}: {
  providerType: "llm" | "stt";
  providerId: string;
  providerName: string;
  currentProvider?: string;
  providerStateReady: boolean;
  storedApiKey?: string;
}) {
  const { t } = useLingui();
  const hadApiKeyRef = useRef<boolean | null>(null);

  if (providerStateReady && hadApiKeyRef.current === null) {
    hadApiKeyRef.current = !!storedApiKey?.trim();
  }

  return (savedApiKey: string) => {
    const hasApiKey = !!savedApiKey.trim();
    const hadApiKey = hadApiKeyRef.current;

    if (hadApiKey !== null) {
      hadApiKeyRef.current = hasApiKey;
    }

    if (hadApiKey !== false || !hasApiKey || currentProvider === providerId) {
      return;
    }

    // Fork: a first key replaces "nothing chosen" or the on-device fallback
    // right away, with Undo (NN/g: prefer undo over confirmation for
    // reversible actions). A provider the user chose still gets the prompt.
    if (
      !currentProvider ||
      (providerType === "llm" && currentProvider === "apple_foundation")
    ) {
      // Pick the catalog's recommended model now, so the picker never sits
      // on an empty model that auto-resolution has to fill.
      const selectValues =
        providerType === "llm"
          ? {
              current_llm_provider: providerId,
              current_llm_model: getRecommendedModel(providerId) ?? "",
            }
          : { current_stt_provider: providerId, current_stt_model: "" };
      void setSettingValues(selectValues).catch((error) => {
        console.error(
          `[settings] failed to select ${providerType} provider`,
          error,
        );
      });
      toast.success(t`Using ${providerName}`, {
        id: `provider-selection:${providerType}:${providerId}`,
        description: t`Your key works. ${providerName} is now the current provider.`,
        // With nothing chosen before, Undo would clear the provider and
        // default resolution would pick this one again at once.
        action: currentProvider
          ? {
              label: t`Undo`,
              onClick: () => {
                void setSettingValues(
                  providerType === "llm"
                    ? {
                        current_llm_provider: currentProvider,
                        current_llm_model: "",
                      }
                    : {
                        current_stt_provider: currentProvider,
                        current_stt_model: "",
                      },
                ).catch((error) => {
                  console.error(
                    `[settings] failed to undo ${providerType}`,
                    error,
                  );
                });
              },
            }
          : undefined,
      });
      return;
    }

    toast.success(t`API key saved`, {
      id: `provider-selection:${providerType}:${providerId}`,
      duration: Infinity,
      description: t`Set ${providerName} as the current provider?`,
      action: {
        label: t`Set as current`,
        onClick: () => {
          void setSettingValues(
            providerType === "llm"
              ? {
                  current_llm_provider: providerId,
                  current_llm_model: "",
                }
              : {
                  current_stt_provider: providerId,
                  current_stt_model: "",
                },
          ).catch((error) => {
            console.error(
              `[settings] failed to select ${providerType} provider`,
              error,
            );
          });
        },
      },
    });
  };
}
