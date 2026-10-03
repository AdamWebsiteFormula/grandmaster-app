// Fork: Settings › Plan. Granola keeps plans in Settings › Billing: a card
// per plan with Upgrade, checkout in the browser, and "Manage subscription"
// (docs.granola.ai/help-center/managing-your-account/subscriptions-and-billing).
// Upshot has two plans: Free (everything, no account) and Pro (pick the
// chat model). Payments run in the Stripe sandbox for the contest.
//
// Price: a big number over a small line (linear.app/pricing,
// raycast.com/pricing), the discount on the Yearly toggle (Raycast), and the
// yearly total in plain words before checkout (FTC "Bringing Dark Patterns
// to Light", Sept 2022). Buttons h-9 with text-sm, near the macOS 13 pt
// default (developer.apple.com/design/human-interface-guidelines/typography).
import { Trans, useLingui } from "@lingui/react/macro";
import { type ReactNode, useState } from "react";

import { Button } from "@anlg/ui/components/ui/button";
import { useSquircleRef } from "@anlg/ui/hooks/use-squircle";
import { cn } from "@anlg/utils";

import { SettingsPageTitle } from "~/settings/page-title";
import {
  openManageSubscription,
  openUpgrade,
  openUpshotSignIn,
  type PlanInterval,
  refreshUpshotPlan,
  signOutUpshot,
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
  const { plan, email, isSignedIn, isLoading, checkoutPending, error } =
    useUpshotPlan();
  const isPro = plan?.pro ?? false;

  return (
    <div className="flex w-full min-w-0 flex-col gap-8">
      <SettingsPageTitle title={<Trans>Plan</Trans>} />
      <AccountLine email={email} isSignedIn={isSignedIn} />
      <div className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2">
        <FreeCard current={!isPro && !isLoading} />
        <ProCard
          plan={plan}
          isPro={isPro}
          isLoading={isLoading}
          checkoutPending={checkoutPending}
        />
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function AccountLine({
  email,
  isSignedIn,
}: {
  email: string | null;
  isSignedIn: boolean;
}) {
  const { t } = useLingui();
  if (!isSignedIn) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          <Trans>You're on Free. No account needed.</Trans>
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => openUpshotSignIn()}
        >
          <Trans>Sign in</Trans>
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-muted-foreground min-w-0 truncate text-sm">
        {t`Signed in as ${email}`}
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="text-xs"
        onClick={() => void signOutUpshot()}
      >
        <Trans>Sign out</Trans>
      </Button>
    </div>
  );
}

function PlanCard({
  title,
  price,
  current,
  children,
}: {
  title: ReactNode;
  price: ReactNode;
  current: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={typeof title === "string" ? title : undefined}
      className="border-border bg-muted flex min-w-0 flex-col gap-4 rounded-[20px] border p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold">{title}</h3>
          {price}
        </div>
        {current ? (
          <span className="border-border text-muted-foreground rounded-full border px-2 text-xs leading-5">
            <Trans>Current plan</Trans>
          </span>
        ) : null}
      </div>
      {children}
    </section>
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
    <div className="flex flex-col">
      <p className="text-xl font-semibold tabular-nums">{amount}</p>
      <p className="text-muted-foreground text-sm">{line}</p>
      {extra ? <p className="text-muted-foreground text-xs">{extra}</p> : null}
    </div>
  );
}

function Features({ items }: { items: string[] }) {
  return (
    <ul className="text-muted-foreground flex flex-col gap-1.5 text-sm">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function FreeCard({ current }: { current: boolean }) {
  const { t } = useLingui();
  return (
    <PlanCard
      title={t`Free`}
      price={<Price amount={t`$0`} line={t`No account needed`} />}
      current={current}
    >
      <Features
        items={[
          t`Record and transcribe on your Mac`,
          t`AI notes and chat with Auto`,
          t`Folders, templates and search`,
        ]}
      />
    </PlanCard>
  );
}

function ProCard({
  plan,
  isPro,
  isLoading,
  checkoutPending,
}: {
  plan: UpshotPlanStatus | null;
  isPro: boolean;
  isLoading: boolean;
  checkoutPending: boolean;
}) {
  const { t } = useLingui();
  const [interval, setBillingInterval] = useState<PlanInterval>(
    DEFAULT_BILLING_INTERVAL,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const shownInterval = isPro ? (plan?.interval ?? interval) : interval;

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
    <PlanCard
      title={t`Pro`}
      price={
        shownInterval === "year" ? (
          <Price
            amount={t`$${YEARLY_PER_MONTH}`}
            line={t`a month, billed $${YEARLY_PRICE} yearly`}
            extra={isPro ? undefined : t`or $${MONTHLY_PRICE} billed monthly`}
          />
        ) : (
          <Price amount={t`$${MONTHLY_PRICE}`} line={t`a month`} />
        )
      }
      current={isPro}
    >
      <Features
        items={[
          t`Everything in Free`,
          t`Pick the chat model: the newest from OpenAI, Anthropic and Google`,
        ]}
      />
      {isPro ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            <ProStatusLine plan={plan} />
          </p>
          <Button
            variant="outline"
            className="h-9 w-full text-sm"
            disabled={busy}
            onClick={() => void run(openManageSubscription)}
          >
            <Trans>Manage subscription</Trans>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <IntervalToggle value={interval} onChange={setBillingInterval} />
          {/* Fork: disabled while checkout opens; once it is open, the button
              says it reopens it rather than starting over (ux-audit-oct3 D,
              NN/g #1, #5). */}
          <Button
            variant={checkoutPending ? "outline" : "default"}
            className="h-9 w-full text-sm"
            disabled={busy || isLoading}
            onClick={() => void run(() => openUpgrade(interval))}
          >
            {checkoutPending ? (
              <Trans>Reopen checkout</Trans>
            ) : (
              <Trans>Upgrade to Pro</Trans>
            )}
          </Button>
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
          {plan?.status ? (
            <Button
              variant="ghost"
              className="h-9 text-sm"
              disabled={busy}
              onClick={() => void run(openManageSubscription)}
            >
              <Trans>Manage subscription</Trans>
            </Button>
          ) : null}
          <TestCardNote />
        </div>
      )}
      {message ? (
        <p role="alert" className="text-destructive text-xs">
          {message}
        </p>
      ) : null}
    </PlanCard>
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
