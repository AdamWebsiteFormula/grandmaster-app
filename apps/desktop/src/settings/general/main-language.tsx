import { Trans, useLingui } from "@lingui/react/macro";
import { useMemo } from "react";

import { Globe } from "@anlg/ui/components/icons";

import { getBaseLanguageDisplayName, parseLocale } from "./language";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "./searchable-select";

import { SettingRow } from "~/settings/setting-row";

export function MainLanguageView({
  value,
  onChange,
  supportedLanguages,
  stacked = false,
}: {
  value: string;
  onChange: (value: string) => void;
  supportedLanguages: readonly string[];
  /** Label above the select, for the transcript's narrow popover. */
  stacked?: boolean;
}) {
  const { i18n, t } = useLingui();

  const deduped = useMemo(() => {
    const map = new Map<string, string>();
    for (const code of supportedLanguages) {
      const { language } = parseLocale(code);
      if (!map.has(language)) {
        map.set(language, code);
      }
    }
    return map;
  }, [supportedLanguages]);

  const normalizedValue = useMemo(() => {
    const { language } = parseLocale(value);
    return deduped.get(language) ?? value;
  }, [value, deduped]);

  const options: SearchableSelectOption[] = useMemo(
    () =>
      [...deduped.values()].map((code) => ({
        value: code,
        label: getBaseLanguageDisplayName(code, i18n.locale),
      })),
    [deduped, i18n.locale],
  );

  return (
    <SettingRow
      icon={Globe}
      stacked={stacked}
      title={<Trans>Main language</Trans>}
      description={
        <Trans>Use this language for summaries and AI responses.</Trans>
      }
    >
      {(labelProps) => (
        <SearchableSelect
          {...labelProps}
          value={normalizedValue}
          onChange={onChange}
          options={options}
          placeholder={t`Select language`}
          searchPlaceholder={t`Search language…`}
          emptyMessage={t`No matching languages found`}
          className="w-full"
        />
      )}
    </SettingRow>
  );
}
