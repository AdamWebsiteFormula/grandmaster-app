// Fork: home screen, top to bottom: Coming up, Follow-ups, notes by day,
// with the Ask anything composer pinned below (home-composer.tsx, added by
// main/empty.tsx). Layout and density follow Granola's Home (Granola 101,
// docs.granola.ai/help-center/getting-started/granola-101, and Adam's
// Granola screenshots, Oct 3) in Upshot's black, orange and Geist.
// Sources:
// - Coming up: Granola 101 leads with a "Coming up" card of the next days'
//   meetings; Notion AI meeting notes and Fireflies home do the same.
// - Follow-ups: Granola's "Suggested follow-up emails" strip; Otter action
//   items and Fireflies Tasks; NN/g, dashboards should show what people can
//   act on at a glance (nngroup.com/articles/dashboards-preattentive).
// - Notes: Granola 101, every note on Home grouped by day (the sidebar is
//   navigation only), two-line rows with who was there, paged with
//   "Show more".
// - No streak or stat cards here: broken streaks lower engagement
//   (Silverman & Barasch 2023, Journal of Consumer Research).
// - Shortcuts only when there are no notes: NN/g empty states
//   (nngroup.com/articles/empty-state-interface-design).
import { Trans, useLingui } from "@lingui/react/macro";
import { platform } from "@tauri-apps/plugin-os";
import { type ReactNode, useCallback, useState } from "react";

import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Lock,
  Microphone,
} from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";
import { Checkbox } from "@anlg/ui/components/ui/checkbox";
import { Kbd } from "@anlg/ui/components/ui/kbd";
import { cn, format } from "@anlg/utils";

import {
  COMING_UP_DAYS,
  type ComingUpDay,
  type ComingUpEvent,
  type FollowUpRow,
  RECENT_PAGE_SIZE,
  type RecentGroup,
  type RecentNote,
  setFollowUpDone,
  useComingUp,
  useFollowUps,
  useRecentNotes,
} from "./home-data";

import { revealLockedNote } from "~/lock/notes";
import {
  getOrCreateSessionForEventId,
  sessionHasTranscript,
} from "~/session/queries";
import { usePermission } from "~/shared/hooks/usePermissions";
import { useTimeFormat } from "~/shared/hooks/useTimeFormat";
import { isMac, kbdLabel } from "~/shared/shortcut-label";
import { InteractiveButton } from "~/shared/ui/interactive-button";
import {
  openNewNoteAndListen,
  openSessionAndListen,
  useNewNote,
} from "~/shared/useNewNote";
import { useSessionContextMenu } from "~/sidebar/timeline/item";
import { useTabs } from "~/store/zustand/tabs";

// Fork: one centered 640 px column for the list and the composer below it
// (redline2-oct3, Home). The floating New note in main/body.tsx lines up
// with its right edge.
export const HOME_COLUMN_CLASS = "mx-auto w-full max-w-[640px] px-8";

// Fork: Bricolage Grotesque for big titles only; rows stay in Geist.
const DISPLAY_TITLE_CLASS =
  "font-display text-foreground font-semibold tracking-[-0.01em]";

export function HomeView() {
  const [limit, setLimit] = useState(RECENT_PAGE_SIZE);
  const recent = useRecentNotes(limit);
  const comingUp = useComingUp();

  if (recent.isLoading || comingUp.isLoading) return null;

  return (
    // Fork: the scrollbar sits inside the panel with a soft thumb, and the
    // bottom padding keeps the last row clear of the pinned composer.
    <div
      data-tauri-drag-region
      className="scrollbar-soft h-full overflow-y-auto"
    >
      {/* Fork: 8 px rhythm, mt-8 between sections; the notes list gets
          24 px more so past notes do not read as Coming up rows
          (redline5-oct3, Gestalt proximity). */}
      <div
        className={cn([
          HOME_COLUMN_CLASS,
          "flex flex-col pt-14 pb-40 [&>section+section]:mt-8",
          "[&>section+section[aria-labelledby=home-recent]]:mt-14",
        ])}
      >
        {/* Fork: Coming up reads the Mac's Calendar, so it shows on a Mac
            only; elsewhere it could only say the week is empty (NN/g
            heuristic #5, error prevention). The notes then start the page. */}
        {isMac() ? <ComingUp days={comingUp.days} /> : null}
        <FollowUps />
        {recent.hasNotes ? (
          <RecentNotes
            groups={recent.groups}
            hasMore={recent.hasMore}
            onShowMore={() => setLimit((value) => value + RECENT_PAGE_SIZE)}
          />
        ) : (
          <Shortcuts />
        )}
      </div>
    </div>
  );
}

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className={cn([DISPLAY_TITLE_CLASS, "mb-3 text-lg"])}>
      {children}
    </h2>
  );
}

