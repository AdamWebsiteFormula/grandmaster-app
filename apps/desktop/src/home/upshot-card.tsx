// Fork: "The upshot", the top card on Home: the lead point and the next
// steps of the latest AI summary, read from the note already on disk (no new
// AI call, no network). Owner approved Oct 3.
// Sources:
// - Microsoft Teams Premium "Intelligent recap" (Microsoft Support, "Recap
//   in Microsoft Teams") leads with AI notes and follow-up tasks, marks them
//   as AI-generated, and links each item back to its source.
// - Microsoft HAX guidelines G1 and G11: make clear what the AI did and why;
//   Apple HIG, Generative AI: identify AI-generated content.
// - Granola's Home has no digest, so this is Upshot's own moment.
// - Hidden until a note has a summary, and never for locked notes: NN/g
//   empty states, no clutter (nngroup.com/articles/empty-state-interface-design).
import { Trans, useLingui } from "@lingui/react/macro";
import { useCallback, useMemo } from "react";

import { Sparkle } from "@anlg/ui/components/icons";
import { cn, format } from "@anlg/utils";

import { useUpshot } from "./home-data";

import { useTabs } from "~/store/zustand/tabs";

export type Upshot = { lead: string; nextSteps: string[] };

/** Up to this many next steps show on the card. */
export const UPSHOT_MAX_STEPS = 3;

const HEADING = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/;
const BULLET = /^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/;
const NEXT_STEPS = /^(next steps|action items)$/i;

// Plain text from one markdown line: no task boxes, emphasis, code ticks,
// links or escapes.
function plainText(value: string): string {
  return value
    .replace(/^\[[ xX]\]\s+/, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|~~)(.+?)\1/g, "$2")
    .replace(/(^|[^\w*])[*_](\S(?:.*?\S)?)[*_](?=[^\w*]|$)/g, "$1$2")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\\([\\`*_{}[\]()#+\-.!~|>])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The card's content from a summary in markdown (or plain text): the first
 * bullet of the first section that is not "Next steps" as the lead, and the
 * top-level bullets of the "Next steps" (or "Action items") section.
 */
export function parseUpshot(markdownOrText: string): Upshot {
  type Section = { heading: string; bullets: string[]; lines: string[] };
  const sections: Section[] = [{ heading: "", bullets: [], lines: [] }];

  for (const line of (markdownOrText ?? "").split(/\r?\n/)) {
    const heading = line.match(HEADING);
    if (heading) {
      sections.push({
        heading: plainText(heading[1]).replace(/:$/, ""),
        bullets: [],
        lines: [],
      });
      continue;
    }
    const section = sections[sections.length - 1];
    const bullet = line.match(BULLET);
    if (bullet) {
      if (bullet[1].length === 0) {
        const text = plainText(bullet[2]);
        if (text) section.bullets.push(text);
      }
      continue;
    }
    const text = plainText(line);
    if (text) section.lines.push(text);
  }

  const isNextSteps = (section: Section) => NEXT_STEPS.test(section.heading);
  const body = sections.filter(
    (section) =>
      !isNextSteps(section) &&
      (section.bullets.length > 0 || section.lines.length > 0),
  );
  const first = body[0];
  return {
    lead: first?.bullets[0] ?? first?.lines[0] ?? "",
    nextSteps: sections.find(isNextSteps)?.bullets ?? [],
  };
}

const ROW_CLASS =
  "hover:bg-accent focus-visible:ring-ring w-full cursor-pointer rounded-lg px-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none";

export function UpshotCard() {
  const { t } = useLingui();
  const { sources } = useUpshot();
  // The newest summary that yields a lead or a next step.
  const upshot = useMemo(() => {
    for (const source of sources) {
      const parsed = parseUpshot(source.markdown);
      if (parsed.lead || parsed.nextSteps.length > 0) {
        return { ...source, ...parsed };
      }
    }
    return null;
  }, [sources]);
  const openCurrent = useTabs((state) => state.openCurrent);
  const open = useCallback(() => {
    if (upshot) openCurrent({ type: "sessions", id: upshot.sessionId });
  }, [openCurrent, upshot]);

  if (!upshot) return null;

  const title = upshot.title || t`Untitled note`;
  const day = relativeDay(upshot.timeMs, t`Today`, t`Yesterday`);
  const steps = upshot.nextSteps.slice(0, UPSHOT_MAX_STEPS);

  return (
    <section
      aria-labelledby="home-upshot"
      className="bg-card dark:bg-muted border-border flex flex-col rounded-xl border px-2 pt-2.5 pb-2"
    >
      <div className="flex items-center justify-between gap-4 px-2 pb-1">
        <h2
          id="home-upshot"
          className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-sm font-medium"
        >
          <Sparkle className="size-3.5" aria-hidden="true" />
          <Trans>The upshot</Trans>
        </h2>
        <button
          type="button"
          onClick={open}
          title={title}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex min-w-0 cursor-pointer items-center rounded text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <span className="min-w-0 truncate">
            <Trans>From {title}</Trans>
          </span>
          <span className="shrink-0 tabular-nums">
            {" · "}
            {day}
          </span>
        </button>
      </div>
      {upshot.lead ? (
        <button
          type="button"
          onClick={open}
          className={cn([ROW_CLASS, "py-1"])}
        >
          <p className="font-display text-foreground line-clamp-2 text-lg font-semibold tracking-[-0.01em]">
            {upshot.lead}
          </p>
        </button>
      ) : null}
      {steps.length > 0 ? (
        <>
          <p className="text-muted-foreground px-2 pt-2 pb-0.5 text-xs font-medium">
            <Trans>Next steps</Trans>
          </p>
          <ul className="flex flex-col">
            {steps.map((step, index) => (
              <li key={`${index}-${step}`}>
                <button
                  type="button"
                  onClick={open}
                  className={cn([ROW_CLASS, "flex items-center gap-2.5 py-1"])}
                >
                  <span
                    aria-hidden="true"
                    data-upshot-marker
                    className="bg-primary rounded-pill size-1.5 shrink-0"
                  />
                  <span
                    title={step}
                    className="text-foreground min-w-0 flex-1 truncate text-sm"
                  >
                    {step}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <p className="text-muted-foreground truncate px-2 pt-1.5 text-xs">
        <Trans>AI summary, may contain mistakes</Trans>
      </p>
    </section>
  );
}

function relativeDay(timeMs: number, today: string, yesterday: string) {
  const date = new Date(timeMs);
  const now = new Date();
  const start = (value: Date, addDays = 0) =>
    new Date(
      value.getFullYear(),
      value.getMonth(),
      value.getDate() + addDays,
    ).getTime();
  const dayMs = start(date);
  if (dayMs === start(now)) return today;
  if (dayMs === start(now, -1)) return yesterday;
  return format(
    date,
    date.getFullYear() === now.getFullYear() ? "MMM d" : "MMM d, yyyy",
  );
}
