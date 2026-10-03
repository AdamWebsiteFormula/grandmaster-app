// Fork: home screen, top to bottom: Up next, Follow-ups, Recent notes, with
// the "Ask anything" bar floating below (added by main/empty.tsx).
// Sources:
// - Up next: Granola 101 leads with "Coming up" meetings
//   (docs.granola.ai/help-center/getting-started/granola-101); Notion AI
//   meeting notes and Fireflies home do the same.
// - Follow-ups: Otter action items and Fireflies Tasks; NN/g, dashboards
//   should show what people can act on at a glance
//   (nngroup.com/articles/dashboards-preattentive).
// - Notes: Granola 101, every note on Home grouped by day (the sidebar is
//   navigation only), paged with "Show more".
// - No streak or stat cards here: broken streaks lower engagement
//   (Silverman & Barasch 2023, Journal of Consumer Research).
// - Shortcuts only when there are no notes: NN/g empty states
//   (nngroup.com/articles/empty-state-interface-design).
import { Trans, useLingui } from "@lingui/react/macro";
import { platform } from "@tauri-apps/plugin-os";
import { type ReactNode, useCallback, useState } from "react";

import { Microphone } from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";
import { Checkbox } from "@anlg/ui/components/ui/checkbox";
import { Kbd } from "@anlg/ui/components/ui/kbd";
import { cn, format } from "@anlg/utils";

import {
  type FollowUpRow,
  RECENT_PAGE_SIZE,
  type RecentGroup,
  type RecentNote,
  setFollowUpDone,
  type UpNextEvent,
  useFollowUps,
  useRecentNotes,
  useUpNext,
} from "./home-data";

import { revealLockedNote } from "~/lock/notes";
import { getOrCreateSessionForEventId } from "~/session/queries";
import { usePermission } from "~/shared/hooks/usePermissions";
import { useTimeFormat } from "~/shared/hooks/useTimeFormat";
import { InteractiveButton } from "~/shared/ui/interactive-button";
import {
  openNewNoteAndListen,
  openSessionAndListen,
  useNewNote,
} from "~/shared/useNewNote";
import { useSessionContextMenu } from "~/sidebar/timeline/item";
import { useTabs } from "~/store/zustand/tabs";

export function HomeView() {
  const [limit, setLimit] = useState(RECENT_PAGE_SIZE);
  const recent = useRecentNotes(limit);
  const upNext = useUpNext();

  if (recent.isLoading || upNext.isLoading) return null;

  return (
    // Fork: the scrollbar sits inside the panel with a soft thumb, and the
    // bottom padding keeps the last row clear of the
    // floating "Ask anything" bar: 40 px bar + 12 px offset + 16 px gap.
    <div
      data-tauri-drag-region
      className="scrollbar-soft h-full overflow-y-auto"
    >
      {/* Fork: one 640 px column; headings, card and row text share one
          left edge; 8 px rhythm (mt-8 between sections, mb-3 under titles). */}
      <div className="mx-auto flex w-full max-w-[640px] flex-col px-8 pt-16 pb-[68px] [&>section+section]:mt-8">
        <UpNext event={upNext.event} />
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
    <h2 id={id} className="text-foreground mb-3 text-lg font-semibold">
      {children}
    </h2>
  );
}

// Fork: design-system.md, Geist Mono for numbers and times.
const TIME_CLASS = "text-muted-foreground shrink-0 font-mono tabular-nums";

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

// The count includes you, so one person (a solo note) shows nothing.
function useAttendeesLabel() {
  const { t } = useLingui();
  return (count: number) => (count > 1 ? t`${count} people` : null);
}

// ---------------------------------------------------------------- Up next