// Fork: design-system.md, times in Geist sans with tabular figures, at full
// size: small caps shrank the digits to about 9 pt, under the 10 pt macOS
// minimum (Apple HIG, Typography). Apple Mail and Calendar write "10:37 PM".
const TIME_CLASS = "text-muted-foreground shrink-0 tabular-nums";

function useOpenNote() {
  const openCurrent = useTabs((state) => state.openCurrent);
  return useCallback(
    (id: string) => openCurrent({ type: "sessions", id }),
    [openCurrent],
  );
}

function useFormatTime() {
  const timeFormat = useTimeFormat();
  return useCallback(
    (ms: number) => format(new Date(ms), timeFormat).toUpperCase(),
    [timeFormat],
  );
}

// "10:00 – 10:05 AM": a shared AM or PM shows once.
function useFormatRange() {
  const formatTime = useFormatTime();
  return useCallback(
    (startMs: number, endMs: number | null) => {
      const start = formatTime(startMs);
      if (endMs === null) return start;
      const end = formatTime(endMs);
      const meridiem = /\s(AM|PM)$/;
      const startMeridiem = start.match(meridiem)?.[1];
      if (startMeridiem && startMeridiem === end.match(meridiem)?.[1]) {
        return `${start.replace(meridiem, "")} – ${end}`;
      }
      return `${start} – ${end}`;
    },
    [formatTime],
  );
}

// -------------------------------------------------------------- Coming up

const DAYS_PER_PAGE = 4;

// Fork: one card, a day per block, like Granola's Coming up. Arrows page
// through the days.
export function ComingUp({ days }: { days: ComingUpDay[] }) {
  const { t } = useLingui();
  const [page, setPage] = useState(0);
  const hasEvents = days.some((day) => day.events.length > 0);
  const pages = Math.max(1, Math.ceil(days.length / DAYS_PER_PAGE));
  const current = Math.min(page, pages - 1);
  const visible = days.slice(
    current * DAYS_PER_PAGE,
    (current + 1) * DAYS_PER_PAGE,
  );
  // The live meeting, or the next one, shows Start recording without hovering.
  const nextId = days.find((day) => day.events.length > 0)?.events[0]?.id;

  return (
    <section aria-labelledby="home-coming-up" className="flex flex-col">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2
          id="home-coming-up"
          // Fork: the page title in the display face, as Granola sets
          // "Coming up" apart from its rows (granola-screens/01).
          className={cn([DISPLAY_TITLE_CLASS, "text-2xl"])}
        >
          <Trans>Coming up</Trans>
        </h2>
        {hasEvents ? (
          <div className="flex items-center gap-1">
            <PageButton
              label={t`Earlier days`}
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              <CaretLeft className="size-4" />
            </PageButton>
            <PageButton
              label={t`Later days`}
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
            >
              <CaretRight className="size-4" />
            </PageButton>
          </div>
        ) : null}
      </div>
      {hasEvents ? (
        <ol className="bg-card dark:bg-muted border-border divide-border flex flex-col divide-y rounded-xl border">
          {visible.map((day) => (
            <ComingUpDayBlock key={day.dayMs} day={day} nextId={nextId} />
          ))}
        </ol>
      ) : (
        // Fork: an empty week keeps a compact card with one quiet line. With
        // the calendar off, a secondary "Connect calendar" sits on the right;
        // recording lives in "New note" only (redline-oct3: no duplicate
        // action; NN/g empty states,
        // nngroup.com/articles/empty-state-interface-design).
        <div className="bg-card dark:bg-muted border-border flex min-h-14 items-center gap-4 rounded-xl border px-4 py-3">
          <EmptyWeek />
        </div>
      )}
    </section>
  );
}

function PageButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="text-muted-foreground hover:bg-accent hover:text-foreground inline-flex size-7 cursor-pointer items-center justify-center rounded-lg transition-colors disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function ComingUpDayBlock({
  day,
  nextId,
}: {
  day: ComingUpDay;
  nextId: string | undefined;
}) {
  const date = new Date(day.dayMs);

  return (
    <li
      data-coming-up-day
      className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-2 px-4 py-2.5"
    >
      {/* Fork: big day number, month and weekday stacked beside it; today
          gets a small orange dot (Granola marks today the same way). */}
      <div className="flex items-start gap-2.5 pt-0.5">
        <span className="text-foreground w-8 text-right text-2xl leading-none font-light tabular-nums">
          {format(date, "d")}
        </span>
        <span className="flex flex-col pt-0.5 text-xs">
          <span className="text-foreground flex items-center gap-1 font-medium">
            {format(date, "MMMM")}
            {day.isToday ? (
              <span
                aria-hidden="true"
                className="bg-primary rounded-pill size-1.5"
              />
            ) : null}
          </span>
          <span className="text-muted-foreground">{format(date, "EEE")}</span>
        </span>
      </div>
      <ul className="flex flex-col gap-1">
        {day.events.length === 0 ? (
          <li className="flex min-h-9 items-center gap-3 px-2">
            <span
              aria-hidden="true"
              className="bg-input w-[3px] self-stretch rounded-full"
            />
            <span className="text-muted-foreground text-sm">
              <Trans>No more events today</Trans>
            </span>
          </li>
        ) : (
          day.events.map((event) => (
            <ComingUpEventRow
              key={event.id}
              event={event}
              prominent={event.id === nextId}
            />
          ))
        )}
      </ul>
    </li>
  );
}

function ComingUpEventRow({
  event,
  prominent,
}: {
  event: ComingUpEvent;
  prominent: boolean;
}) {
  const { t } = useLingui();
  const formatRange = useFormatRange();
  const openNote = useOpenNote();
  const [busy, setBusy] = useState(false);
  const title = event.title || t`Untitled`;

  // Same event-to-note paths as the old Up next row.
  const openEvent = (record: boolean) => {
    if (busy) return;
    setBusy(true);
    void getOrCreateSessionForEventId(event.id, event.title || undefined)
      .then(async (sessionId) => {
        // Fork: opening a meeting that has started records, as Granola does
        // (Granola docs "How transcription works": opening a meeting from
        // the home screen once its start time has passed). A note that
        // already has a transcript only opens, so Resume stays a choice.
        const listen =
          record || (event.live && !(await sessionHasTranscript(sessionId)));
        if (listen) {
          openSessionAndListen(sessionId, { behavior: "current" });
        } else {
          openNote(sessionId);
        }
        setBusy(false);
      })
      .catch((error) => {
        console.error("[home] failed to open event note", error);
        setBusy(false);
      });
  };

  // Fork: the title button keeps no outline of its own, so the row shows a
  // focus ring when it has keyboard focus (WCAG 2.2 SC 2.4.7 Focus Visible).
  return (
    <li className="group hover:bg-accent focus-within:bg-accent has-[>button:focus-visible]:ring-ring flex items-center gap-3 rounded-lg px-2 py-0.5 transition-colors has-[>button:focus-visible]:ring-2">
      <span
        aria-hidden="true"
        className={cn([
          "w-[3px] self-stretch rounded-full",
          !event.color && "bg-muted-foreground",
        ])}
        style={event.color ? { backgroundColor: event.color } : undefined}
      />
      <button
        type="button"
        onClick={() => openEvent(false)}
        className="min-w-0 flex-1 cursor-pointer py-1 text-left focus-visible:outline-none"
      >
        {/* Fork: full title on hover when truncated (ux-audit-oct3 B, WCAG 1.3.1). */}
        <p
          title={title}
          className="text-foreground truncate text-sm font-medium"
        >
          {title}
        </p>
        <p className={cn([TIME_CLASS, "text-xs"])}>
          {event.live ? (
            <span className="text-primary font-sans font-medium [font-variant-caps:normal]">
              <Trans>Now</Trans>
              {" · "}
            </span>
          ) : null}
          {formatRange(event.startMs, event.endMs)}
        </p>
      </button>
      {/* The wrapper fades the button and its squircle border overlay
          (painted on the parent) together. */}
      <span
        className={cn([
          "relative flex shrink-0",
          !prominent &&
            "opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100",
        ])}
      >
        <RecordButton disabled={busy} onClick={() => openEvent(true)}>
          <Trans>Start recording</Trans>
        </RecordButton>
      </span>
    </li>
  );
}

