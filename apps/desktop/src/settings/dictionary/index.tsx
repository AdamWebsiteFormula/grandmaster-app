import { Trans, useLingui } from "@lingui/react/macro";
import { useForm } from "@tanstack/react-form";
import { useId, useState } from "react";

import {
  BookOpen,
  Check,
  MinusCircle,
  PencilSimple,
  Plus,
  X,
} from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";
import { Input } from "@anlg/ui/components/ui/input";
import { toast } from "@anlg/ui/components/ui/toast";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@anlg/ui/components/ui/input-group";

import { trackAnalyticsEvent } from "~/analytics";
import { SettingsSectionTitle } from "~/settings/page-title";
import { useSetSettingValue } from "~/settings/queries";
import { settingsSectionId } from "~/settings/sections";
import { SettingsGroup } from "~/settings/setting-row";
import { useConfigValue } from "~/shared/config";
import { normalizeKeywordList, parseDictionaryTermsText } from "~/stt/keywords";

// Fork: Dictionary is a section of Transcription, since its words help the
// transcript and summaries spell names right (grandmaster/sops/
// settings-ia-oct3.md Q3).
export function DictionarySection() {
  const terms = useConfigValue("personalization_dictionary_terms");
  const setTerms = useSetSettingValue("personalization_dictionary_terms");
  const titleId = useId();

  // Fork: Dictionary is local (terms feed transcription and summaries on
  // this Mac), so it is open to everyone instead of a dimmed Pro form with
  // no explanation (ux-audit-oct3 E, NN/g #1, #6).
  return (
    <section
      id={settingsSectionId("dictionary")}
      aria-labelledby={titleId}
      className="flex min-w-0 scroll-mt-6 flex-col gap-2"
    >
      <div className="flex min-h-6 items-center">
        <SettingsSectionTitle id={titleId}>
          <Trans>Dictionary</Trans>
        </SettingsSectionTitle>
      </div>
      <DictionarySettings terms={terms} onSave={setTerms} />
    </section>
  );
}

export function DictionarySettings({
  terms,
  onSave,
}: {
  terms: string[];
  onSave: (value: string) => void;
}) {
  const { t } = useLingui();
  const hintId = useId();
  const normalizedTerms = normalizeKeywordList(terms);

  const form = useForm({
    defaultValues: {
      term: "",
    },
    onSubmit: ({ value }) => {
      const nextTerms = appendDictionaryTerms(normalizedTerms, value.term);
      if (nextTerms.length === normalizedTerms.length) {
        return;
      }

      onSave(JSON.stringify(nextTerms));
      trackAnalyticsEvent("dictionary_updated", {
        operation: "added",
        term_count: nextTerms.length,
        added_count: nextTerms.length - normalizedTerms.length,
      });
      form.setFieldValue("term", "");
    },
  });

  const removeTerm = (term: string) => {
    const nextTerms = normalizedTerms.filter((value) => value !== term);
    const previousTerms = normalizedTerms;
    onSave(JSON.stringify(nextTerms));
    // Fork: Remove took the term at once with no way back. Offer Undo, as
    // Delete note and Remove from folder do (task test, Oct 8; NN/g #3).
    toast(t`Removed “${term}”`, {
      id: `dictionary-removed-${term}`,
      action: {
        label: t`Undo`,
        onClick: () => onSave(JSON.stringify(previousTerms)),
      },
    });
    trackAnalyticsEvent("dictionary_updated", {
      operation: "removed",
      term_count: nextTerms.length,
      removed_count: normalizedTerms.length - nextTerms.length,
    });
  };

  const editTerm = (term: string, nextTerm: string) => {
    const nextTerms = normalizedTerms.map((value) =>
      value === term ? nextTerm : value,
    );
    onSave(JSON.stringify(nextTerms));
    trackAnalyticsEvent("dictionary_updated", {
      operation: "edited",
      term_count: nextTerms.length,
      edited_count: 1,
    });
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      {/* Fork: the field sits in a card like every other page, and Add uses
          tokens, not hard-coded black and white (journey-account-settings
          P3; design-system tokens; NN/g #4). The InputGroup focus ring
          stays, so keyboard focus shows (WCAG 2.2 SC 2.4.7). */}
      <SettingsGroup>
        <div className="flex flex-col gap-2">
          <InputGroup className="border-input bg-card has-[[data-slot=input-group-control]:focus-visible]:border-input h-8 shadow-none">
            <form.Field name="term">
              {(field) => (
                <InputGroupInput
                  // Fork: the 12 pt text inset of the other Settings fields
                  // (picture review, Oct 6: 18.5 pt; NN/g #4).
                  className="pr-3 pl-3"
                  aria-label={t`Add a term`}
                  aria-describedby={hintId}
                  placeholder={t`Add a term`}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                />
              )}
            </form.Field>
            {/* Fork: pr-[9px] leaves Add 3 pt from the field's right edge,
                as from its top and bottom (picture review, Oct 7: 6.5 pt). */}
            <InputGroupAddon align="inline-end" className="pr-[9px]">
              <form.Subscribe selector={(state) => state.values.term}>
                {(value) => {
                  const canAdd =
                    appendDictionaryTerms(normalizedTerms, value).length !==
                    normalizedTerms.length;

                  return (
                    <InputGroupButton
                      type="submit"
                      variant="secondary"
                      size="xs"
                      // Fork: dims to about 3.4:1 in dark, as it does in light
                      // (picture review, Oct 8: 50% opacity left it at 5.05:1
                      // on the dark card, reading as enabled; Apple HIG,
                      // Dark Mode: same state in both). `!` because
                      // @anlg/ui's disabled:opacity-50 loads later.
                      className="dark:disabled:opacity-40!"
                      disabled={!canAdd}
                      aria-label={t`Add`}
                    >
                      <Plus className="size-3.5" />
                      <Trans>Add</Trans>
                    </InputGroupButton>
                  );
                }}
              </form.Subscribe>
            </InputGroupAddon>
          </InputGroup>
          <p id={hintId} className="text-muted-foreground text-xs">
            <Trans>
              Names, jargon, and product terms Upshot should spell your way.
            </Trans>
          </p>
        </div>
        {/* Fork: with no terms yet, the empty state is a short row in the
            same card as the field, as macOS Text Replacements shows its
            empty list inside its group (picture review, Oct 8: a separate
            158 pt card for two lines; NN/g empty states). */}
        {normalizedTerms.length === 0 ? (
          <div className="flex flex-col items-center text-center">
            <BookOpen className="text-muted-foreground mb-2 size-4" />
            <p className="text-sm font-medium">
              <Trans>Your dictionary is empty</Trans>
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              <Trans>Terms you add show up here.</Trans>
            </p>
          </div>
        ) : null}
      </SettingsGroup>

      <form.Subscribe selector={(state) => state.values.term}>
        {(value) => {
          const visibleTerms = getVisibleDictionaryTerms(
            normalizedTerms,
            value,
          );
          const hasSearch = parseDictionaryTermsText(value).length > 0;

          // The empty state lives in the field's card above.
          if (normalizedTerms.length === 0) {
            return null;
          }

          if (visibleTerms.length === 0) {
            return hasSearch ? (
              <p className="text-muted-foreground px-4 text-sm">
                <Trans>No match</Trans>
              </p>
            ) : null;
          }

          return (
            <div className="border-border bg-card dark:bg-muted divide-border divide-y overflow-hidden rounded-xl border">
              {visibleTerms.map((term) => (
                <DictionaryTermRow
                  key={term}
                  term={term}
                  terms={normalizedTerms}
                  onEdit={editTerm}
                  onRemove={removeTerm}
                />
              ))}
            </div>
          );
        }}
      </form.Subscribe>
    </form>
  );
}

