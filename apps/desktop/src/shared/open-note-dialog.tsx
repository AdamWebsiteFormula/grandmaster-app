import { Trans, useLingui } from "@lingui/react/macro";
import { Command as CommandPrimitive } from "cmdk";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";

import {
  ChatCircle,
  FileText,
  Gear,
  House,
  Lock,
  MagnifyingGlass,
  Microphone,
  Users,
  X,
  type Icon,
} from "@anlg/ui/components/icons";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@anlg/ui/components/ui/dialog";
import { cn } from "@anlg/utils";

import { trackAnalyticsEvent } from "~/analytics";
import { useAuth } from "~/auth";
import { useBillingAccess } from "~/auth/billing-context";
import { useSearchEngine } from "~/search/contexts/engine";
import { extractPlainText } from "~/search/contexts/engine/utils";
import { MoveToFolderDialog } from "~/session/components/folder-picker";
import { useSessionSummaries } from "~/session/queries";
import { useDurableSharedNotes } from "~/shared-notes/cache";
import { useEmptyNoteIds } from "~/shared/empty-note-ids";
import { shortcutLabel } from "~/shared/shortcut-label";
import { useNewNote, useNewNoteAndListen } from "~/shared/useNewNote";
import { useSettingsNavGroups } from "~/sidebar/settings-nav-groups";
import { type TabInput, useTabs } from "~/store/zustand/tabs";

const MAX_RECENT_DISPLAY = 5;
const CONTENT_SEARCH_MIN_CHARS = 2;
const CONTENT_SEARCH_DEBOUNCE_MS = 200;
const MAX_CONTENT_RESULTS = 8;
const SNIPPET_BEFORE_CHARS = 40;
const SNIPPET_MAX_CHARS = 120;

interface OpenNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type OpenNoteDialogContextValue = {
  open: () => void;
};

type NoteResult = {
  resourceType: "session" | "shared_session";
  id: string;
  title: string;
  createdAt: string;
};

type ContentResult = {
  note: NoteResult;
  snippet: string;
};

type PageResult = {
  id: string;
  label: string;
  hint: string | null;
  groupLabel: string;
  icon: Icon;
  requiresPro: boolean;
  destination: TabInput;
  /** Runs instead of opening `destination` (Home, Chat, New note). */
  run?: () => void;
};

const OpenNoteDialogContext = createContext<OpenNoteDialogContextValue | null>(
  null,
);

export function OpenNoteDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const openDialog = useCallback(() => {
    setOpen(true);
  }, []);

  useHotkeys("mod+k", openDialog, {
    preventDefault: true,
    enableOnFormTags: true,
    enableOnContentEditable: true,
  });

  const value = useMemo(() => ({ open: openDialog }), [openDialog]);

  return (
    <OpenNoteDialogContext.Provider value={value}>
      {children}
      <OpenNoteDialog open={open} onOpenChange={setOpen} />
      {/* Fork: host for "Move to folder…" from a note's right-click menu
          (journey-after P2 "Add note to folder from Home"). */}
      <MoveToFolderDialog />
    </OpenNoteDialogContext.Provider>
  );
}

export function useOpenNoteDialog() {
  const context = useContext(OpenNoteDialogContext);
  if (!context) {
    throw new Error(
      "useOpenNoteDialog must be used within OpenNoteDialogProvider",
    );
  }
  return context;
}

function selectOrOpen(type: "empty" | "chat") {
  const { tabs, select, openCurrent } = useTabs.getState();
  const existing = tabs.find((tab) => tab.type === type);
  if (existing) {
    select(existing);
  } else {
    openCurrent({ type });
  }
}