// Secondary on purpose: the orange "New note" is this screen's one primary
// (Granola keeps "+ New note" as the single filled button top right).
function RecordButton({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      onClick={onClick}
      className="h-7 shrink-0 gap-1.5 px-2.5 text-xs shadow-none"
    >
      <Microphone className="size-3.5" />
      {children}
    </Button>
  );
}

// With calendar access off on macOS, point to Calendar instead of claiming
// the week is free.
function EmptyWeek() {
  const openNew = useTabs((state) => state.openNew);
  const calendar = usePermission("calendar");
  const needsCalendar =
    platform() === "macos" &&
    calendar.status !== undefined &&
    calendar.status !== "authorized";

  if (needsCalendar) {
    return (
      <>
        <p className="text-muted-foreground min-w-0 flex-1 text-sm">
          <Trans>Your next meetings show up here</Trans>
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            openNew({ type: "settings", state: { tab: "calendars" } })
          }
          className="h-7 shrink-0 gap-1.5 px-2.5 text-xs shadow-none"
        >
          <CalendarBlank className="size-3.5" />
          <Trans>Connect calendar</Trans>
        </Button>
      </>
    );
  }

  return (
    <p className="text-muted-foreground min-w-0 flex-1 text-sm">
      <Trans>No meetings in the next {COMING_UP_DAYS} days</Trans>
    </p>
  );
}

// ------------------------------------------------------------- Follow-ups

export function FollowUps() {
  // Items ticked on this screen stay listed (struck through) so a tick can
  // be undone, like Things and Todoist; they drop off on the next visit.
  const [ticked, setTicked] = useState<string[]>([]);
  const { items } = useFollowUps(ticked);

  if (items.length === 0) return null;

  const toggle = (item: FollowUpRow, done: boolean) => {
    if (done && !ticked.includes(item.id)) {
      setTicked((ids) => [...ids, item.id]);
    }
    void setFollowUpDone(item.id, done).catch((error) => {
      console.error("[home] failed to update follow-up", error);
    });
  };

  // Fork: a soft strip under Coming up, like Granola's "Suggested follow-up
  // emails", shown only when there is something to do.
  return (
    <section
      aria-labelledby="home-follow-ups"
      className="bg-card dark:bg-muted border-border mt-3! flex flex-col rounded-xl border px-2 pt-2.5 pb-1.5"
    >
      <h2
        id="home-follow-ups"
        className="text-muted-foreground px-2 pb-1 text-xs font-medium"
      >
        <Trans>Follow-ups</Trans>
      </h2>
      <ul className="flex flex-col">
        {items.map((item) => (
          <FollowUpItem key={item.id} item={item} onToggle={toggle} />
        ))}
      </ul>
    </section>
  );
}

function FollowUpItem({
  item,
  onToggle,
}: {
  item: FollowUpRow;
  onToggle: (item: FollowUpRow, done: boolean) => void;
}) {
  const { t } = useLingui();
  const openNote = useOpenNote();
  const done = item.status === "done" || item.status === "completed";
  const noteTitle = item.session_title?.trim() || t`Untitled`;

  return (
    <li className="hover:bg-accent flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors">
      <Checkbox
        checked={done}
        onCheckedChange={(value) => onToggle(item, value === true)}
        aria-label={done ? t`Mark as not done` : t`Mark as done`}
        // Fork: checkboxes stay neutral (design-system.md), never the accent.
        className="border-muted-foreground data-[state=checked]:border-foreground data-[state=checked]:bg-foreground data-[state=checked]:text-background size-4 cursor-pointer rounded shadow-none [&_svg]:size-3"
      />
      <span
        className={cn([
          "min-w-0 flex-1 truncate text-sm font-medium",
          done ? "text-muted-foreground line-through" : "text-foreground",
        ])}
        title={item.text}
      >
        {item.text}
      </span>
      {item.session_id ? (
        <button
          type="button"
          onClick={() => openNote(item.session_id!)}
          title={t`Open ${noteTitle}`}
          className="text-muted-foreground hover:text-foreground max-w-56 shrink-0 cursor-pointer truncate text-xs transition-colors"
        >
          {noteTitle}
        </button>
      ) : null}
    </li>
  );
}

// ------------------------------------------------------------------ Notes

