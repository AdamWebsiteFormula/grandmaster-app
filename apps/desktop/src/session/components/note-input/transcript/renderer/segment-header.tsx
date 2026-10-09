import { t } from "@lingui/core/macro";

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
        // Fork: a checkbox a keyboard can reach: Space or Return selects
        // the line (Shift+Space selects a range, as Shift-click does), the
        // up and down arrows move between lines. Selecting lines was
        // mouse-only (task test, Oct 9; WCAG 2.2 SC 2.1.1; Apple HIG,
        // Keyboards; macOS list selection).
        <span
          role="checkbox"
          tabIndex={0}
          aria-checked={selected}
          aria-label={t`Select line from ${label}`}
          data-transcript-line-checkbox
          onKeyDown={(event) => {
            if (event.key === " " || event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.dispatchEvent(
                new MouseEvent("click", {
                  bubbles: true,
                  cancelable: true,
                  shiftKey: event.shiftKey,
                }),
              );
              return;
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              const boxes = Array.from(
                document.querySelectorAll<HTMLElement>(
                  "[data-transcript-line-checkbox]",
                ),
              );
              const index = boxes.indexOf(event.currentTarget);
              const next =
                boxes[event.key === "ArrowDown" ? index + 1 : index - 1];
              if (next) {
                event.preventDefault();
                next.focus();
              }
            }
          }}
          className={cn([
            "flex size-4 shrink-0 items-center justify-center rounded-full border",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
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
