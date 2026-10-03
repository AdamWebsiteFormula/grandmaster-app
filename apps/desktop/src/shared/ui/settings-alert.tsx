import type { MouseEvent } from "react";

import { toast, TOAST_DURATIONS } from "@anlg/ui/components/ui/toast";
import { useMountEffect } from "@anlg/ui/hooks/use-mount-effect";

export function SettingsAlertToast({
  id,
  description,
  variant = "default",
  lifecycle,
  action,
}: {
  id: string;
  description?: string;
  variant?: "default" | "error" | "warning";
  lifecycle: "condition-bound" | "persistent";
  action?: {
    label: string;
    onClick: () => void | Promise<void>;
  };
}) {
  if (!description) {
    return null;
  }

  return (
    <SettingsAlertToastLifecycle
      key={`${id}:${description}:${lifecycle}:${action?.label ?? ""}`}
      id={id}
      description={description}
      variant={variant}
      lifecycle={lifecycle}
      action={action}
    />
  );
}

function SettingsAlertToastLifecycle({
  id,
  description,
  variant,
  lifecycle,
  action,
}: {
  id: string;
  description: string;
  variant: "default" | "error" | "warning";
  lifecycle: "condition-bound" | "persistent";
  action?: {
    label: string;
    onClick: () => void | Promise<void>;
  };
}) {
  useMountEffect(() => {
    const dismissible = lifecycle === "persistent";
    const options = {
      id,
      // Fork: an error that offers an action stays until the user acts
      // (it used to close after a few seconds, before the user could click).
      duration:
        variant === "error" && !action ? TOAST_DURATIONS.error : Infinity,
      dismissible,
      closeButton: dismissible,
      ...(action
        ? {
            action: {
              label: action.label,
              onClick: (event: MouseEvent<HTMLButtonElement>) => {
                event.preventDefault();
                void action.onClick();
              },
            },
          }
        : {}),
    };

    if (variant === "error") {
      toast.error(description, options);
    } else if (variant === "warning") {
      toast.warning(description, options);
    } else {
      toast.message(description, options);
    }

    return () => {
      toast.dismiss(id);
    };
  });

  return null;
}
