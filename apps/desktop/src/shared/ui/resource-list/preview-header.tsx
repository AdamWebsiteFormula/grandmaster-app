import { useLingui } from "@lingui/react/macro";
import type { ReactNode } from "react";

import { Copy } from "@anlg/ui/components/icons";
import { Button, type ButtonProps } from "@anlg/ui/components/ui/button";
import { cn } from "@anlg/utils";

import { STATUS_BADGE_CLASS } from "~/shared/ui/status-badge";
import { getTemplateCreatorLabel } from "~/templates/utils";

export function ResourcePreviewHeader({
  icon,
  title,
  description,
  targets,
  onClone,
  actionLabel,
  actionIcon,
  actionVariant,
  actionClassName,
  actions,
  titleMeta,
  footer,
  children,
}: {
  icon?: ReactNode;
  title: string;
  description?: string | null;
  targets?: string[] | null;
  onClone?: () => void;
  actionLabel?: string;
  actionIcon?: ReactNode;
  actionVariant?: ButtonProps["variant"];
  actionClassName?: string;
  actions?: ReactNode;
  titleMeta?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  const { t } = useLingui();
  const actionButton = onClone ? (
    <Button
      onClick={onClone}
      size="sm"
      variant={actionVariant}
      className={actionClassName}
    >
      {actionIcon === undefined ? (
        <Copy className="mr-2 h-4 w-4" />
      ) : (
        actionIcon
      )}
      {actionLabel ?? t`Clone`}
    </Button>
  ) : null;

  return (
    <div className="flex h-full flex-col">
      {/* Fork: the icon starts on the content's 24 pt edge (picture review,
          Oct 6: 11 pt to the left of it; Apple HIG, Layout). */}
      <div className="flex h-12 items-center justify-between gap-3 pr-4 pl-6">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {icon}
          <h2 className="min-w-0 truncate text-sm font-semibold">
            {title || t`Untitled`}
          </h2>
          {titleMeta}
        </div>
        <div className="flex items-center gap-0">
          {actions}
          {actionButton}
        </div>
      </div>

      <div className="scrollbar-hide scroll-fade-y min-h-0 flex-1 overflow-y-auto px-6 pt-3 pb-6">
        <div className="min-w-0">
          {description && (
            <p className="text-muted-foreground min-h-[24px] text-sm">
              {description}
            </p>
          )}
          {targets && targets.length > 0 && (
            <div className="mt-2 flex min-h-6 flex-wrap items-center gap-1.5">
              {targets.map((target, index) => (
                <span
                  key={index}
                  // Fork: a card chip with a hairline; bg-muted is the panel's
                  // own color in light, so the tag drew no chip (NN/g #4).
                  className={cn([
                    STATUS_BADGE_CLASS,
                    // The shared badge size: 20 pt tall, 6 pt sides (picture
                    // review, Oct 9: 24 pt here).
                    "inline-flex h-5 items-center px-1.5",
                  ])}
                >
                  {target}
                </span>
              ))}
            </div>
          )}
          {footer === undefined ? (
            <p className="text-muted-foreground mt-2 text-xs">
              {getTemplateCreatorLabel({ isUserTemplate: false })}
            </p>
          ) : (
            footer
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
