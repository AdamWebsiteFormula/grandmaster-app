import { useLingui } from "@lingui/react/macro";
import { useEffect } from "react";

import { toast } from "@anlg/ui/components/ui/toast";

import type { ListModelsResult } from "~/settings/ai/shared/list-common";
import { displayLlmModelId } from "~/settings/ai/shared/model-display";
import { resolveVanishedModel } from "~/settings/ai/shared/model-list-enrich";
import { setSettingValues } from "~/settings/queries";

// One switch per saved model per session, even if both the launch check
// and the settings picker notice it.
const handled = new Set<string>();

/**
 * When the saved model has disappeared from its provider's live list,
 * switch to the newest model in the same family and say so in a toast.
 */
export function useVanishedModelSwitch(
  providerId: string | undefined,
  savedModel: string | undefined,
  result: ListModelsResult | undefined,
) {
  const { t } = useLingui();

  useEffect(() => {
    if (!providerId || !savedModel) return;
    const next = resolveVanishedModel(providerId, savedModel, result);
    if (!next) return;
    const key = `${providerId}:${savedModel}`;
    if (handled.has(key)) return;
    handled.add(key);

    const from = displayLlmModelId(providerId, savedModel);
    const to =
      result?.metadata[next]?.displayName ??
      displayLlmModelId(providerId, next);
    void setSettingValues({
      current_llm_provider: providerId,
      current_llm_model: next,
      current_llm_reasoning_effort: "default",
    })
      .then(() => {
        toast.info(t`Switched to ${to}`, {
          description: t`${from} is no longer available.`,
        });
      })
      .catch((error) => {
        handled.delete(key);
        console.error("[settings] failed to replace a retired model", error);
      });
  }, [providerId, savedModel, result, t]);
}
