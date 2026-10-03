import { t } from "@lingui/core/macro";
import { useCallback } from "react";

import {
  Envelope,
  ListChecks,
  MagnifyingGlass,
} from "@anlg/ui/components/icons";
import { cn } from "@anlg/utils";

import type { ContextRef } from "~/chat/context/entities";
import { useChatAppearance } from "~/chat/hooks/use-chat-appearance";

export function ChatBodyEmpty({
  isModelConfigured = true,
  hasContext = false,
  onSendMessage,
}: {
  isModelConfigured?: boolean;
  hasContext?: boolean;
  onSendMessage?: (
    content: string,
    parts: Array<{ type: "text"; text: string }>,
    contextRefs?: ContextRef[],
  ) => void;
}) {
  const { isDarkAppearance } = useChatAppearance();
  const suggestions = [
    {
      label: t`List action items.`,
      icon: ListChecks,
      prompt: t`What are my action items from this meeting?`,
    },
    {
      label: t`Draft follow-up email.`,
      icon: Envelope,
      prompt: t`Draft a follow-up email to the participants`,
    },
    {
      label: t`Find key decisions.`,
      icon: MagnifyingGlass,
      prompt: t`What were the key decisions that have been made?`,
    },
  ];

  const handleSuggestionClick = useCallback(
    (prompt: string) => {
      onSendMessage?.(prompt, [{ type: "text", text: prompt }]);
    },
    [onSendMessage],
  );

  if (!isModelConfigured) {
    return (
      <div className="flex justify-start py-2 pb-1">
        <div className="flex w-full flex-col">
          <div className="mb-2 flex items-center gap-2">
            <span
              className={cn([
                "text-sm font-medium",
                isDarkAppearance
                  ? "text-primary-foreground"
                  : "text-foreground",
              ])}
            >
              Upshot AI
            </span>
            <BetaChip isDarkAppearance={isDarkAppearance} />
          </div>
          <p
            className={cn([
              "mb-2 text-sm",
              isDarkAppearance
                ? "text-primary-foreground/80"
                : "text-muted-foreground",
            ])}
          >
            {/* Fork: no AI settings to send people to, as in Granola
                (docs.granola.ai/help-center/getting-more-from-your-notes/understanding-model-selection-in-granola-chat). */}
            {t`Upshot AI is getting ready. Try again in a minute.`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start pb-1">
      <div className="flex w-full flex-col">
        {hasContext && (
          <div className="flex flex-col gap-0.5">
            {suggestions.map(({ label, icon: Icon, prompt }) => (
              <button
                key={label}
                onClick={() => handleSuggestionClick(prompt)}
                className={cn([
                  "group grid w-full grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-x-1.5 rounded-lg py-2 pr-3 pl-0 text-left text-sm",
                  isDarkAppearance
                    ? "text-primary-foreground/85 hover:bg-primary-foreground/10"
                    : "text-muted-foreground hover:bg-muted/55",
                  "transition-colors",
                ])}
              >
                <span className="flex size-6 items-center justify-center">
                  <Icon
                    size={16}
                    className={cn([
                      "shrink-0 transition-colors",
                      isDarkAppearance
                        ? "text-primary-foreground/55 group-hover:text-primary-foreground/80"
                        : "text-muted-foreground/75 group-hover:text-foreground",
                    ])}
                  />
                </span>
                <span className="min-w-0 truncate">{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BetaChip({ isDarkAppearance }: { isDarkAppearance: boolean }) {
  return (
    <span
      className={cn([
        "rounded-full border px-1.5 py-0.5 text-xs font-medium",
        isDarkAppearance
          ? "border-border bg-accent text-accent-foreground"
          : "border-primary/30 bg-primary/10 text-primary",
      ])}
    >
      {t`Beta`}
    </span>
  );
}