export function UpNext({ event }: { event: UpNextEvent | null }) {
  const { t } = useLingui();
  const formatTime = useFormatTime();
  const attendeesLabel = useAttendeesLabel();
  const openNote = useOpenNote();
  const [busy, setBusy] = useState(false);

  const openEvent = useCallback(
    (record: boolean) => {
      if (!event || busy) return;
      setBusy(true);
      void getOrCreateSessionForEventId(event.id, event.title || undefined)
        .then((sessionId) => {
          if (record) {
            openSessionAndListen(sessionId, { behavior: "current" });
          } else {
            openNote(sessionId);
          }
        })
        .catch((error) => {
          console.error("[home] failed to open event note", error);
          setBusy(false);
        });
    },
    [busy, event, openNote],
  );

  const when = event
    ? event.when === "now"
      ? event.endMs
        ? t`Now, until ${formatTime(event.endMs)}`
        : t`Now`
      : event.when === "today"
        ? t`Today, ${formatTime(event.startMs)}`
        : t`Tomorrow, ${formatTime(event.startMs)}`
    : null;
  const people = event ? attendeesLabel(event.attendees) : null;

  return (
    <section aria-labelledby="home-up-next" className="flex flex-col">
      <SectionTitle id="home-up-next">
        <Trans>Up next</Trans>
      </SectionTitle>
      {event ? (
        <div className="bg-muted border-border flex min-h-16 items-center gap-4 rounded-xl border px-4 py-3">
          <button
            type="button"
            onClick={() => openEvent(false)}
            className="min-w-0 flex-1 cursor-pointer text-left"
          >
            <p className="text-foreground truncate text-sm font-medium">
              {event.title || t`Untitled`}
            </p>
            <p className="text-muted-foreground truncate text-sm tabular-nums">
              {people ? `${when} · ${people}` : when}
            </p>
          </button>
          <RecordButton disabled={busy} onClick={() => openEvent(true)}>
            <Trans>Record</Trans>
          </RecordButton>
        </div>
      ) : (
        // Fork: no card for an empty state, one quiet line and a secondary
        // button (NN/g empty states, nngroup.com/articles/empty-state-interface-design).
        <div className="flex min-h-8 items-center gap-4">
          <NoMeetingsLine />
          <RecordButton
            onClick={() => openNewNoteAndListen({ behavior: "current" })}
          >
            <Trans>Record now</Trans>
          </RecordButton>
        </div>
      )}
    </section>
  );
}

// Secondary on purpose: the orange "New note" is this screen's one primary
// (Granola keeps "+ Quick note" as the single filled button top right).
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
      className="h-8 shrink-0 gap-1.5 px-3 shadow-none"
    >
      <Microphone className="size-3.5" />
      {children}
    </Button>
  );
}

