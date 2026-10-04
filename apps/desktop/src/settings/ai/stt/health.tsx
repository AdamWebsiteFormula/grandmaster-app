import { useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

import { usesDeferredProviderAuthentication } from "@anlg/provider-validation";
import { Spinner } from "@anlg/ui/components/ui/spinner";

import { useConfigValues } from "~/shared/config";
import {
  isAnarlogCloudSttModel,
  isLocalFileSttModel,
  isOnDeviceSttModel,
} from "~/stt/capabilities";
import { useSTTConnection } from "~/stt/useSTTConnection";

export type HealthStatus = {
  status: "pending" | "error" | "success" | null;
  message?: string;
};

export function HealthStatusIndicator() {
  const health = useConnectionHealth();

  if (health.status === "pending") {
    return <Spinner size={14} className="text-muted-foreground shrink-0" />;
  }

  return null;
}

function useDeepgramHealth(enabled: boolean, apiKey?: string) {
  return useQuery({
    enabled,
    queryKey: ["stt-health-check", "deepgram", apiKey],
    staleTime: 0,
    retry: 3,
    retryDelay: 200,
    queryFn: async () => {
      const response = await tauriFetch(
        "https://api.deepgram.com/v1/projects",
        {
          headers: {
            Authorization: `Token ${apiKey}`,
          },
        },
      );
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      return response.status;
    },
  });
}

// Fork: every error says how to fix it, in American English through t()
// (ux-audit-oct3 E, NN/g #9).
export function useConnectionHealth(): HealthStatus {
  const { t } = useLingui();
  const { conn, local } = useSTTConnection();
  const { current_stt_provider, current_stt_model } = useConfigValues([
    "current_stt_provider",
    "current_stt_model",
  ] as const);

  const isLocalModel =
    isOnDeviceSttModel(current_stt_provider, current_stt_model) ||
    isLocalFileSttModel(current_stt_provider, current_stt_model);
  const isManagedProvider = [
    "anarlog",
    "soniqo",
    "apple_speech",
    "local_file",
  ].includes(current_stt_provider ?? "");
  const isCloud =
    isAnarlogCloudSttModel(current_stt_provider, current_stt_model) ||
    !isManagedProvider;
  const isDeepgram = current_stt_provider === "deepgram";

  const deepgramHealth = useDeepgramHealth(isDeepgram && !!conn, conn?.apiKey);

  if (isManagedProvider && current_stt_model && !isCloud && !isLocalModel) {
    return {
      status: "error",
      message: t`This model is no longer available. Pick another model above.`,
    };
  }

  if (isLocalModel) {
    const serverStatus = local.data?.status ?? "unavailable";
    if (serverStatus === "not_downloaded") {
      return {
        status: "error",
        message: t`This model isn’t downloaded yet. Open the model menu and choose Download.`,
      };
    }
    if (serverStatus === "not_selected") {
      return {
        status: "error",
        message: t`No model file chosen yet. Choose one above.`,
      };
    }
    if (serverStatus === "error") {
      return {
        status: "error",
        message:
          local.data && "error" in local.data
            ? local.data.error
            : t`Couldn’t load the on-device model. Pick another model, or delete and download this one again.`,
      };
    }
    if (serverStatus === "loading") {
      return {
        status: "pending",
        message: t`Starting the on-device model…`,
      };
    }
    if (serverStatus === "ready" && conn) {
      return { status: "success" };
    }
    return {
      status: "error",
      message: t`Couldn’t reach the on-device model. Quit and reopen Upshot, or pick another model.`,
    };
  }

  if (!conn) {
    return {
      status: "error",
      message: t`This provider isn’t available in Upshot. Pick Upshot transcription above.`,
    };
  }

  if (isDeepgram) {
    if (deepgramHealth.isPending) {
      return { status: "pending", message: t`Checking your API key…` };
    }
    if (deepgramHealth.isError) {
      return {
        status: "error",
        message: t`This provider isn’t available in Upshot. Pick Upshot transcription above.`,
      };
    }
    if (deepgramHealth.isSuccess) {
      return { status: "success" };
    }
  }

  if (usesDeferredProviderAuthentication("stt", current_stt_provider ?? "")) {
    return {
      status: null,
      message: t`Credentials will be checked when transcription starts.`,
    };
  }
  return { status: "success" };
}
