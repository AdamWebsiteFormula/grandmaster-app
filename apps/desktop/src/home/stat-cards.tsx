// Fork (F5): home stat cards. Three glanceable numbers computed on this Mac,
// plus one quiet AI-cost line. Empty states are calls to action, never zeros.
import { useLingui } from "@lingui/react/macro";
import type { ReactNode } from "react";

import { cn } from "@anlg/utils";

import { useHomeStats } from "./queries";
import {
  estimateCostUsd,
  formatMinutes,
  formatUsd,
  minutesSaved,
  priceFor,
  talkShare,
  timeSavedTier,
  TYPING_WPM,
  wrapUpStreak,
} from "./stats";

import { useConfigValues } from "~/shared/config";

// granola.ai/pricing, checked Oct 2, 2026: Business is $14 per user per month.
const GRANOLA_BUSINESS = "Granola Business $14/mo";

export function HomeStatCards() {
  const { t } = useLingui();
  const stats = useHomeStats();
  const { current_llm_provider, current_llm_model } = useConfigValues([
    "current_llm_provider",
    "current_llm_model",
  ] as const);

  if (stats.isLoading) return null;

  const words = Number(stats.notes?.total_words ?? 0);
  const minutes = minutesSaved(words);
  const share = talkShare(stats.talk);
  const streak = wrapUpStreak(stats.meetings, new Date());

  const timeSavedLine = {
    coffee: t`That's a coffee break`,
    lunch: t`That's a lunch break`,
    workday: t`That's a workday`,
    week: t`That's a full week`,
  }[timeSavedTier(minutes)];

  const price = priceFor(
    current_llm_provider as string | undefined,
    current_llm_model as string | undefined,
  );
  const cost =
    price?.kind === "api"
      ? formatUsd(
          estimateCostUsd(
            {
              generations: Number(stats.notes?.month_generations ?? 0),
              input_chars: Number(stats.notes?.month_input_chars ?? 0),
              output_words: Number(stats.notes?.month_output_words ?? 0),
            },
            price,
          ),
        )
      : null;
  const costLine = !price
    ? null
    : price.kind === "local"
      ? t`AI cost this month $0, it runs on this Mac`
      : price.kind === "subscription"
        ? t`AI cost this month ≈ $0 extra, it uses your plan`
        : t`AI cost this month ≈ ${cost}`;

  return (
    <section
      aria-label={t`Your stats`}
      className="flex w-full max-w-2xl flex-col items-center gap-4 px-8"
    >
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title={t`Time saved`}
          value={minutes > 0 ? formatMinutes(minutes) : null}
          line={
            minutes > 0
              ? timeSavedLine
              : t`Enhance a meeting to start saving time`
          }
          hint={t`Words in your AI notes, at ${TYPING_WPM} words a minute of typing`}
        />
        <StatCard
          title={t`Talk share`}
          value={share ? `${share.percent}%` : null}
          line={
            share
              ? share.wpm
                ? t`You did ${share.percent}% of the talking this week, at ${share.wpm} words a minute`
                : t`You did ${share.percent}% of the talking this week`
              : t`Record a meeting to see how much you talk`
          }
          hint={t`Your mic against everyone else, last 7 days`}
        />
        <StatCard
          title={t`Wrap-up streak`}
          value={
            streak.days > 0
              ? streak.days === 1
                ? t`1 day`
                : t`${streak.days} days`
              : null
          }
          line={
            streak.days === 0
              ? t`Wrap up today's meeting to start a streak`
              : streak.todayPending
                ? t`Wrap up today's meeting to keep it going`
                : streak.days === 1
                  ? t`Every meeting wrapped up, 1 workday running`
                  : t`Every meeting wrapped up, ${streak.days} workdays running`
          }
          hint={t`Workdays where every meeting got an enhanced note. Weekends and days without meetings never break it.`}
        />
      </div>
      {costLine && (
        <p className="text-muted-foreground text-xs">
          {costLine} · {GRANOLA_BUSINESS}
        </p>
      )}
    </section>
  );
}

function StatCard({
  title,
  value,
  line,
  hint,
}: {
  title: string;
  value: string | null;
  line: ReactNode;
  hint: string;
}) {
  return (
    <div
      title={hint}
      className={cn([
        "bg-muted/60 flex min-h-32 flex-col gap-1.5 rounded-xl p-5 text-left",
      ])}
    >
      {/* Fork: empty cards lead with the title, so no small label sits over a big sentence. */}
      <p
        className={cn([
          value
            ? "text-muted-foreground text-sm"
            : "text-foreground text-lg font-medium",
        ])}
      >
        {title}
      </p>
      {value ? (
        <>
          <p className="text-foreground font-mono text-xl font-medium tabular-nums">
            {value}
          </p>
          <p className="text-muted-foreground text-sm">{line}</p>
        </>
      ) : (
        <p className="text-muted-foreground text-sm text-balance">{line}</p>
      )}
    </div>
  );
}
