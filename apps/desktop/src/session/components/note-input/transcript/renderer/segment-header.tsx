import { Check } from "@anlg/ui/components/icons";
import { cn } from "@anlg/utils";

import { useTranscriptSelectionState } from "./selection-context";
import { SpeakerAssignPopover } from "./speaker-assign";
import { useSegmentColorVars } from "./utils";

import type { Segment } from "~/stt/live-segment";

export function SegmentHeader({
  segment,
  transcriptId,
  sessionId,
  label,
  timeLabel = null,
  selected = false,
}: {
  segment: Segment;
  transcriptId: string;
  sessionId?: string;
  label: string;
  /** Bubble start time, shown muted after the name: "Ada · 00:14". */
  timeLabel?: string | null;
  selected?: boolean;
}) {
  const { selectMode } = useTranscriptSelectionState();
  const colorVars = useSegmentColorVars(segment.key);
  const headerClassName = cn([
    "relative py-1",
    // Fork: small, colored, medium weight (granola-compare-oct3 §2).
    "text-xs font-medium",
    "flex items-center gap-2 px-1",
    "[--segment-color:var(--segment-color-light)]",
    "dark:[--segment-color:var(--segment-color-dark)]",
  ]);

  return (
    <div className={headerClassName} style={colorVars}>
      {selectMode ? (
        <span
          aria-hidden="true"
          className={cn([
            "flex size-4 shrink-0 items-center justify-center rounded-full border",
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground",
          ])}
        >
          {selected ? <Check className="size-2.5" weight="bold" /> : null}
        </span>
      ) : null}
      <span className="inline-flex min-w-0 items-center gap-1">
        <SpeakerAssignPopover
          segment={segment}
          transcriptId={transcriptId}
          sessionId={sessionId}
          color="var(--segment-color)"
          label={label}
          className="pr-0"
        />
        {timeLabel ? (
          <span
            data-transcript-time
            className="text-muted-foreground font-normal tabular-nums"
          >
            <span aria-hidden>· </span>
            {timeLabel}
          </span>
        ) : null}
      </span>
    </div>
  );
}
