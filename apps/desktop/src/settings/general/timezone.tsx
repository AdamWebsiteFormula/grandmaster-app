import { Trans, useLingui } from "@lingui/react/macro";
import { useMemo } from "react";

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
        label: t`System (${system.label})`,
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
      title={<Trans>Time zone</Trans>}
      description={
        <Trans>Show the timeline in your preferred time zone.</Trans>
      }
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
