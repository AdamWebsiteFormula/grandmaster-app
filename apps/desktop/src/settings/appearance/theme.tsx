import { Trans, useLingui } from "@lingui/react/macro";
import { type KeyboardEvent, useRef } from "react";

import { Palette } from "@anlg/ui/components/icons";
import { useSquircleRef } from "@anlg/ui/hooks/use-squircle";
import { cn } from "@anlg/utils";

import { useSetSettingValue } from "~/settings/queries";
import {
  SEGMENT_BASE_CLASS,
  SEGMENT_IDLE_CLASS,
  SEGMENT_SELECTED_CLASS,
  SEGMENT_TRACK_CLASS,
  SettingRow,
} from "~/settings/setting-row";
import { useConfigValue } from "~/shared/config";
import { isMac } from "~/shared/shortcut-label";
import { normalizeAppIconPreference } from "~/shared/theme/icon";
import { applyThemePreference } from "~/shared/theme/provider";
import type { ThemePreference } from "~/shared/theme/resolve";

const THEME_OPTIONS = [
  "light",
  "dark",
  "system",
] as const satisfies readonly ThemePreference[];

// Fork: Theme is one row with a text segmented control, not three preview
// cards (grandmaster/sops/settings-ia-oct3.md Q1). Granola (Preferences ›
// Appearance › Theme) and Claude desktop (Appearance › Theme) both use one
// compact row; NN/g "Does your form really need a dropdown list?" shows all
// options when there are only a few; Apple HIG "Segmented controls" fits 2
// to 5 closely related choices and prefers text or images, not both.
export function ThemeSelector() {
  const { t } = useLingui();
  const storedValue = useConfigValue("theme") as ThemePreference;
  const value = THEME_OPTIONS.includes(storedValue) ? storedValue : "system";
  const appIcon = normalizeAppIconPreference(useConfigValue("app_icon"));
  const setTheme = useSetSettingValue("theme");
  const trackRef = useSquircleRef<HTMLDivElement>();
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Fork: off a Mac the theme that follows the OS reads "Use system
  // setting", as Windows 11 Notepad words it (Settings › App theme).
  const mac = isMac();
  const options = [
    { value: "light", label: t`Light` },
    { value: "dark", label: t`Dark` },
    { value: "system", label: mac ? t`Match my Mac` : t`Use system setting` },
  ] as const satisfies readonly { value: ThemePreference; label: string }[];

  const choose = (next: ThemePreference) => {
    void applyThemePreference(next, appIcon);
    setTheme(next);
  };

  // WAI-ARIA radio group: arrow keys move and select
  // (w3.org/WAI/ARIA/apg/patterns/radio).
  const onKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const nextIndex = (index + step + options.length) % options.length;
    choose(options[nextIndex].value);
    buttonRefs.current[nextIndex]?.focus();
  };

  return (
    <SettingRow
      icon={Palette}
      title={<Trans>Theme</Trans>}
      description={
        mac ? (
          <Trans>Light, dark, or the same as your Mac.</Trans>
        ) : (
          <Trans>Light, dark, or the same as your computer.</Trans>
        )
      }
      controlWidth="content"
    >
      {(labelProps) => (
        <div
          ref={trackRef}
          role="radiogroup"
          {...labelProps}
          className={SEGMENT_TRACK_CLASS}
        >
          {options.map((option, index) => {
            const selected = value === option.value;
            return (
              <button
                key={option.value}
                ref={(element) => {
                  buttonRefs.current[index] = element;
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => choose(option.value)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className={cn([
                  "rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  SEGMENT_BASE_CLASS,
                  selected ? SEGMENT_SELECTED_CLASS : SEGMENT_IDLE_CLASS,
                ])}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </SettingRow>
  );
}
