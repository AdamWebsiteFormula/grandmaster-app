import { Trans, useLingui } from "@lingui/react/macro";
import { useMemo } from "react";

import { CaretDown, Check } from "@anlg/ui/components/icons";
import {
  AppFloatingPanel,
  appFloatingMenuPanelClassName,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@anlg/ui/components/ui/dropdown-menu";
import { cn } from "@anlg/utils";

import {
  normalizeUpshotModel,
  pickUpshotModels,
  UPSHOT_AUTO_MODEL,
} from "~/ai/upshot-models";
import { useModelRegistry } from "~/settings/ai/shared/use-model-registry";
import { useSetSettingValue } from "~/settings/queries";
import { useConfigValue } from "~/shared/config";
import { openUpgrade, useUpshotPro } from "~/upshot-plan";

// Fork: Granola's chat composer has an "Auto" model menu; free plans get
// Auto only, paid plans pick a standard or thinking model from OpenAI,
// Anthropic and Google (docs.granola.ai/help-center/getting-more-from-your-notes/understanding-model-selection-in-granola-chat).
// Upshot builds the list from the OpenRouter catalog so it is always current.
export function ChatModelMenu({
  disabled,
  compact,
}: {
  disabled?: boolean;
  compact?: boolean;
}) {
  const { t } = useLingui();
  const isPro = useUpshotPro();
  const { registry } = useModelRegistry();
  const models = useMemo(
    () => pickUpshotModels(registry.providers.openrouter),
    [registry],
  );
  const saved = normalizeUpshotModel(useConfigValue("current_llm_model"));
  const setModel = useSetSettingValue("current_llm_model");
  const selected = isPro ? saved : UPSHOT_AUTO_MODEL;
  const label = models.find((model) => model.id === selected)?.name ?? t`Auto`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t`Model, ${label}`}
          title={label}
          disabled={disabled}
          data-chat-model-menu
          className={cn([
            "text-muted-foreground hover:bg-muted inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2 text-xs transition-colors",
            // The floating bar reserves a fixed width (chat-input.css).
            compact ? "w-[72px] justify-center" : "max-w-36",
            "disabled:cursor-default disabled:opacity-45",
          ])}
        >
          <span className="truncate">{label}</span>
          <CaretDown size={11} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent variant="app" align="end" className="w-60">
        <AppFloatingPanel className={appFloatingMenuPanelClassName}>
          <DropdownMenuItem
            onSelect={() => setModel(UPSHOT_AUTO_MODEL)}
            className="cursor-pointer"
          >
            <span className="flex-1">
              <Trans>Auto</Trans>
            </span>
            {selected === UPSHOT_AUTO_MODEL ? (
              <Check className="size-4" aria-hidden="true" />
            ) : null}
          </DropdownMenuItem>
          {models.length > 0 && <DropdownMenuSeparator />}
          {models.map((model) => (
            <DropdownMenuItem
              key={model.id}
              disabled={!isPro}
              onSelect={() => setModel(model.id)}
              className="cursor-pointer"
            >
              <span className="flex-1 truncate">{model.name}</span>
              {!isPro ? (
                <span className="text-muted-foreground border-border rounded-full border px-1.5 text-[10px] leading-4">
                  <Trans>Pro</Trans>
                </span>
              ) : selected === model.id ? (
                <Check className="size-4" aria-hidden="true" />
              ) : null}
            </DropdownMenuItem>
          ))}
          {!isPro && models.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => openUpgrade()}
                className="cursor-pointer"
              >
                <Trans>Upgrade to pick a model</Trans>
              </DropdownMenuItem>
            </>
          )}
        </AppFloatingPanel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
