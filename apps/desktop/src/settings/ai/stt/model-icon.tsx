import { Apple } from "@lobehub/icons";
import type { ReactNode } from "react";

import { cn } from "@anlg/utils";

import { AiIconSlot, ProviderLobeIcon } from "~/settings/ai/shared";
import { staticAssetUrl, fallbackToLocalAsset } from "~/shared/static-assets";

type ModelIconSpec = {
  title: string;
  label?: string;
  className?: string;
  imageSrc?: string;
  imageClassName?: string;
  node?: ReactNode;
};

const MODEL_ICON_ASSET_BASE = "/assets/model-icons";
const ANARLOG_ICON_SRC = "/assets/anarlog-icon.png";

function getLocalModelIcon(model: string): ModelIconSpec | null {
  const value = model.toLowerCase();

  if (value === "cloud") {
    return {
      label: "A",
      // Fork: the free cloud model is Upshot transcription, not a Pro perk.
      title: "Upshot transcription",
      imageSrc: ANARLOG_ICON_SRC,
    };
  }

  if (value === "apple-speech") {
    return {
      title: "Apple Speech",
      node: <ProviderLobeIcon icon={Apple} />,
    };
  }

  if (value.includes("qwen")) {
    return {
      label: "Q",
      title: "Qwen",
      imageSrc: `${MODEL_ICON_ASSET_BASE}/qwen-logo.svg`,
    };
  }

  if (value.includes("omnilingual")) {
    return {
      label: "O",
      title: "Meta Omnilingual",
      imageSrc: `${MODEL_ICON_ASSET_BASE}/meta-logo.svg`,
    };
  }

  if (value.includes("whisper") || value.includes("quantized")) {
    return {
      label: "W",
      title: "OpenAI Whisper",
      imageSrc: `${MODEL_ICON_ASSET_BASE}/openai-logo.svg`,
    };
  }

  if (value.includes("parakeet")) {
    return {
      label: "P",
      title: "NVIDIA Parakeet",
      imageSrc: `${MODEL_ICON_ASSET_BASE}/nvidia-logo.svg`,
      imageClassName: "object-cover object-left",
    };
  }

  if (value.includes("ggml") || value.includes("gguf")) {
    return {
      label: "G",
      title: "GGML",
      // Fork: neutral tokens, like the NPU badge, so badges adapt to dark mode
      // (Apple HIG, Dark Mode: avoid hard-coded colors that do not adapt).
      className: "rounded-md border-border bg-muted text-muted-foreground",
    };
  }

  if (value.includes("soniqo")) {
    return {
      label: "S",
      title: "Soniqo",
      className: "rounded-md border-border bg-muted text-muted-foreground",
    };
  }

  return null;
}

function getLocalModelBackendBadge(model: string): ModelIconSpec | null {
  const value = model.toLowerCase();

  if (value.includes("nvidia") || value.includes("cuda")) {
    return {
      label: "NV",
      title: "NVIDIA",
      className: "border-border bg-muted text-muted-foreground",
    };
  }

  if (value === "apple-speech") {
    return null;
  }

  if (value.includes("apple") || value.includes("npu")) {
    return {
      label: "NPU",
      title: "Apple NPU",
      className: "border-border bg-muted text-muted-foreground",
    };
  }

  if (value.includes("ggml") || value.includes("gguf")) {
    return {
      label: "GGML",
      title: "GGML runtime",
      className: "border-border bg-muted text-muted-foreground",
    };
  }

  return null;
}

export function LocalModelLabel({
  model,
  label,
  title,
  className,
  labelClassName,
}: {
  model: string;
  label: string;
  title?: string;
  className?: string;
  labelClassName?: string;
}) {
  const icon = getLocalModelIcon(model);

  return (
    <div
      title={title}
      className={cn(["flex min-w-0 items-center gap-2", className])}
    >
      {icon ? (
        // Fork: 16 px, the same as the provider logo in the first picker
        // (NN/g #4, consistency).
        <AiIconSlot
          title={icon.title}
          className={cn(["size-4", icon.className])}
        >
          {icon.node ??
            (icon.imageSrc ? (
              <img
                src={staticAssetUrl(icon.imageSrc)}
                onError={fallbackToLocalAsset(icon.imageSrc)}
                alt=""
                className={cn([
                  "object-contain object-center",
                  icon.imageClassName,
                ])}
              />
            ) : (
              <span className="text-xs leading-none font-semibold">
                {icon.label}
              </span>
            ))}
        </AiIconSlot>
      ) : null}
      <span className={cn(["min-w-0 truncate", labelClassName])}>{label}</span>
    </div>
  );
}

export function LocalModelBackendBadge({ model }: { model: string }) {
  const badge = getLocalModelBackendBadge(model);

  if (!badge) {
    return null;
  }

  return (
    <span
      title={badge.title}
      className={cn([
        "inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-xs leading-none font-medium",
        badge.className,
      ])}
    >
      {badge.label}
    </span>
  );
}
