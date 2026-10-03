import { Trans, useLingui } from "@lingui/react/macro";
import { useMemo } from "react";

import { Clock } from "@anlg/ui/components/icons";

import {
  SearchableSelect,
  type SearchableSelectOption,
} from "./searchable-select";

import { useSetSettingValue } from "~/settings/queries";
import { SettingRow } from "~/settings/setting-row";
import { useConfigValue } from "~/shared/config";

// Fork: every IANA zone the system knows, with its offset computed now (so
// daylight saving is right), plus a System choice that follows the Mac
// (ux-audit-oct3 E, NN/g #1, #2; macOS Date & Time lists every zone).
const SYSTEM_TIMEZONE_VALUE = "__system__";

const FALLBACK_TIMEZONES = [
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Atlantic/Reykjavik",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Cairo",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export function listTimeZones(): string[] {
  const supportedValuesOf = (
    Intl as unknown as {
      supportedValuesOf?: (key: "timeZone") => string[];
    }
  ).supportedValuesOf;
  try {
    const zones = supportedValuesOf?.("timeZone");
    if (zones && zones.length > 0) return zones;
  } catch {
    // Older engines: fall through to the short list.
  }
  return FALLBACK_TIMEZONES;
}

function timeZonePart(
  timeZone: string,
  timeZoneName: string,
  date: Date,
  locale?: string,
): string | undefined {
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      timeZoneName,
    } as Intl.DateTimeFormatOptions)
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value;
  } catch {
    return undefined;
  }
}

export function timeZoneOption(
  timeZone: string,
  date: Date,
  locale?: string,
): SearchableSelectOption & { keywords?: string } {
  return {
    value: timeZone,
    label: timeZone.replace(/_/g, " "),
    detail: timeZonePart(timeZone, "shortOffset", date, locale),
    keywords: timeZonePart(timeZone, "longGeneric", date, locale),
  };
}

export function timeZoneCity(timeZone: string): string {
  return (timeZone.split("/").pop() ?? timeZone).replace(/_/g, " ");
}

export function TimezoneSelector() {
  const { i18n, t } = useLingui();
  const value = useConfigValue("timezone");
  const setTimezone = useSetSettingValue("timezone");

  const systemTimezone = useMemo(() => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, []);

  const options: SearchableSelectOption[] = useMemo(() => {
    const now = new Date();
    const system = timeZoneOption(systemTimezone, now, i18n.locale);
    return [
      {
        ...system,
        value: SYSTEM_TIMEZONE_VALUE,
        // Fork: the city alone ("System (New York)"), so the trigger is
        // not cut off (redline-oct3 Settings; macOS Date & Time names the
        // closest city).
        label: t`System (${timeZoneCity(systemTimezone)})`,
        // The offset stays in the search keywords; the trigger keeps the
        // same width as the Main language select above it.
        detail: undefined,
        keywords: [system.detail, system.keywords, system.label]
          .filter(Boolean)
          .join(" "),
      },
      ...listTimeZones().map((zone) => timeZoneOption(zone, now, i18n.locale)),
    ];
  }, [i18n.locale, systemTimezone, t]);

  const displayValue =
    !value || value === systemTimezone ? SYSTEM_TIMEZONE_VALUE : value;

  const handleChange = (val: string) => {
    setTimezone(
      val === SYSTEM_TIMEZONE_VALUE || val === systemTimezone ? "" : val,
    );
  };

  return (
    <SettingRow
      icon={Clock}
      title={<Trans>Time zone</Trans>}
      // Fork: says what changes, in plain words (NN/g heuristic #2).
      description={<Trans>Show meeting times in this time zone.</Trans>}
    >
      {(labelProps) => (
        <SearchableSelect
          {...labelProps}
          value={displayValue}
          onChange={handleChange}
          options={options}
          placeholder={t`Select time zone`}
          searchPlaceholder={t`Search time zones…`}
          className="w-full"
          dropdownClassName="w-80"
        />
      )}
    </SettingRow>
  );
}
