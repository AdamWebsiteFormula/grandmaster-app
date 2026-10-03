// Fork: Settings › Plan. Granola keeps plans in Settings › Billing: a card
// per plan with Upgrade, checkout in the browser, and "Manage subscription"
// (docs.granola.ai/help-center/managing-your-account/subscriptions-and-billing).
// Upshot has two plans: Free (everything, no account) and Pro (pick the
// chat model). Payments run in the Stripe sandbox for the contest.
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
      className="border-border flex min-w-0 flex-col gap-4 rounded-[20px] border p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-muted-foreground text-sm">{price}</p>
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
    <PlanCard title={t`Free`} price={t`$0, no account`} current={current}>
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
  const [interval, setBillingInterval] = useState<PlanInterval>("month");
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
        shownInterval === "year"
          ? t`$${YEARLY_PRICE} a year (save ${YEARLY_SAVING}%)`
          : t`$${MONTHLY_PRICE} a month`
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
            className="h-8 w-full text-xs"
            disabled={busy}
            onClick={() => void run(openManageSubscription)}
          >
            <Trans>Manage subscription</Trans>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <IntervalToggle value={interval} onChange={setBillingInterval} />
          <Button
            className="h-8 w-full text-xs"
            disabled={busy || isLoading}
            onClick={() => void run(() => openUpgrade(interval))}
          >
            <Trans>Upgrade to Pro</Trans>
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
              size="sm"
              className="text-xs"
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
  return plan?.cancel_at_period_end ? (
    <Trans>Active, ends {date}</Trans>
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
    { id: "month", label: t`Monthly` },
    { id: "year", label: t`Yearly` },
  ] as const;
  return (
    <div
      ref={ref}
      className="bg-muted flex gap-1 rounded-lg p-1"
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
            "flex-1 px-3 py-1.5 text-xs",
            value === option.id
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          ])}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