function DictionaryTermRow({
  term,
  terms,
  onEdit,
  onRemove,
}: {
  term: string;
  terms: string[];
  onEdit: (term: string, nextTerm: string) => void;
  onRemove: (term: string) => void;
}) {
  const { t } = useLingui();
  const [editValue, setEditValue] = useState<string | null>(null);
  const nextTerm =
    editValue === null ? null : getEditedDictionaryTerm(terms, term, editValue);

  const saveEdit = () => {
    if (!nextTerm) return;
    onEdit(term, nextTerm);
    setEditValue(null);
  };

  if (editValue !== null) {
    return (
      <div className="flex min-h-12 items-center gap-2 py-2 pr-3 pl-4">
        <Input
          autoFocus
          className="h-8 min-w-0 flex-1"
          value={editValue}
          onChange={(event) => setEditValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              saveEdit();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setEditValue(null);
            }
          }}
          aria-label={`${t`Edit`}: ${term}`}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground size-7 shrink-0"
          onClick={saveEdit}
          disabled={!nextTerm}
          aria-label={t`Save`}
        >
          <Check className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground size-7 shrink-0"
          onClick={() => setEditValue(null)}
          aria-label={t`Cancel`}
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="group flex min-h-12 items-center justify-between gap-3 py-3 pr-3 pl-4">
      <span className="text-sm">{term}</span>
      <div className="flex items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          onClick={() => setEditValue(term)}
          aria-label={`${t`Edit`}: ${term}`}
        >
          <PencilSimple className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          onClick={() => onRemove(term)}
          aria-label={t`Remove ${term}`}
        >
          <MinusCircle className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function appendDictionaryTerms(terms: string[], value: string): string[] {
  return normalizeKeywordList([...terms, ...parseDictionaryTermsText(value)]);
}

function getEditedDictionaryTerm(
  terms: string[],
  currentTerm: string,
  value: string,
): string | null {
  const [nextTerm] = normalizeKeywordList([value]);
  if (!nextTerm || nextTerm === currentTerm) return null;

  const nextKey = nextTerm.toLocaleLowerCase();
  const isDuplicate = terms.some(
    (term) => term !== currentTerm && term.toLocaleLowerCase() === nextKey,
  );
  return isDuplicate ? null : nextTerm;
}

function getVisibleDictionaryTerms(terms: string[], value: string): string[] {
  const queries = parseDictionaryTermsText(value).map((term) =>
    term.toLocaleLowerCase(),
  );
  if (queries.length === 0) {
    return terms;
  }

  return terms.filter((term) => {
    const key = term.toLocaleLowerCase();
    return queries.some((query) => key.includes(query) || query.includes(key));
  });
}
