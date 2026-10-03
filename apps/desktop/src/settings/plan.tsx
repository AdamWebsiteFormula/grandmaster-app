// Fork: Settings › Plan. Granola keeps plans in Settings › Billing: the
// active plan, a usage summary, and a "Compare all plans" table with the
// button in each plan's header, checkout in the browser, and "Manage
// subscription" (docs.granola.ai/help-center/managing-your-account/subscriptions-and-billing;
// granola-compare-oct3 section 8). Upshot has two plans: Free (everything,
// no account) and Pro (pick the chat model). Payments run in the Stripe
// sandbox for the contest.
//
// Price: a big number over a small line (linear.app/pricing,
// raycast.com/pricing), the discount on the Yearly toggle (Raycast), and the
// yearly total in plain words before checkout (FTC "Bringing Dark Patterns
// to Light", Sept 2022). Buttons near the macOS 13 pt default
// (developer.apple.com/design/human-interface-guidelines/typography).
import { Trans, useLingui } from "@lingui/react/macro";
import { useId, useState } from "react";

import { Check } from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";
import { useSquircleRef } from "@anlg/ui/hooks/use-squircle";
import { cn } from "@anlg/utils";

import { useNow, useTimezone, useWeekStartsOn } from "~/calendar/hooks";
import { SettingsPageTitle, SettingsSectionTitle } from "~/settings/page-title";
import { SettingsGroup } from "~/settings/setting-row";
import { summarizeActivity } from "~/settings/stats/activity";
import { useActivity } from "~/settings/stats/queries";
import {
  openManageSubscription,
  openUpgrade,
  type PlanInterval,
  refreshUpshotPlan,
  type UpshotPlanStatus,
  useUpshotPlan,
} from "~/upshot-plan";
import { TestCardNote } from "~/upshot-plan/upgrade-dialog";

const MONTHLY_PRICE = 14;
const YEARLY_PRICE = 132;
// 132 / (14 × 12) = 0.786, so a year saves 21%.
const YEARLY_SAVING = Math.round(
  (1 - YEARLY_PRICE / (MONTHLY_PRICE * 12)) * 100,
);
const YEARLY_PER_MONTH = YEARLY_PRICE / 12;

// Annual is selected first: 88% of Forbes Cloud 100 pricing pages default to
// it (growthunhinged.com/p/how-to-sell-annual-plans), and defaults stick
// (Jachimowicz et al. 2019, default-effect meta-analysis). Checkout sends
// whatever the toggle shows.
export const DEFAULT_BILLING_INTERVAL: PlanInterval = "year";

