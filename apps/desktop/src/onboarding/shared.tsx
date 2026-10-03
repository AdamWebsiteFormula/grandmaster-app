import { Trans, useLingui } from "@lingui/react/macro";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useEffect, useRef } from "react";

import {
  CaretLeft,
  CaretRight,
  Check,
  CheckCircle,
  CircleNotch,
  XCircle,
} from "@anlg/ui/components/icons";
import { cn } from "@anlg/utils";

const SCROLL_DELAY_MS = 350;

export type SectionStatus = "completed" | "active" | "upcoming";

export function OnboardingSection({
  title,
  completedTitle,
  description,
  status,
  onBack,
  onNext,
  onSkip,
  skippable = true,
  progress,
  children,
}: {
  title: ReactNode;
  completedTitle?: ReactNode;
  description?: ReactNode;
  status: SectionStatus | null;
  onBack?: () => void;
  onNext?: () => void;
  onSkip?: () => void;
  skippable?: boolean;
  progress?: { current: number; total: number };
  children: ReactNode;
}) {
  const { t } = useLingui();
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const isActive = status === "active";
  const isCompleted = status === "completed";

  useEffect(() => {
    if (!isActive) return;
    const timeout = setTimeout(() => {
      // Fork: move focus to the new step's heading so keyboard and
      // VoiceOver users aren't left on a control that went away
      // (WCAG 2.2 SC 2.4.3 Focus Order). The scroll below handles position.
      headingRef.current?.focus({ preventScroll: true });
      sectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, SCROLL_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [isActive]);

  if (!status || status === "upcoming") return null;

  return (
    <section ref={sectionRef}>
      <div
        className={cn([
          "flex items-center gap-2 transition-all duration-300",
          isActive && "mb-3 pt-4",
        ])}
      >
        {isCompleted && (
          <Check className="text-primary size-4 shrink-0" weight="bold" />
        )}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2
              ref={headingRef}
              tabIndex={isActive ? -1 : undefined}
              className={cn([
                "transition-all duration-300 outline-none",
                isCompleted
                  ? "text-muted-foreground text-xs font-normal"
                  : "text-foreground font-sans text-xl font-semibold",
              ])}
            >
              {isCompleted ? (completedTitle ?? title) : title}
            </h2>
            {/* Fork: a step count and an always-visible Back (UX audit Oct 3,
                A: NN/g #1, #3). */}
            {isActive && progress && (
              <span className="text-muted-foreground text-xs">
                <Trans>
                  Step {progress.current} of {progress.total}
                </Trans>
              </span>
            )}
            {isActive && (
              <div className="flex items-center gap-2">
                {onBack && (
                  <button
                    onClick={onBack}
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
                  >
                    <CaretLeft className="size-3" />
                    <Trans>Back</Trans>
                  </button>
                )}
                {onNext &&
                  (skippable ? (
                    <button
                      onClick={() => {
                        if (onSkip) {
                          onSkip();
                        } else {
                          onNext?.();
                        }
                      }}
                      className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
                    >
                      <Trans>Skip</Trans>
                      <CaretRight className="size-3" />
                    </button>
                  ) : import.meta.env.DEV ? (
                    <button
                      onClick={onNext}
                      aria-label={t`Go to next section`}
                      className="text-muted-foreground hover:text-foreground rounded p-0.5 transition-colors"
                    >
                      <CaretRight className="size-3" />
                    </button>
                  ) : null)}
              </div>
            )}
          </div>
          {isActive && description && (
            <div className="text-muted-foreground text-sm">{description}</div>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isActive && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="-mx-5 -mb-5 overflow-hidden px-5 pt-3 pb-5"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function OnboardingButton({
  variant = "primary",
  className,
  ...props
}: {
  variant?: "primary" | "secondary" | "ghost";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn([
        "w-fit rounded-full px-6 py-2.5 text-sm font-medium transition-all duration-200",
        variant === "primary" &&
          "border-primary bg-primary text-primary-foreground border-2 hover:brightness-90",
        variant === "secondary" &&
          "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground border disabled:opacity-50",
        variant === "ghost" && "text-muted-foreground hover:text-foreground",
        className,
      ])}
    />
  );
}

export function StepRow({
  status,
  label,
}: {
  status: "done" | "active" | "failed";
  label: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {status === "done" && <CheckCircle className="text-primary size-4" />}
      {status === "active" && (
        <CircleNotch className="text-muted-foreground size-4 animate-spin" />
      )}
      {status === "failed" && <XCircle className="text-destructive size-4" />}
      <span
        className={
          status === "failed" ? "text-destructive" : "text-muted-foreground"
        }
      >
        {label}
      </span>
    </div>
  );
}