export function RecentNotes({
  groups,
  hasMore = false,
  onShowMore,
  headingId = "home-recent",
  compactHeading = false,
}: {
  groups: RecentGroup[];
  hasMore?: boolean;
  onShowMore?: () => void;
  headingId?: string;
  /** Fork: the folder page uses its own small section headings. */
  compactHeading?: boolean;
}) {
  const { t } = useLingui();
  // Fork: rows without attendees have no leading mark; while any row shows
  // initials, the others keep an empty slot so titles line up.
  const avatarSlot = groups.some((group) =>
    group.notes.some((note) => note.people.length > 0),
  );
  const groupLabel = (group: RecentGroup) =>
    group.kind === "today"
      ? t`Today`
      : group.kind === "yesterday"
        ? t`Yesterday`
        : format(
            new Date(group.dayMs),
            new Date(group.dayMs).getFullYear() === new Date().getFullYear()
              ? "EEE, MMM d"
              : "EEE, MMM d, yyyy",
          );

  return (
    <section aria-labelledby={headingId} className="flex flex-col">
      {compactHeading ? (
        <h4 id={headingId} className="mb-1.5 text-sm font-medium">
          <Trans>Notes</Trans>
        </h4>
      ) : (
        // Fork: Granola's Home has no "Notes" title; the day headers carry
        // the list. Kept for screen readers.
        <h2 id={headingId} className="sr-only">
          <Trans>Notes</Trans>
        </h2>
      )}
      {/* Fork: -mx-2 lines the day labels and titles up with "Coming up"
          and its card; the rows keep px-2 for their hover fill (Apple HIG,
          Layout: indented items read as subordinate). */}
      <div className="-mx-2 flex flex-col gap-5">
        {groups.map((group) => (
          <div key={group.key} className="flex flex-col">
            <h3 className="text-muted-foreground px-2 pb-1 text-xs font-medium">
              {groupLabel(group)}
            </h3>
            <ul className="flex flex-col">
              {group.notes.map((note) => (
                <RecentNoteRow
                  key={note.id}
                  note={note}
                  avatarSlot={avatarSlot}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
      {hasMore && onShowMore ? (
        <div className="mt-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onShowMore}
            className="text-muted-foreground hover:text-foreground h-8 px-2"
          >
            <Trans>Show more</Trans>
          </Button>
        </div>
      ) : null}
    </section>
  );
}

// "Bbaird & Jimharbaugh104", "Ann, Bo & 2 others", as Granola lists them.
function usePeopleLine() {
  const { t } = useLingui();
  return (note: RecentNote) => {
    const names = note.people;
    if (names.length === 0) return null;
    // The count includes you; names leave you out.
    const others = Math.max(names.length, note.attendees - 1);
    const shown = others > 3 ? names.slice(0, 2) : names.slice(0, 3);
    const rest = others - shown.length;
    const parts = rest > 0 ? [...shown, t`${rest} others`] : shown;
    if (parts.length === 1) return parts[0];
    const first = parts.slice(0, -1).join(", ");
    const last = parts[parts.length - 1];
    return t`${first} & ${last}`;
  };
}

// "45 min", "1 hr 5 min", as Apple Calendar and Screen Time write lengths;
// null when nothing was recorded.
function useFormatDuration() {
  const { t } = useLingui();
  return (ms: number) => {
    if (!(ms > 0)) return null;
    const total = Math.max(1, Math.round(ms / 60_000));
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    if (hours === 0) return t`${minutes} min`;
    if (minutes === 0) return t`${hours} hr`;
    return t`${hours} hr ${minutes} min`;
  };
}

function RecentNoteRow({
  note,
  avatarSlot,
}: {
  note: RecentNote;
  avatarSlot: boolean;
}) {
  const { t } = useLingui();
  const formatTime = useFormatTime();
  const peopleLine = usePeopleLine();
  const openNote = useOpenNote();
  const title = note.title || t`Untitled note`;
  // Fork: same right-click menu as the old sidebar row (sidebar/timeline/item.tsx).
  const contextMenu = useSessionContextMenu({
    sessionId: note.id,
    title,
    trackingId: note.trackingId,
    locked: note.locked,
  });
  const formatDuration = useFormatDuration();
  const people = peopleLine(note);
  const initial = Array.from(note.people[0]?.trim() ?? "")[0] ?? "";
  const duration = formatDuration(note.durationMs);
  // Fork: a second line only for real metadata: attendees, as Granola's rows
  // show them, else the recorded length. min-h-14 and items-center keep every
  // row one height with single-line titles centered, so no empty line pushes
  // a title off center (redline3-oct3 S2; redline4-oct3).
  const details = people ?? duration;

  const open = () => {
    if (!note.locked) {
      openNote(note.id);
      return;
    }
    void revealLockedNote(note.id).then((ok) => {
      if (ok) openNote(note.id);
    });
  };

  return (
    <li>
      <InteractiveButton
        onClick={open}
        contextMenu={contextMenu}
        className="hover:bg-accent flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors"
      >
        {/* Fork: the first attendee's initial in a rounded square, as
            Granola's meeting rows have; no mark without attendees
            (redline2-oct3, Home). */}
        {initial ? (
          <span
            aria-hidden="true"
            data-note-avatar
            className="bg-muted text-muted-foreground border-border flex size-8 shrink-0 items-center justify-center rounded-lg border text-sm font-medium uppercase"
          >
            {initial}
          </span>
        ) : avatarSlot ? (
          <span aria-hidden="true" className="size-8 shrink-0" />
        ) : null}
        <span className="flex min-w-0 flex-1 flex-col">
          {/* Fork: the time sits on the title's line, baseline-aligned,
              as Apple Mail and Granola list rows do (redline5-oct3, Home). */}
          <span className="flex min-w-0 items-baseline gap-3">
            {/* Fork: full title on hover and a lock mark on locked notes
                (ux-audit-oct3 B, WCAG 1.3.1). */}
            <span
              title={title}
              className="text-foreground flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium"
            >
              <span className="min-w-0 truncate">{title}</span>
              {note.locked ? (
                <span
                  role="img"
                  aria-label={t`Locked`}
                  className="text-muted-foreground shrink-0"
                >
                  <Lock className="size-3.5" aria-hidden="true" />
                </span>
              ) : null}
            </span>
            {/* Fork: redline-oct3, row times at text-sm so they read at a
                glance (Granola's "3:00 PM" sits at body size). */}
            <span className={cn([TIME_CLASS, "text-sm"])}>
              {formatTime(note.timeMs)}
            </span>
          </span>
          {details ? (
            <span className="text-muted-foreground truncate text-xs tabular-nums">
              {details}
            </span>
          ) : null}
        </span>
      </InteractiveButton>
    </li>
  );
}

// -------------------------------------------- Empty state (no notes yet)

function Shortcuts() {
  const newNote = useNewNote({ behavior: "current" });
  const openCurrent = useTabs((state) => state.openCurrent);

  return (
    <section aria-labelledby="home-start" className="flex flex-col">
      <SectionTitle id="home-start">
        <Trans>Your notes show up here</Trans>
      </SectionTitle>
      {/* Fork: ⌘N records and ⇧⌘N makes a blank note (ux-audit-oct3 A/B,
          Granola 101: New note starts transcribing; NN/g #4). Off a Mac
          they read Ctrl+N and Ctrl+Shift+N (Microsoft Writing Style Guide,
          Keys and keyboard shortcuts). ⌘, is the Mac menu's Settings key;
          Windows and Linux have no such key, so no hint there (NN/g #5). */}
      <div className="flex flex-col">
        <ShortcutItem
          label={<Trans>Start recording</Trans>}
          shortcut={kbdLabel(["mod", "N"])}
          onClick={() => openNewNoteAndListen({ behavior: "current" })}
        />
        <ShortcutItem
          label={<Trans>Blank note</Trans>}
          shortcut={kbdLabel(["shift", "mod", "N"])}
          onClick={newNote}
        />
        <ShortcutItem
          label={<Trans>Settings</Trans>}
          shortcut={isMac() ? kbdLabel(["mod", ","]) : null}
          onClick={() => openCurrent({ type: "settings" })}
        />
      </div>
    </section>
  );
}

function ShortcutItem({
  label,
  shortcut,
  onClick,
}: {
  label: ReactNode;
  shortcut: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-foreground hover:bg-accent -mx-3 flex cursor-pointer items-center justify-between gap-8 rounded-lg px-3 py-2 text-sm transition-colors"
    >
      <span>{label}</span>
      {shortcut ? <Kbd>{shortcut}</Kbd> : null}
    </button>
  );
}
