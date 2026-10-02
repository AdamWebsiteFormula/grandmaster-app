import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { getLlmProviderStatus } from "./select";
import { PROVIDERS } from "./shared";
import { useVanishedModelSwitch } from "./vanished-model";

import { useLLMConnection } from "~/ai/hooks";
import { catalogProviderFor } from "~/settings/ai/shared/model-catalog";
import { refreshRegistry } from "~/settings/ai/shared/model-registry";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Main-window launch work for the model picker: refresh the model catalog
 * when it is over 24 h old, then check that the saved model still exists.
 */
export function ModelRegistryInit() {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void refreshRegistry().then((changed) => {
      if (changed) {
        // Lists cached before the refresh carry old New flags and order.
        void queryClient.invalidateQueries({ queryKey: ["models"] });
      }
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, [queryClient]);

  return ready ? <SavedModelCheck /> : null;
}

function SavedModelCheck() {
  const { conn } = useLLMConnection();
  const providerId = conn?.providerId;
  const modelId = conn?.modelId;
  const baseUrl = conn?.baseUrl;
  const apiKey = conn?.apiKey;

  const listModels = useMemo(() => {
    if (!providerId || !catalogProviderFor(providerId)) return undefined;
    const provider = PROVIDERS.find((p) => p.id === providerId);
    if (!provider) return undefined;
    return getLlmProviderStatus({
      provider,
      config: { base_url: baseUrl, api_key: apiKey },
      isAuthenticated: true,
      isPaid: true,
      isAvailable: true,
    }).listModels;
  }, [providerId, baseUrl, apiKey]);

  const { data } = useQuery({
    queryKey: ["models", providerId, listModels],
    queryFn: () => listModels!(),
    enabled: !!listModels,
    staleTime: DAY_MS,
    retry: 1,
  });

  useVanishedModelSwitch(providerId, modelId, data);
  return null;
}
