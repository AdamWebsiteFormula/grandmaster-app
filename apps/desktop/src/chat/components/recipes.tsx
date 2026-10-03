// Fork: recipe and follow-up chips, as Granola's chat shows them: a row of
// recipes above the note chat field, a "Say more" chip under an answer, and
// recipes on the Chat page (Granola recipes,
// docs.granola.ai/help-center/getting-more-from-your-notes/recipes; NN/g #6,
// recognition rather than recall). One chip style everywhere.
import { t } from "@lingui/core/macro";
import type { ReactNode } from "react";

import {
  ArrowsOutSimple,
  CalendarBlank,
  Envelope,
  ListChecks,
  MagnifyingGlass,
  TextAlignLeft,
} from "@anlg/ui/components/icons";
import { cn } from "@anlg/utils";

export type ChatRecipe = {
  label: string;
  icon?: typeof ListChecks;
  prompt: string;
};

// Home chat (no note open) gets starter prompts across all meetings
// (ux-audit-oct3 D P1). use-transport.ts tells the model which meeting tools
// answer each one. The home composer shows the same prompts as chips.
export function homeChatSuggestions(): Required<ChatRecipe>[] {
  return [
    {
      label: t`What did I commit to this week?`,
      icon: ListChecks,
      prompt: t`What did I commit to this week?`,
    },
    {
      label: t`Summarize this week's meetings`,
      icon: TextAlignLeft,
      prompt: t`Summarize this week's meetings`,
    },
    {
      label: t`Prep me for my next meeting`,
      icon: CalendarBlank,
      prompt: t`Prep me for my next meeting`,
    },
  ];
}

/** Recipes for a chat about one note. */
export function noteChatRecipes(): ChatRecipe[] {
  // Chip labels have no trailing periods (ux-audit-oct3 D, HIG buttons).
  return [
    {
      label: t`List action items`,
      icon: ListChecks,
      prompt: t`What are my action items from this meeting?`,
    },
    {
      label: t`Draft follow-up email`,
      icon: Envelope,
      prompt: t`Draft a follow-up email to the participants`,
    },
    {
      label: t`Find key decisions`,
      icon: MagnifyingGlass,
      prompt: t`What were the key decisions that have been made?`,
    },
    {
      label: t`Write TL;DR`,
      icon: TextAlignLeft,
      prompt: t`Write a short TL;DR of this meeting`,
    },
  ];
}

/** Recipes for the Chat page: Home's starters plus two across meetings. */
export function chatPageRecipes(): ChatRecipe[] {
  return [
    ...homeChatSuggestions(),
    {
      label: t`Draft follow-up email`,
      icon: Envelope,
      prompt: t`Draft a follow-up email for my most recent meeting`,
    },
    {
      label: t`List action items`,
      icon: ListChecks,
      prompt: t`List the action items from my recent meetings`,
    },
  ];
}

/** Follow-ups under the last answer (Granola: "Say more"). */
export function followUpRecipes(): ChatRecipe[] {
  return [
    { label: t`Say more`, icon: ArrowsOutSimple, prompt: t`Say more` },
    { label: t`Make it shorter`, prompt: t`Make it shorter` },
    { label: t`Turn into an email`, prompt: t`Turn that into an email` },
  ];
}

export const RECIPE_CHIP_CLASS =
  "border-border text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-xs whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-hidden disabled:cursor-default disabled:opacity-45";

export function RecipeChip({
  recipe,
  disabled,
  onSelect,
}: {
  recipe: ChatRecipe;
  disabled?: boolean;
  onSelect: (prompt: string) => void;
}) {
  const Icon = recipe.icon;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(recipe.prompt)}
      className={RECIPE_CHIP_CLASS}
    >
      {Icon ? <Icon size={14} className="shrink-0" aria-hidden="true" /> : null}
      <span>{recipe.label}</span>
    </button>
  );
}

/** A row of chips: one scrollable line, or wrapped onto more lines. */
export function RecipeRow({
  recipes,
  label,
  disabled,
  onSelect,
  wrap = false,
  className,
  children,
}: {
  recipes: ChatRecipe[];
  label: string;
  disabled?: boolean;
  onSelect: (prompt: string) => void;
  wrap?: boolean;
  className?: string;
  /** Extra chips after the recipes (the Chat page's "See all"). */
  children?: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn([
        "flex min-w-0 items-center gap-1.5",
        // Room for the focus ring inside the scroll box.
        wrap ? "flex-wrap" : "scrollbar-hide overflow-x-auto p-0.5",
        className,
      ])}
    >
      {recipes.map((recipe) => (
        <RecipeChip
          key={recipe.label}
          recipe={recipe}
          disabled={disabled}
          onSelect={onSelect}
        />
      ))}
      {children}
    </div>
  );
}