export function SettingsPlan() {
  const { t } = useLingui();
  const { plan, isLoading, checkoutPending, error } = useUpshotPlan();
  const isPro = plan?.pro ?? false;
  const [interval, setBillingInterval] = useState<PlanInterval>(
    DEFAULT_BILLING_INTERVAL,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-8">
      <SettingsPageTitle
        title={<Trans>Plan</Trans>}
        description={<Trans>Your plan, your usage and what Pro adds.</Trans>}
      />

      <SettingsGroup title={<Trans>Current plan</Trans>}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold">{isPro ? t`Pro` : t`Free`}</p>
            <p className="text-muted-foreground text-sm">
              {isPro ? (
                <ProStatusLine plan={plan} />
              ) : (
                <Trans>Record, transcribe and take AI notes for $0.</Trans>
              )}
            </p>
          </div>
          {isPro || plan?.status ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-sm"
              disabled={busy}
              onClick={() => void run(openManageSubscription)}
            >
              <Trans>Manage subscription</Trans>
            </Button>
          ) : null}
        </div>
      </SettingsGroup>

      <PlanUsage />

      <PlanComparison
        isPro={isPro}
        isLoading={isLoading}
        busy={busy}
        checkoutPending={checkoutPending}
        interval={isPro ? (plan?.interval ?? interval) : interval}
        onIntervalChange={setBillingInterval}
        onUpgrade={() => void run(() => openUpgrade(interval))}
      />

      {!isPro ? (
        <div className="-mt-4 flex flex-col gap-2 px-1">
          {checkoutPending ? (
            <div className="flex items-center justify-between gap-2">
              <p role="status" className="text-muted-foreground text-xs">
                <Trans>
                  Waiting for payment. Pro turns on here once it goes through.
                </Trans>
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-xs"
                onClick={() => void refreshUpshotPlan(true)}
              >
                <Trans>Check again</Trans>
              </Button>
            </div>
          ) : null}
          <TestCardNote />
        </div>
      ) : null}

      {message ? (
        <p role="alert" className="text-destructive text-xs">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// Usage numbers come from the same local activity as Settings › Insights.
function PlanUsage() {
  const { t, i18n } = useLingui();
  const activity = useActivity();
  const now = useNow();
  const timezone = useTimezone();
  const weekStartsOn = useWeekStartsOn();
  const ready = !activity.isLoading && !activity.error;
  const stats = summarizeActivity(
    activity.data ?? [],
    now,
    timezone,
    weekStartsOn,
    "30d",
  );
  const number = new Intl.NumberFormat(i18n.locale, {
    maximumFractionDigits: 1,
  });
  const metrics = [
    { label: t`Meetings, last 30 days`, value: stats.conversations },
    { label: t`Hours, last 30 days`, value: stats.hours },
    { label: t`Meetings in total`, value: stats.totalConversations },
  ];
  // A few minutes of audio is not "0 hours".
  const format = (value: number) =>
    value > 0 && value < 0.05 ? t`<0.1` : number.format(value);

  return (
    <SettingsGroup title={<Trans>Usage</Trans>}>
      {/* Fork: a new user sees "None yet", not a row of zeros (redline-oct3
          Settings; NN/g empty states say what will show up). */}
      {ready && stats.totalConversations === 0 ? (
        <p data-testid="plan-usage" className="text-muted-foreground text-sm">
          <Trans>
            None yet. Your meetings show up here once you record one.
          </Trans>
        </p>
      ) : (
        <dl className="grid grid-cols-3 gap-4" data-testid="plan-usage">
          {metrics.map((metric) => (
            <div key={metric.label} className="flex min-w-0 flex-col gap-1">
              <dt className="text-muted-foreground text-xs">{metric.label}</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {ready ? format(metric.value) : "—"}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </SettingsGroup>
  );
}

type ComparisonRow = {
  label: string;
  note?: string;
  free: boolean;
  pro: boolean;
};

type CellPosition = "top" | "middle" | "bottom";

// Fork: a Free vs Pro table, as Granola's "Compare all plans": plan columns
// with the button in the header, a check for what each includes, and the
// current plan's column tinted (granola-compare-oct3 section 8).
function PlanComparison({
  isPro,
  isLoading,
  busy,
  checkoutPending,
  interval,
  onIntervalChange,
  onUpgrade,
}: {
  isPro: boolean;
  isLoading: boolean;
  busy: boolean;
  checkoutPending: boolean;
  interval: PlanInterval;
  onIntervalChange: (value: PlanInterval) => void;
  onUpgrade: () => void;
}) {
  const { t } = useLingui();
  const titleId = useId();
  const freeCurrent = !isPro && !isLoading;
  const rows: ComparisonRow[] = [
    { label: t`Record and transcribe on your Mac`, free: true, pro: true },
    { label: t`AI notes and chat with Auto`, free: true, pro: true },
    { label: t`Folders, templates and search`, free: true, pro: true },
    {
      label: t`Pick this week's models`,
      note: t`The newest from OpenAI, Anthropic and Google`,
      free: false,
      pro: true,
    },
  ];
  // Fork: the table sits in the same card as the groups above, so the
  // current column steps up one surface (bg-accent on the bg-muted card;
  // design-system "Contrast": raised is lighter). Header cells align to the
  // top so "Free" and "Pro" share one baseline (redline-oct3 Settings).
  const cell = (current: boolean, position: CellPosition) =>
    cn([
      "px-3 py-3 text-center",
      position === "top" ? "align-top" : "align-middle",
      position !== "bottom" && "border-border border-b",
      current && "bg-accent",
      current && position === "top" && "rounded-t-xl",
      current && position === "bottom" && "rounded-b-xl",
    ]);
  const rowHeader = (position: CellPosition) =>
    cn([
      "py-3 pr-3 text-left align-middle font-normal",
      position !== "bottom" && "border-border border-b",
    ]);

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2">
      <div className="px-1">
        <SettingsSectionTitle id={titleId}>
          <Trans>Compare plans</Trans>
        </SettingsSectionTitle>
      </div>
      <div
        data-settings-card
        className="border-border bg-muted min-w-0 rounded-xl border px-4 pt-3 pb-1"
      >
        <table
          data-testid="plan-comparison"
          className="w-full table-fixed border-separate border-spacing-0 text-sm"
        >
          <colgroup>
            <col />
            <col className="w-32" />
            <col className="w-44" />
          </colgroup>
          <thead>
            <tr>
              <th
                scope="col"
                className="border-border border-b py-3 pr-3 text-left align-bottom font-normal"
              >
                <span className="sr-only">
                  <Trans>Feature</Trans>
                </span>
                {isPro ? null : (
                  <IntervalToggle
                    value={interval}
                    onChange={onIntervalChange}
                  />
                )}
              </th>
              <th scope="col" className={cell(freeCurrent, "top")}>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-base font-semibold">{t`Free`}</span>
                  {freeCurrent ? <CurrentPlanChip /> : null}
                </div>
              </th>
              <th scope="col" className={cell(isPro, "top")}>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-base font-semibold">{t`Pro`}</span>
                  {isPro ? (
                    <CurrentPlanChip />
                  ) : (
                    // Fork: disabled while checkout opens; once it is open,
                    // the button says it reopens it rather than starting over
                    // (ux-audit-oct3 D, NN/g #1, #5).
                    <Button
                      variant={checkoutPending ? "outline" : "default"}
                      size="sm"
                      className="h-8 w-full text-sm"
                      disabled={busy || isLoading}
                      onClick={onUpgrade}
                    >
                      {checkoutPending ? (
                        <Trans>Reopen checkout</Trans>
                      ) : (
                        <Trans>Upgrade to Pro</Trans>
                      )}
                    </Button>
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className={rowHeader("middle")}>
                <Trans>Price</Trans>
              </th>
              <td className={cell(freeCurrent, "middle")}>
                <Price amount={t`$0`} line={t`No account needed`} />
              </td>
              <td className={cell(isPro, "middle")}>
                {interval === "year" ? (
                  <Price
                    amount={t`$${YEARLY_PER_MONTH}`}
                    line={t`a month, billed $${YEARLY_PRICE} yearly`}
                    extra={
                      isPro ? undefined : t`or $${MONTHLY_PRICE} billed monthly`
                    }
                  />
                ) : (
                  <Price amount={t`$${MONTHLY_PRICE}`} line={t`a month`} />
                )}
              </td>
            </tr>
            {rows.map((row, index) => {
              const position: CellPosition =
                index === rows.length - 1 ? "bottom" : "middle";
              return (
                <tr key={row.label}>
                  <th scope="row" className={rowHeader(position)}>
                    {row.label}
                    {row.note ? (
                      <span className="text-muted-foreground mt-0.5 block text-xs">
                        {row.note}
                      </span>
                    ) : null}
                  </th>
                  <td className={cell(freeCurrent, position)}>
                    <Included value={row.free} />
                  </td>
                  <td className={cell(isPro, position)}>
                    <Included value={row.pro} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Included({ value }: { value: boolean }) {
  const { t } = useLingui();
  return value ? (
    <span role="img" aria-label={t`Included`} className="inline-flex">
      <Check className="text-foreground size-4" weight="bold" aria-hidden />
    </span>
  ) : (
    <span
      role="img"
      aria-label={t`Not included`}
      className="text-muted-foreground"
    >
      —
    </span>
  );
}

function CurrentPlanChip() {
  return (
    <span className="border-border text-muted-foreground rounded-full border px-2 text-xs leading-5">
      <Trans>Current plan</Trans>
    </span>
  );
}

function Price({
  amount,
  line,
  extra,
}: {
  amount: string;
  line: string;
  extra?: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <p className="text-xl font-semibold tabular-nums">{amount}</p>
      <p className="text-muted-foreground text-xs">{line}</p>
      {extra ? <p className="text-muted-foreground text-xs">{extra}</p> : null}
    </div>
  );
}

function ProStatusLine({ plan }: { plan: UpshotPlanStatus | null }) {
  const { i18n } = useLingui();
  const date = plan?.current_period_end
    ? new Intl.DateTimeFormat(i18n.locale, { dateStyle: "medium" }).format(
        new Date(plan.current_period_end),
      )
    : null;
  if (plan?.status === "trialing") {
    return date ? <Trans>Trial, ends {date}</Trans> : <Trans>Trial</Trans>;
  }
  if (!date) return <Trans>Active</Trans>;
  // Fork: a canceled plan must not read as active (ux-audit-oct3 D, NN/g #1).
  return plan?.cancel_at_period_end ? (
    <Trans>Canceled. Pro stays on until {date}.</Trans>
  ) : (
    <Trans>Active, renews {date}</Trans>
  );
}

function IntervalToggle({
  value,
  onChange,
}: {
  value: PlanInterval;
  onChange: (value: PlanInterval) => void;
}) {
  const { t } = useLingui();
  const ref = useSquircleRef<HTMLDivElement>();
  const options = [
    { id: "month", label: t`Monthly`, note: null },
    { id: "year", label: t`Yearly`, note: t`save ${YEARLY_SAVING}%` },
  ] as const;
  return (
    <div
      ref={ref}
      className="bg-accent flex gap-1 rounded-lg p-1"
      role="group"
      aria-label={t`Billing period`}
    >
      {options.map((option) => (
        <Button
          key={option.id}
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn([
            "flex-1 gap-1.5 px-3 py-1.5 text-sm",
            value === option.id
              ? "bg-foreground text-background hover:bg-foreground hover:text-background"
              : "text-muted-foreground hover:text-foreground",
          ])}
        >
          {option.label}
          {option.note ? (
            <>
              {" "}
              <span
                className={
                  value === option.id
                    ? "text-background/70"
                    : "text-muted-foreground"
                }
              >
                {option.note}
              </span>
            </>
          ) : null}
        </Button>
      ))}
    </div>
  );
}
