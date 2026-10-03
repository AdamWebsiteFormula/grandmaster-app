import { Trans, useLingui } from "@lingui/react/macro";
import { useMemo, useState } from "react";

import { Plus, Translate, X } from "@anlg/ui/components/icons";
import { Badge } from "@anlg/ui/components/ui/badge";
import { Button } from "@anlg/ui/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@anlg/ui/components/ui/command";
import {
  AppFloatingPanel,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@anlg/ui/components/ui/popover";
import { cn } from "@anlg/utils";

import {
  getAdditionalSpokenLanguages,
  getBaseLanguageCode,
  getBaseLanguageDisplayName,
} from "./language";

import { SettingRow } from "~/settings/setting-row";

interface SpokenLanguagesViewProps {
  mainLanguage: string;
  value: string[];
  onChange: (value: string[]) => void;
  supportedLanguages: readonly string[];
}

const filterFunction = (value: string, search: string) =>
  value.toLocaleLowerCase().includes(search.toLocaleLowerCase()) ? 1 : 0;

// Fork: a settings row with a right-aligned "Add language" button that opens
// the same searchable list as Main language, and the added languages as
// removable chips under it. It replaces a full-width input, as macOS System
// Settings › Language & Region adds a language from a button that opens a
// searchable list (redline3-oct3 S1).
export function SpokenLanguagesView({
  mainLanguage,
  value,
  onChange,
  supportedLanguages,
}: SpokenLanguagesViewProps) {
  const { i18n, t } = useLingui();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const supportedLanguageCodes = useMemo(() => {
    const seen = new Set<string>();
    const codes: string[] = [];

    for (const langCode of supportedLanguages) {
      const baseCode = getBaseLanguageCode(langCode);
      if (seen.has(baseCode)) continue;
      seen.add(baseCode);
      codes.push(baseCode);
    }

    return codes;
  }, [supportedLanguages]);

  const mainLanguageCode = getBaseLanguageCode(mainLanguage);
  const selectedLanguageCodes = useMemo(
    () => getAdditionalSpokenLanguages(mainLanguage, value),
    [mainLanguage, value],
  );

  const availableLanguages = useMemo(
    () =>
      supportedLanguageCodes
        .filter(
          (code) =>
            code !== mainLanguageCode && !selectedLanguageCodes.includes(code),
        )
        .map((code) => ({
          code,
          label: getBaseLanguageDisplayName(code, i18n.locale),
        })),
    [
      i18n.locale,
      mainLanguageCode,
      selectedLanguageCodes,
      supportedLanguageCodes,
    ],
  );

  const add = (code: string) => {
    onChange([...selectedLanguageCodes, code]);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="flex flex-col gap-3">
      <SettingRow
        icon={Translate}
        title={<Trans>Additional spoken languages</Trans>}
        description={
          <Trans>Transcribe meetings that use more than one language.</Trans>
        }
        controlWidth="content"
      >
        {(labelProps) => (
          <Popover
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) setQuery("");
            }}
          >
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-describedby={labelProps["aria-describedby"]}
                disabled={availableLanguages.length === 0}
                className="bg-card gap-1 shadow-none"
              >
                <Plus aria-hidden className="size-3.5" />
                <Trans>Add language</Trans>
              </Button>
            </PopoverTrigger>
            <PopoverContent variant="app" align="end" className="w-60">
              <AppFloatingPanel className="overflow-hidden">
                <Command
                  filter={filterFunction}
                  className="rounded-[inherit] border-0 bg-transparent"
                >
                  <CommandInput
                    aria-label={t`Search languages`}
                    placeholder={t`Search languages…`}
                    value={query}
                    onValueChange={setQuery}
                  />
                  <CommandEmpty>
                    <div className="text-muted-foreground px-2 py-1.5 text-sm">
                      <Trans>No matching languages found</Trans>
                    </div>
                  </CommandEmpty>
                  <CommandList>
                    <CommandGroup className="max-h-[250px] overflow-y-auto">
                      {availableLanguages.map((language) => (
                        <CommandItem
                          key={language.code}
                          value={`${language.label} ${language.code}`}
                          onSelect={() => add(language.code)}
                          className={cn([
                            "cursor-pointer",
                            "hover:bg-accent! focus:bg-accent! aria-selected:bg-transparent",
                          ])}
                        >
                          <span className="flex-1 truncate">
                            {language.label}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </AppFloatingPanel>
            </PopoverContent>
          </Popover>
        )}
      </SettingRow>

      {selectedLanguageCodes.length > 0 ? (
        <ul
          aria-label={t`Additional spoken languages`}
          className="flex flex-wrap gap-1.5 pl-11"
        >
          {selectedLanguageCodes.map((code) => {
            const name = getBaseLanguageDisplayName(code, i18n.locale);
            return (
              <li key={code}>
                <Badge
                  variant="secondary"
                  className="bg-accent text-foreground flex items-center gap-1 py-0.5 pr-0.5 pl-2 text-xs font-medium"
                >
                  {name}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={t`Remove ${name}`}
                    className="size-5 rounded-full p-0 hover:bg-transparent"
                    onClick={() =>
                      onChange(selectedLanguageCodes.filter((c) => c !== code))
                    }
                  >
                    <X aria-hidden className="size-3" />
                  </Button>
                </Badge>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
