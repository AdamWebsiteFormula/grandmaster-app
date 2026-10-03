import { Trans, useLingui } from "@lingui/react/macro";
import { useState } from "react";

import { cn } from "@anlg/utils";

import { summarizeActivity } from "./activity";
import { BadgeCollection } from "./badge-collection";
import { DateRangeFilter } from "./date-range";
import { ConversationPatterns } from "./insights";
import { useActivity } from "./queries";
import { Tracker } from "./tremor/tracker";

import { useNow, useTimezone, useWeekStartsOn } from "~/calendar/hooks";
import { SettingsPageTitle } from "~/settings/page-title";
import { SettingsGroup } from "~/settings/setting-row";

// Any activity (level 1+) meets 3:1 against the panel (WCAG 2.2 SC 1.4.11);
// level 0 is the empty cell.
const ACTIVITY_COLORS = [
  "bg-foreground/10",
  "bg-foreground/50",
  "bg-foreground/65",
  "bg-foreground/80",
  "bg-foreground",
];

export function SettingsInsights() {
  const { t, i18n } = useLingui();
  const activity = useActivity();
  const now = useNow();
  const timezone = useTimezone();
  const weekStartsOn = useWeekStartsOn();
  const [range, setRange] = useState<"all" | "30d" | "7d">("all");
  const stats = summarizeActivity(
    activity.data ?? [],
    now,
    timezone,
    weekStartsOn,
    range,
  );
  const number = new Intl.NumberFormat(i18n.locale);
  const dateFormat = new Intl.DateTimeFormat(i18n.locale, {
    dateStyle: "long",
    timeZone: timezone,
  });
  const monthFormat = new Intl.DateTimeFormat(i18n.locale, {
    month: "short",
    timeZone: timezone,
  });
  const weekdayFormat = new Intl.DateTimeFormat(i18n.locale, {
    weekday: "short",
    timeZone: timezone,
  });
  const columns = stats.days.filter((_, index) => index % 7 === 0);
  // Fork: the same words as Settings › Plan (journey-account-settings P2;
  // NN/g #4 consistency).
  const metrics = [
    { label: t`Meetings`, value: number.format(stats.conversations) },
    {
      label: t`Hours recorded`,
      value: number.format(Math.round(stats.hours * 10) / 10),
    },
    { label: t`Active days`, value: number.format(stats.activeDays) },
  ];

  return (
    <div className="flex w-full min-w-0 flex-col gap-8">
      {/* Fork: the title matches the nav item; weekday labels use the type
          scale (ux-audit-oct3 E, HIG typography). */}
      <SettingsPageTitle
        title={<Trans>Insights</Trans>}
        description={<Trans>Your meetings and hours over time.</Trans>}
      />
      {activity.error ? (
        <p role="alert" className="text-muted-foreground text-sm">
          <Trans>
            Couldn’t load your insights. Reopen this page to try again.
          </Trans>
        </p>
      ) : activity.isLoading ? (
        <p role="status" className="text-muted-foreground text-sm">
          <Trans>Loading your insights…</Trans>
        </p>
      ) : stats.totalConversations === 0 ? (
        // Fork: a new user gets one empty-state card, the same words as
        // Settings › Plan, not zeros and an empty heatmap
        // (journey-account-settings P2; NN/g "Designing empty states").
        <SettingsGroup title={<Trans>Overview</Trans>}>
          <p
            data-testid="insights-empty"
            className="text-muted-foreground text-sm"
          >
            <Trans>
              None yet. Your meetings show up here once you record one.
            </Trans>
          </p>
        </SettingsGroup>
      ) : (
        <>
          {/* Fork: Overview in a SettingsGroup card, as every other page
              (journey-account-settings P2; NN/g #4). */}
          <SettingsGroup
            title={<Trans>Overview</Trans>}
            action={<DateRangeFilter value={range} onChange={setRange} />}
          >
            <dl className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-3">
              {metrics.map((metric) => (
                <StatCard
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                />
              ))}
            </dl>
          </SettingsGroup>

          <ConversationPatterns stats={stats} />

          <section
            className="flex flex-col gap-4"
            aria-label={t`Activity over the past year`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-medium">
                <Trans>Activity over the past year</Trans>
              </h3>
              <span className="text-muted-foreground text-xs">
                <Trans>Weekly streak: {stats.streak}</Trans>
              </span>
            </div>
            <div
              className="overflow-x-auto pb-1"
              tabIndex={0}
              role="region"
              aria-label={t`Daily conversations`}
            >
              <div className="min-w-[620px]">
                <div
                  className="text-muted-foreground mb-2 ml-12 grid auto-cols-fr grid-flow-col gap-[3px] text-xs"
                  aria-hidden="true"
                >
                  {columns.map((day, index) => (
                    <span
                      key={day.key}
                      className="overflow-visible whitespace-nowrap"
                    >
                      {/* Fork: skip a first partial month so its label can't collide with the next. */}
                      {(index === 0 &&
                        columns
                          .slice(1, 3)
                          .every(
                            (next) =>
                              next.date.getMonth() === day.date.getMonth(),
                          )) ||
                      (index > 0 &&
                        day.date.getMonth() !==
                          columns[index - 1].date.getMonth())
                        ? monthFormat.format(day.date)
                        : ""}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <div
                    className="text-muted-foreground grid w-10 shrink-0 grid-rows-7 gap-[3px] text-xs"
                    aria-hidden="true"
                  >
                    {stats.days.slice(0, 7).map((day, index) => (
                      <span key={day.key} className="flex items-center">
                        {index % 2 === 1 ? weekdayFormat.format(day.date) : ""}
                      </span>
                    ))}
                  </div>
                  <Tracker
                    className="flex-1"
                    aria-label={t`Daily conversations`}
                    data={stats.days.map((day) => {
                      const date = dateFormat.format(day.date);
                      const count = day.count;
                      return {
                        key: day.key,
                        color: ACTIVITY_COLORS[Math.min(count, 4)],
                        tooltip: t`${date}. Conversations: ${count}`,
                      };
                    })}
                  />
                </div>
              </div>
            </div>
            <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 text-xs">
              <span>
                <Trans>Every conversation adds to your story.</Trans>
              </span>
              <div className="flex items-center gap-1.5" aria-hidden="true">
                <span>
                  <Trans>Less</Trans>
                </span>
                {ACTIVITY_COLORS.map((color) => (
                  <span
                    key={color}
                    className={cn(["size-2.5 rounded-xs", color])}
                  />
                ))}
                <span>
                  <Trans>More</Trans>
                </span>
              </div>
            </div>
          </section>

          <BadgeCollection
            records={activity.data ?? []}
            now={now}
            timezone={timezone}
            weekStartsOn={weekStartsOn}
          />
          <p className="text-muted-foreground text-xs">
            <Trans>
              Includes imported transcripts. Deleted conversations are excluded.
            </Trans>
          </p>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