// With calendar access off on macOS, point to Calendar instead of claiming
// the day is free.
function NoMeetingsLine() {
  const openNew = useTabs((state) => state.openNew);
  const calendar = usePermission("calendar");
  const needsCalendar =
    platform() === "macos" &&
    calendar.status !== undefined &&
    calendar.status !== "authorized";

  if (needsCalendar) {
    return (
      <button
        type="button"
        onClick={() => openNew({ type: "calendar" })}
        className="text-muted-foreground hover:text-foreground min-w-0 flex-1 cursor-pointer truncate text-left text-sm underline-offset-4 transition-colors hover:underline"
      >
        <Trans>Connect your calendar</Trans>
      </button>
    );
  }

  return (
    <p className="text-muted-foreground min-w-0 flex-1 text-sm">
      <Trans>No meetings coming up</Trans>
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

  return (
    <section aria-labelledby="home-follow-ups" className="flex flex-col">
      <SectionTitle id="home-follow-ups">
        <Trans>Follow-ups</Trans>
      </SectionTitle>
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
    <li className="hover:bg-accent -mx-3 flex items-start gap-3 rounded-lg px-3 py-2 transition-colors">
      <Checkbox
        checked={done}
        onCheckedChange={(value) => onToggle(item, value === true)}
        aria-label={done ? t`Mark as not done` : t`Mark as done`}
        // Fork: checkboxes stay neutral (design-system.md), never the accent.
        className="border-muted-foreground data-[state=checked]:border-foreground data-[state=checked]:bg-foreground data-[state=checked]:text-background mt-0.5 size-4 cursor-pointer rounded shadow-none [&_svg]:size-3"
      />
      <span
        className={cn([
          "min-w-0 flex-1 text-sm text-pretty",
          done ? "text-muted-foreground line-through" : "text-foreground",
        ])}
      >
        {item.text}
      </span>
      {item.session_id ? (
        <button
          type="button"
          onClick={() => openNote(item.session_id!)}
          title={t`Open ${noteTitle}`}
          className="text-muted-foreground hover:text-foreground max-w-48 shrink-0 cursor-pointer truncate text-sm transition-colors"
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
}: {
  groups: RecentGroup[];
  hasMore?: boolean;
  onShowMore?: () => void;
}) {
  const { t } = useLingui();
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
    <section aria-labelledby="home-recent" className="flex flex-col">
      <SectionTitle id="home-recent">
        <Trans>Notes</Trans>
      </SectionTitle>
      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.key} className="flex flex-col">
            <h3 className="text-muted-foreground pb-1 text-xs font-medium">
              {groupLabel(group)}
            </h3>
            <ul className="flex flex-col">
              {group.notes.map((note) => (
                <RecentNoteRow key={note.id} note={note} />
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
            className="text-muted-foreground hover:text-foreground -mx-3 h-8 px-3"
          >
            <Trans>Show more</Trans>
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function RecentNoteRow({ note }: { note: RecentNote }) {
  const { t } = useLingui();
  const formatTime = useFormatTime();
  const attendeesLabel = useAttendeesLabel();
  const openNote = useOpenNote();
  const title = note.title || t`Untitled`;
  // Fork: same right-click menu as the old sidebar row (sidebar/timeline/item.tsx).
  const contextMenu = useSessionContextMenu({
    sessionId: note.id,
    title,
    trackingId: note.trackingId,
    locked: note.locked,
  });
  const people = attendeesLabel(note.attendees);

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
        className="hover:bg-accent -mx-3 flex w-[calc(100%+1.5rem)] cursor-pointer items-center gap-4 rounded-lg px-3 py-2 text-left text-sm transition-colors"
      >
        <span className="text-foreground min-w-0 flex-1 truncate">{title}</span>
        {people ? (
          <span className="text-muted-foreground shrink-0">{people}</span>
        ) : null}
        <span className={TIME_CLASS}>{formatTime(note.timeMs)}</span>
      </InteractiveButton>
    </li>
  );
}

// -------------------------------------------- Empty state (no notes yet)

function Shortcuts() {
  const newNote = useNewNote({ behavior: "current" });
  const openCurrent = useTabs((state) => state.openCurrent);
  const primaryModifier = platform() === "macos" ? "⌘" : "Ctrl";

  return (
    <section aria-labelledby="home-start" className="flex flex-col">
      <SectionTitle id="home-start">
        <Trans>Your notes show up here</Trans>
      </SectionTitle>
      <div className="flex flex-col">
        <ShortcutItem
          label={<Trans>New note</Trans>}
          shortcut={[primaryModifier, "N"]}
          onClick={newNote}
        />
        <ShortcutItem
          label={<Trans>Start recording</Trans>}
          shortcut={[primaryModifier, "⇧", "N"]}
          onClick={() => openNewNoteAndListen({ behavior: "current" })}
        />
        <ShortcutItem
          label={<Trans>Settings</Trans>}
          shortcut={[primaryModifier, ","]}
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
  shortcut: string[];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-foreground hover:bg-accent -mx-3 flex cursor-pointer items-center justify-between gap-8 rounded-lg px-3 py-2 text-sm transition-colors"
    >
      <span>{label}</span>
      <Kbd>{shortcut.join(" ")}</Kbd>
    </button>
  );
}
