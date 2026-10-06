import { useLingui } from "@lingui/react/macro";

import { Button } from "@anlg/ui/components/ui/button";
import { useSquircleRef } from "@anlg/ui/hooks/use-squircle";
import { cn } from "@anlg/utils";

import {
  SEGMENT_BASE_CLASS,
  SEGMENT_IDLE_CLASS,
  SEGMENT_SELECTED_CLASS,
  SEGMENT_TRACK_CLASS,
} from "~/settings/setting-row";

export function DateRangeFilter({
  value,
  onChange,
}: {
  value: "all" | "30d" | "7d";
  onChange: (value: "all" | "30d" | "7d") => void;
}) {
  const { t } = useLingui();
  const ref = useSquircleRef<HTMLDivElement>();
  const ranges = [
    { id: "all", label: t`All time` },
    { id: "30d", label: t`30 days` },
    { id: "7d", label: t`7 days` },
  ] as const;

  return (
    <div
      ref={ref}
      className={SEGMENT_TRACK_CLASS}
      role="group"
      aria-label={t`Date range`}
    >
      {ranges.map((option) => (
        <Button
          key={option.id}
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn([
            "h-7 px-3 py-0 text-xs",
            SEGMENT_BASE_CLASS,
            value === option.id ? SEGMENT_SELECTED_CLASS : SEGMENT_IDLE_CLASS,
          ])}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