export function OpenNoteDialog({ open, onOpenChange }: OpenNoteDialogProps) {
  const { t } = useLingui();
  const [query, setQuery] = useState("");
  const openCurrent = useTabs((state) => state.openCurrent);
  const openNew = useTabs((state) => state.openNew);
  const recentlyOpenedSessionIds = useTabs(
    (state) => state.recentlyOpenedSessionIds,
  );
  const { isPro } = useBillingAccess();
  const { session } = useAuth();
  const settingsNavGroups = useSettingsNavGroups();

  const newNote = useNewNote({ behavior: "current" });
  const newNoteAndListen = useNewNoteAndListen();
  const allSessions = useSessionSummaries();
  const emptyNoteIds = useEmptyNoteIds(open);
  const sessions = useMemo(
    () => allSessions.filter((session) => !emptyNoteIds.has(session.id)),
    [allSessions, emptyNoteIds],
  );
  const sharedNotes = useDurableSharedNotes(session?.user.id);
  const { search } = useSearchEngine();
  const [contentHits, setContentHits] = useState<
    Array<{ id: string; title: string; content: string }>
  >([]);
  // Fork: the query the content hits belong to, so "No results" doesn't
  // flash while the debounced search runs (ux-audit-oct3 B; NN/g #1).
  const [searchedQuery, setSearchedQuery] = useState("");
  const [failedQuery, setFailedQuery] = useState<string | null>(null);

  const pageResults = useMemo<PageResult[]>(
    () => [
      // Fork: Home, Chat and New note commands, as Raycast and Linear
      // command menus offer (journey-after P3 "⌘K search, go to"; NN/g #7).
      {
        id: "home",
        label: t`Home`,
        hint: null,
        groupLabel: t`Go to`,
        icon: House,
        requiresPro: false,
        destination: { type: "empty" },
        run: () => selectOrOpen("empty"),
      },
      {
        id: "chat",
        label: t`Chat`,
        hint: null,
        groupLabel: t`Go to`,
        icon: ChatCircle,
        requiresPro: false,
        destination: { type: "chat" },
        run: () => selectOrOpen("chat"),
      },
      // Fork: the row does what its ⌘N hint does (record a new note), and
      // ⇧⌘N gets its own row, so the menu and the shortcut agree
      // (NN/g heuristic #4, consistency and standards). Off a Mac the hints
      // read Ctrl+N and Ctrl+Shift+N (Microsoft Writing Style Guide, Keys
      // and keyboard shortcuts).
      {
        id: "new-note",
        label: t`Record meeting`,
        hint: shortcutLabel(["mod", "N"]),
        groupLabel: t`Go to`,
        // Fork: the mic the Home button shows for the same command (NN/g #4).
        icon: Microphone,
        requiresPro: false,
        destination: { type: "empty" },
        run: newNoteAndListen,
      },
      {
        id: "blank-note",
        label: t`Blank note`,
        hint: shortcutLabel(["shift", "mod", "N"]),
        groupLabel: t`Go to`,
        icon: FileText,
        requiresPro: false,
        destination: { type: "empty" },
        run: newNote,
      },
      ...settingsNavGroups.flatMap((group) =>
        group.items.map((item): PageResult => {
          const hasDestination = "destination" in item;

          return {
            id: item.id,
            label: item.label,
            hint: hasDestination ? null : t`Settings`,
            groupLabel: group.label,
            icon: item.icon,
            requiresPro: Boolean(item.requiresPro),
            destination: hasDestination
              ? item.destination
              : { type: "settings", state: { tab: item.id } },
          };
        }),
      ),
      {
        id: "settings",
        label: t`Settings`,
        hint: null,
        groupLabel: t`Go to`,
        icon: Gear,
        requiresPro: false,
        destination: { type: "settings", state: { tab: "app" } },
      },
    ],
    [newNote, newNoteAndListen, settingsNavGroups, t],
  );

  const topLevelPageIds = new Set([
    "home",
    "chat",
    "new-note",
    "blank-note",
    "settings",
    ...settingsNavGroups.flatMap((group) =>
      group.items.flatMap((item) => ("destination" in item ? [item.id] : [])),
    ),
  ]);
  const filteredPages = query.trim()
    ? pageResults.filter((page) => {
        const normalizedQuery = query.trim().toLowerCase();
        return (
          page.label.toLowerCase().includes(normalizedQuery) ||
          page.groupLabel.toLowerCase().includes(normalizedQuery) ||
          page.hint?.toLowerCase().includes(normalizedQuery)
        );
      })
    : pageResults.filter((page) => topLevelPageIds.has(page.id));

  const sessionsMap = useMemo(() => {
    return new Map<string, NoteResult>(
      sessions.map((session) => [
        session.id,
        {
          resourceType: "session",
          id: session.id,
          // Fork: Home's word for a note with no title (journey-after P3).
          title: session.title || t`Untitled note`,
          createdAt: session.created_at,
        },
      ]),
    );
  }, [sessions, t]);

  const allNotesSortedByDate = useMemo(() => {
    return [
      ...sessionsMap.values(),
      ...sharedNotes
        .filter(
          (note) => !(note.manageAccess && sessionsMap.has(note.sessionId)),
        )
        .map(
          (note): NoteResult => ({
            resourceType: "shared_session",
            id: note.shareId,
            title: note.title || t`Untitled note`,
            createdAt: note.publishedAt,
          }),
        ),
    ].sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [sessionsMap, sharedNotes, t]);

  const recentSessions = useMemo(() => {
    return recentlyOpenedSessionIds
      .slice(0, MAX_RECENT_DISPLAY)
      .map((id) => sessionsMap.get(id))
      .filter((s): s is NoteResult => s !== undefined);
  }, [recentlyOpenedSessionIds, sessionsMap]);

  const recentSessionIdSet = useMemo(() => {
    return new Set(recentSessions.map((s) => s.id));
  }, [recentSessions]);

  const otherNotes = useMemo(() => {
    return allNotesSortedByDate.filter(
      (note) =>
        note.resourceType === "shared_session" ||
        !recentSessionIdSet.has(note.id),
    );
  }, [allNotesSortedByDate, recentSessionIdSet]);

  const filteredRecentSessions = useMemo(() => {
    if (!query.trim()) return recentSessions;
    const lowerQuery = query.toLowerCase();
    return recentSessions.filter((s) =>
      s.title.toLowerCase().includes(lowerQuery),
    );
  }, [recentSessions, query]);

  const filteredOtherNotes = useMemo(() => {
    if (!query.trim()) return otherNotes;
    const lowerQuery = query.toLowerCase();
    return otherNotes.filter((note) =>
      note.title.toLowerCase().includes(lowerQuery),
    );
  }, [otherNotes, query]);

  // Full-text search over note contents (Granola search across notes,
  // Fireflies sentence-level search), using the same index as chat.
  useEffect(() => {
    const trimmed = query.trim();
    if (!open || trimmed.length < CONTENT_SEARCH_MIN_CHARS) {
      setContentHits((prev) => (prev.length > 0 ? [] : prev));
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(() => {
      void search(trimmed)
        .then((hits) => {
          if (cancelled) return;
          setContentHits(
            hits
              .filter((hit) => hit.document.type === "session")
              .map((hit) => ({
                id: hit.document.id,
                title: hit.document.title,
                content: hit.document.content,
              })),
          );
          setSearchedQuery(trimmed);
          setFailedQuery(null);
        })
        .catch((error) => {
          if (cancelled) return;
          console.error("[open-note-dialog] content search failed", error);
          setSearchedQuery(trimmed);
          setFailedQuery(trimmed);
        });
    }, CONTENT_SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [open, query, search]);

  const contentResults = useMemo<ContentResult[]>(() => {
    if (query.trim().length < CONTENT_SEARCH_MIN_CHARS) return [];
    const titleMatchIds = new Set([
      ...filteredRecentSessions.map((note) => note.id),
      ...filteredOtherNotes
        .filter((note) => note.resourceType === "session")
        .map((note) => note.id),
    ]);
    const seen = new Set<string>();
    const results: ContentResult[] = [];
    // Fork: note-text matches belong to the words they were found for; old
    // matches for "bud" no longer show while "budget" is searched (task
    // test, Oct 8; NN/g #1).
    const hits = searchedQuery === query.trim() ? contentHits : [];

    for (const hit of hits) {
      if (results.length >= MAX_CONTENT_RESULTS) break;
      if (titleMatchIds.has(hit.id) || seen.has(hit.id)) continue;
      const note = sessionsMap.get(hit.id);
      if (!note) continue;
      seen.add(hit.id);
      results.push({ note, snippet: buildSnippet(hit.content, query) });
    }

    return results;
  }, [
    contentHits,
    filteredOtherNotes,
    filteredRecentSessions,
    query,
    searchedQuery,
    sessionsMap,
  ]);

  const trimmedQuery = query.trim();
  const isSearchPending =
    trimmedQuery.length >= CONTENT_SEARCH_MIN_CHARS &&
    searchedQuery !== trimmedQuery;

  const hasAnyResults =
    filteredPages.length > 0 ||
    filteredRecentSessions.length > 0 ||
    filteredOtherNotes.length > 0 ||
    contentResults.length > 0;

  useEffect(() => {
    if (!open || !query.trim()) return;
    const timeout = setTimeout(() => {
      trackAnalyticsEvent("search_performed", {
        entry_point: "open_note_dialog",
        result_count:
          filteredPages.length +
          filteredRecentSessions.length +
          filteredOtherNotes.length,
        entity_types: [
          ...new Set([
            ...[...filteredRecentSessions, ...filteredOtherNotes].map(
              (note) => note.resourceType,
            ),
            ...(filteredPages.length > 0 ? ["page"] : []),
          ]),
        ].sort(),
      });
    }, 300);
    return () => clearTimeout(timeout);
  }, [
    filteredOtherNotes.length,
    filteredPages.length,
    filteredRecentSessions.length,
    open,
    query,
  ]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setQuery("");
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  const focusInput = useCallback((node: HTMLInputElement | null) => {
    node?.focus();
  }, []);

  const handleSelect = useCallback(
    (note: NoteResult) => {
      trackAnalyticsEvent("search_result_opened", {
        entry_point: "open_note_dialog",
        result_type: note.resourceType,
        had_query: Boolean(query.trim()),
      });
      handleOpenChange(false);
      openCurrent(
        note.resourceType === "shared_session"
          ? { type: "shared_sessions", id: note.id }
          : { type: "sessions", id: note.id },
      );
    },
    [handleOpenChange, openCurrent, query],
  );

  const handleSelectPage = useCallback(
    (page: PageResult) => {
      trackAnalyticsEvent("search_result_opened", {
        entry_point: "open_note_dialog",
        result_type: "page",
        page_id: page.id,
        had_query: Boolean(query.trim()),
      });
      handleOpenChange(false);
      if (page.run) {
        page.run();
        return;
      }
      openNew(page.destination);
    },
    [handleOpenChange, openNew, query],
  );

  const isQueryEmpty = !query.trim();

  // Fork: whenever the results change, the first result is selected and the
  // list starts at the top, as Spotlight does. Note text matches arrive after
  // the title matches, and cmdk kept its earlier pick then, often a row out
  // of view, so nothing showed as selected and the list opened scrolled (picture
  // review, Oct 6 and 7; Apple HIG, Searching).
  const firstResultValue =
    (isQueryEmpty
      ? [
          filteredRecentSessions[0] && `recent-${filteredRecentSessions[0].id}`,
          filteredPages[0] && `page-${filteredPages[0].id}`,
        ]
      : [
          filteredPages[0] && `page-${filteredPages[0].id}`,
          filteredRecentSessions[0] && `recent-${filteredRecentSessions[0].id}`,
        ]
    ).find(Boolean) ||
    (filteredOtherNotes[0] &&
      `${filteredOtherNotes[0].resourceType}-${filteredOtherNotes[0].id}`) ||
    (contentResults[0] && `content-${contentResults[0].note.id}`) ||
    "";
  const [selectedValue, setSelectedValue] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const resultsKey = [
    query,
    firstResultValue,
    filteredPages.length,
    filteredRecentSessions.length,
    filteredOtherNotes.length,
    contentResults.length,
  ].join("|");
  // Fork: when more results arrive for the same words (note text comes
  // about 200 ms later), the row the user arrowed to stays selected; it
  // jumped back to the top, so Return opened another note (task test,
  // Oct 8; NN/g #3).
  const resultValues = new Set<string>([
    ...filteredRecentSessions.map((session) => `recent-${session.id}`),
    ...filteredPages.map((page) => `page-${page.id}`),
    ...filteredOtherNotes.map((note) => `${note.resourceType}-${note.id}`),
    ...contentResults.map((result) => `content-${result.note.id}`),
  ]);
  const selectedValueRef = useRef(selectedValue);
  selectedValueRef.current = selectedValue;
  const resultValuesRef = useRef(resultValues);
  resultValuesRef.current = resultValues;
  const lastQueryRef = useRef(query);
  useLayoutEffect(() => {
    const sameQuery = lastQueryRef.current === query;
    lastQueryRef.current = query;
    const current = selectedValueRef.current;
    if (sameQuery && current && resultValuesRef.current.has(current)) {
      return;
    }
    setSelectedValue(firstResultValue);
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = 0;
    const frame = requestAnimationFrame(() => {
      list.scrollTop = 0;
    });
    return () => cancelAnimationFrame(frame);
  }, [resultsKey]);

  // Fork: group dividers have 12 pt above and below (gap-1.5 plus mt-1.5
  // and the pb-1.5 under the group before), so they sit centered between
  // the groups (picture review, Oct 8: 6 and 22 pt).
  const pageGroup = filteredPages.length > 0 && (
    <CommandPrimitive.Group
      className={
        isQueryEmpty
          ? filteredOtherNotes.length > 0
            ? "pb-1.5"
            : ""
          : filteredRecentSessions.length > 0 || filteredOtherNotes.length > 0
            ? "pb-1.5"
            : ""
      }
      heading={
        <div className="flex flex-col gap-1.5">
          {isQueryEmpty && filteredRecentSessions.length > 0 && (
            <div className="bg-accent mx-2 mt-1.5 h-px" />
          )}
          <div className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
            <Trans>Go to</Trans>
          </div>
        </div>
      }
    >
      {filteredPages.map((page) => (
        <CommandPrimitive.Item
          key={`page-${page.id}`}
          value={`page-${page.id}`}
          onSelect={() => handleSelectPage(page)}
          className={cn([
            "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5",
            // Fork: results in the primary text color, as Spotlight lists
            // them; gray read as disabled (picture review, Oct 5; Apple HIG,
            // Color: secondary label only for less important text).
            "text-foreground text-sm",
            // Fork: the selected row gets the selected gray of the sidebar's
            // active row (light 90%, was the 94% hover gray Adam did not see
            // on Oct 4) and foreground text, so the keyboard position is easy
            // to see (WCAG 2.2 SC 2.4.7, 1.4.11; design-system.md: selected
            // rows stay neutral). Same on all four lists.
            "data-[selected=true]:bg-sidebar-accent data-[selected=true]:text-foreground dark:data-[selected=true]:bg-[hsl(0_0%_22%)]",
            "transition-colors",
          ])}
        >
          <page.icon className="text-muted-foreground h-4 w-4 shrink-0" />
          <span className="truncate">
            <MatchText text={page.label} query={query} />
          </span>
          {page.hint ? (
            <span className="text-muted-foreground ml-auto shrink-0 text-xs">
              {page.hint}
            </span>
          ) : null}
          {page.requiresPro && !isPro ? (
            <Lock
              aria-label={t`Requires Upshot Pro`}
              className="h-3.5 w-3.5 shrink-0"
            />
          ) : null}
        </CommandPrimitive.Item>
      ))}
    </CommandPrimitive.Group>
  );

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        overlayClassName="bg-black/20 backdrop-blur-xs"
        overlayChildren={
          <div
            data-open-note-dialog-drag-region
            data-tauri-drag-region
            className="absolute top-0 right-0 left-0 h-[15%]"
            onClick={(event) => event.stopPropagation()}
          />
        }
        className={cn([
          // Fork: centered on the window, as Spotlight is and as the dimmed
          // backdrop covers it (picture review, Oct 7: 6 pt right of center,
          // neither the window's nor the panel's).
          "top-[15%] w-full max-w-lg -translate-y-0 gap-0 border-0 bg-transparent px-4 py-0 shadow-none sm:rounded-none",
          "data-[state=closed]:animate-none data-[state=open]:animate-none",
          "[&>button:last-child]:hidden",
        ])}
        onPointerDownOutside={(event) => {
          const target = event.detail.originalEvent.target;
          if (
            target instanceof Element &&
            target.closest("[data-open-note-dialog-drag-region]")
          ) {
            event.preventDefault();
          }
        }}
      >
        <DialogTitle className="sr-only">
          {/* Fork: says "settings", the app's own word; "pages" is used
              nowhere else (NN/g #2). */}
          <Trans>Search notes and settings</Trans>
        </DialogTitle>
        {/* Fork: a raised popover surface, flat, no drop shadow
            (journey-after P3 "⌘K search"; design-system Dialogs, Shape). */}
        <div
          className={cn([
            // Fork: the house dialog surface in dark, 16% gray, lighter than
            // the window (design-system.md Dialogs; Apple HIG, Dark Mode).
            "border-border bg-popover rounded-2xl border dark:bg-[hsl(0_0%_16%)]!",
            "overflow-hidden",
          ])}
        >
          <CommandPrimitive
            shouldFilter={false}
            value={selectedValue}
            onValueChange={setSelectedValue}
            className="flex flex-col"
          >
            <div className="border-border/60 flex items-center gap-3 border-b px-4 py-3">
              <MagnifyingGlass className="text-muted-foreground h-4 w-4 shrink-0" />
              <CommandPrimitive.Input
                ref={focusInput}
                value={query}
                onValueChange={setQuery}
                // Fork: names what it finds in the app's words (NN/g #2).
                placeholder={t`Search notes and settings`}
                className={cn([
                  "flex-1 bg-transparent text-sm",
                  "placeholder:text-muted-foreground outline-hidden",
                ])}
              />
              {/* Fork: a 24 px target (WCAG 2.2 SC 2.5.8). */}
              <button
                type="button"
                aria-label={t`Close`}
                onClick={() => handleOpenChange(false)}
                className={cn([
                  // Fork: -mr-[5px] ends the X on the magnifier's mirror inset
                  // and the results column; with no resting fill it sat 6.5 pt
                  // further in (picture review, Oct 9; Apple HIG, Layout).
                  "-mr-[5px] size-6 shrink-0 rounded-full",
                  "flex items-center justify-center",
                  // Fork: no resting fill, as every other icon button; in dark
                  // the fill sat darker than the palette (picture review,
                  // Oct 9; Apple HIG, Dark Mode).
                  "hover:bg-accent hover:text-foreground",
                  "text-muted-foreground text-xs",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-hidden",
                  "transition-colors",
                ])}
              >
                <X className="size-3.5" />
              </button>
            </div>

            {/* Fork: no scroll bar at rest, as macOS overlay scroll bars, and
                an 8 pt inset, so a row's icon and text line up with the
                search icon and query above, and the selection sits 8 pt from
                both edges; a part row at the bottom fades, so it reads as
                more below (picture review, Oct 6 to 8; Apple HIG, Scroll
                views, Layout). */}
            <CommandPrimitive.List
              ref={listRef}
              className="scrollbar-hide scroll-fade-y max-h-80 overflow-y-auto p-2"
            >
              {!hasAnyResults ? (
                <CommandPrimitive.Empty className="text-muted-foreground py-6 text-center text-sm">
                  {isSearchPending ? (
                    <Trans>Searching notes…</Trans>
                  ) : failedQuery === trimmedQuery ? (
                    // Fork: a failed search said no notes matched (task
                    // test, Oct 8; NN/g #9).
                    <Trans>Couldn't search your notes. Try again.</Trans>
                  ) : (
                    <Trans>
                      No notes match “{trimmedQuery}”. Try fewer words.
                    </Trans>
                  )}
                </CommandPrimitive.Empty>
              ) : (
                <>
                  {isQueryEmpty ? null : pageGroup}

                  {filteredRecentSessions.length > 0 && (
                    <CommandPrimitive.Group
                      className={
                        filteredOtherNotes.length > 0 ||
                        (isQueryEmpty && filteredPages.length > 0)
                          ? "pb-1.5"
                          : ""
                      }
                      heading={
                        <div className="flex flex-col gap-1.5">
                          {!isQueryEmpty && filteredPages.length > 0 && (
                            <div className="bg-accent mx-2 mt-1.5 h-px" />
                          )}
                          <div className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
                            <Trans>Recent</Trans>
                          </div>
                        </div>
                      }
                    >
                      {filteredRecentSessions.map((session) => (
                        <CommandPrimitive.Item
                          key={`recent-${session.id}`}
                          value={`recent-${session.id}`}
                          onSelect={() => handleSelect(session)}
                          className={cn([
                            "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5",
                            "text-foreground text-sm",
                            "data-[selected=true]:bg-sidebar-accent data-[selected=true]:text-foreground dark:data-[selected=true]:bg-[hsl(0_0%_22%)]",
                            "transition-colors",
                          ])}
                        >
                          <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
                          <span className="truncate">
                            <MatchText text={session.title} query={query} />
                          </span>
                        </CommandPrimitive.Item>
                      ))}
                    </CommandPrimitive.Group>
                  )}

                  {isQueryEmpty ? pageGroup : null}

                  {filteredOtherNotes.length > 0 && (
                    <CommandPrimitive.Group
                      heading={
                        <div className="flex flex-col gap-1.5">
                          {(filteredPages.length > 0 ||
                            filteredRecentSessions.length > 0) && (
                            <div className="bg-accent mx-2 mt-1.5 h-px" />
                          )}
                          <div className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
                            <Trans>All notes</Trans>
                          </div>
                        </div>
                      }
                    >
                      {filteredOtherNotes.map((note) => (
                        <CommandPrimitive.Item
                          key={`${note.resourceType}-${note.id}`}
                          value={`${note.resourceType}-${note.id}`}
                          onSelect={() => handleSelect(note)}
                          className={cn([
                            "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5",
                            "text-foreground text-sm",
                            "data-[selected=true]:bg-sidebar-accent data-[selected=true]:text-foreground dark:data-[selected=true]:bg-[hsl(0_0%_22%)]",
                            "transition-colors",
                          ])}
                        >
                          {note.resourceType === "shared_session" ? (
                            <Users
                              className="text-muted-foreground h-4 w-4 shrink-0"
                              data-testid="shared-note-icon"
                            />
                          ) : (
                            <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
                          )}
                          <span className="truncate">
                            <MatchText text={note.title} query={query} />
                          </span>
                        </CommandPrimitive.Item>
                      ))}
                    </CommandPrimitive.Group>
                  )}

                  {contentResults.length > 0 && (
                    <CommandPrimitive.Group
                      heading={
                        <div className="flex flex-col gap-1.5">
                          {(filteredPages.length > 0 ||
                            filteredRecentSessions.length > 0 ||
                            filteredOtherNotes.length > 0) && (
                            <div className="bg-accent mx-2 mt-1.5 h-px" />
                          )}
                          <div className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
                            <Trans>In notes</Trans>
                          </div>
                        </div>
                      }
                    >
                      {contentResults.map(({ note, snippet }) => (
                        <CommandPrimitive.Item
                          key={`content-${note.id}`}
                          value={`content-${note.id}`}
                          onSelect={() => handleSelect(note)}
                          className={cn([
                            "flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5",
                            "text-foreground text-sm",
                            "data-[selected=true]:bg-sidebar-accent data-[selected=true]:text-foreground dark:data-[selected=true]:bg-[hsl(0_0%_22%)]",
                            "transition-colors",
                          ])}
                        >
                          <FileText className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate">
                              <MatchText text={note.title} query={query} />
                            </span>
                            {snippet ? (
                              <span
                                className="text-muted-foreground line-clamp-2 text-xs"
                                data-testid="content-snippet"
                              >
                                <MatchText text={snippet} query={query} />
                              </span>
                            ) : null}
                          </span>
                        </CommandPrimitive.Item>
                      ))}
                    </CommandPrimitive.Group>
                  )}
                </>
              )}
            </CommandPrimitive.List>
          </CommandPrimitive>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function buildSnippet(content: string, query: string): string {
  const text = extractPlainText(content).replace(/\s+/g, " ").trim();
  if (!text) return "";

  const lowerText = text.toLowerCase();
  const terms = [
    query.trim().toLowerCase(),
    ...query.toLowerCase().split(/\s+/),
  ].filter((term) => term.length >= CONTENT_SEARCH_MIN_CHARS);
  let matchIndex = -1;
  for (const term of terms) {
    matchIndex = lowerText.indexOf(term);
    if (matchIndex !== -1) break;
  }

  const start = Math.max(0, matchIndex - SNIPPET_BEFORE_CHARS);
  const end = Math.min(text.length, start + SNIPPET_MAX_CHARS);
  const fragment = text.slice(start, end).trim();

  return `${start > 0 ? "…" : ""}${fragment}${end < text.length ? "…" : ""}`;
}

// Fork: the words you typed show in semibold primary text in each result,
// so you can see why it matched, as Mail and Notes mark search matches
// (NN/g, search results: highlight the query terms).
function MatchText({ text, query }: { text: string; query: string }) {
  const terms = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (terms.length === 0) return <>{text}</>;
  // Only matches that start a word, as Spotlight marks them, so "ai" is not
  // marked inside "said" (picture review, Oct 8).
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(${terms.join("|")})`, "giu");
  return (
    <>
      {text.split(pattern).map((part, index) =>
        index % 2 === 1 && part ? (
          <span key={index} className="text-foreground font-semibold">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
