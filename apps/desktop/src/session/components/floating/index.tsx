import { useLingui } from "@lingui/react/macro";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";

import { CaretDown, Envelope } from "@anlg/ui/components/icons";
import { Kbd } from "@anlg/ui/components/ui/kbd";
import { Spinner } from "@anlg/ui/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@anlg/ui/components/ui/tooltip";
import { cn } from "@anlg/utils";

import { RecordingBar } from "./recording-bar";
import { setSessionFabSelectionHost } from "./selection-slot";

import { queueChatPrompt } from "~/chat/pending-prompt";
import { useShell } from "~/contexts/shell";
import { TranscriptAudioIcon } from "~/session/components/note-input/header-transcript-icon";
import {
  ResumeRecordingButton,
  useCanResumeRecording,
} from "~/session/components/resume-recording";
import {
  hasStoredNoteContent,
  useHasTranscript,
} from "~/session/components/shared";
import { useSession } from "~/session/queries";
import { ariaKeyShortcut, kbdLabel } from "~/shared/shortcut-label";
import type { EditorView, Tab } from "~/store/zustand/tabs/schema";
import { useListener } from "~/stt/contexts";

// Fork: Granola's note has one bottom bar: a round transcript toggle, a wide
// chat field, and a "Write follow up email" chip at its end
// (granola-compare-oct3 §1, P1). It replaces a 150 px slot that clipped
// "Ask anything" to "Ask anythi…". Redline3 S3: one centered pill holds the
// toggle, Resume (after Stop), the Ask field and the chip; the separate
// far-left Resume pill is gone (Granola screen 04; Apple HIG Toolbars: group
// related controls in one bar).
export function FloatingActionButton(props: {
  allowListening?: boolean;
  audioExists?: boolean;
  currentView: EditorView;
  editorTabs?: EditorView[];
  onSelectView?: (view: EditorView) => void;
  isTranscribing?: boolean;
  tab: Extract<Tab, { type: "sessions" }>;
}) {
  const sessionId = props.tab.id;
  const recordingBarShown = useListener(
    (state) => state.getSessionMode(sessionId) !== "inactive",
  );
  const hasTranscript = useHasTranscript(sessionId);
  const rawNote = useSession(sessionId)?.raw_md;
  const canResume = useCanResumeRecording(sessionId);
  // Fork: Resume shows after Stop when there is something to add to
  // (journey-meeting P1).
  const showResume =
    props.allowListening !== false &&
    canResume &&
    (hasTranscript || Boolean(props.audioExists));
  // Fork: the follow-up email chip needs something to draft from
  // (journey-meeting P3; NN/g #5 error prevention).
  const canDraftEmail = hasTranscript || hasStoredNoteContent(rawNote);
  const { chat } = useShell();
  // Fork: the floating chat covers the bottom of the note, so the bar hides
  // while it is open and returns when chat closes; ⋯ › Recording keeps
  // Resume reachable (NN/g #4 consistency; Apple HIG: never truncate a
  // button label).
  const floatingChatOpen = chat.mode === "FloatingOpen";
  // With the chat in the right panel the Ask field would repeat it, so the
  // bar keeps only the transcript toggle and Resume.
  const showAsk = chat.mode === "FloatingClosed";
  const hasToggle = Boolean(
    props.onSelectView &&
    props.editorTabs?.some((view) => view.type === "transcript"),
  );
  const barEmpty = !showAsk && !hasToggle && !showResume;

  return (
    <>
      <RecordingBar sessionId={sessionId} />
      <div
        data-note-bar-stack
        className={cn([
          // Fork: as wide as the note text column (680 px, 32 px gutters;
          // note-input px-8), so the Ask field takes the leftover width, as
          // in Granola's bar; 16 px above the panel bottom (redline4-oct3;
          // Apple HIG Layout margins).
          "pointer-events-none absolute bottom-4 left-1/2 z-30 flex w-[min(680px,calc(100%-4rem))] -translate-x-1/2 flex-col-reverse items-center",
          !showAsk && "w-auto",
          // The recording bar sits bottom left, so while it shows the note
          // bar moves to the bottom right and narrows beside it, leaving
          // the timer, meters and Stop uncovered.
          recordingBarShown &&
            "right-4 left-auto w-[min(360px,calc(100%-2rem))] translate-x-0",
          // Fork: in a narrow pane only the Ask field gives way, so the
          // transcript toggle stays beside the recording bar
          // (journey-meeting P2; WCAG 2.2 SC 1.4.10 Reflow).
          recordingBarShown && "@max-[760px]:w-auto",
          recordingBarShown && !showAsk && "w-auto",
        ])}
      >
        <div
          data-note-bar
          className={cn([
            "peer/session-fab pointer-events-auto relative flex h-10 w-full max-w-full items-center gap-1 rounded-full border px-1",
            // Fork: opaque card pill with a field border (it holds a text
            // field); soft shadow in light, none on black (design-system.md
            // Contrast and Dialogs).
            "border-input bg-card shadow-sm dark:shadow-none",
            "ring-offset-background has-[input:focus]:ring-ring has-[input:focus]:ring-2 has-[input:focus]:ring-offset-2",
            (floatingChatOpen || barEmpty) && "hidden",
          ])}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key="note-bar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex h-full w-full min-w-0 items-center gap-1"
            >
              <TranscriptToggle
                currentView={props.currentView}
                editorTabs={props.editorTabs ?? []}
                onSelectView={props.onSelectView}
                isTranscribing={props.isTranscribing ?? false}
              />
              {/* Fork: after Stop, Resume sits beside the toggle in the same
                  bar (redline3 S3; Granola docs "How transcription works":
                  resume adds to the same transcript). It calls the existing
                  start path; no engine change. */}
              {showResume ? (
                <ResumeRecordingButton sessionId={sessionId} variant="bar" />
              ) : null}
              {/* Fork: the bar is the same on Summary and Transcript; the
                  language chip lives in the transcript toolbar
                  (redline2-oct3, R2). */}
              {showAsk ? (
                <NoteAskField
                  hideWhenNarrow={recordingBarShown}
                  separated={hasToggle || showResume}
                  trailing={canDraftEmail ? <FollowUpEmailChip /> : null}
                />
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
        <div
          ref={setSessionFabSelectionHost}
          data-session-fab-selection
          className={cn([
            "pointer-events-auto z-10 mb-2",
            "origin-bottom transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
            "translate-y-8 dark:translate-y-7",
            "peer-focus-within/session-fab:translate-y-0 peer-hover/session-fab:translate-y-0",
            "dark:peer-focus-within/session-fab:translate-y-0 dark:peer-hover/session-fab:translate-y-0",
          ])}
        />
      </div>
    </>
  );
}

function TranscriptToggle({
  currentView,
  editorTabs,
  onSelectView,
  isTranscribing,
}: {
  currentView: EditorView;
  editorTabs: EditorView[];
  onSelectView?: (view: EditorView) => void;
  isTranscribing: boolean;
}) {
  const { t } = useLingui();
  const lastNotesViewRef = useRef<EditorView | null>(null);
  if (currentView.type !== "transcript") {
    lastNotesViewRef.current = currentView;
  }
  const transcriptTab = editorTabs.find((view) => view.type === "transcript");
  if (!transcriptTab || !onSelectView) {
    return null;
  }

  const showingTranscript = currentView.type === "transcript";
  const label = showingTranscript ? t`Hide transcript` : t`Show transcript`;
  const handleClick = () => {
    if (!showingTranscript) {
      onSelectView(transcriptTab);
      return;
    }
    const previous = lastNotesViewRef.current;
    const stillThere =
      previous &&
      editorTabs.some(
        (view) =>
          view.type === previous.type &&
          (view.type !== "enhanced" ||
            (previous.type === "enhanced" && view.id === previous.id)),
      );
    const fallback = editorTabs.find((view) => view.type !== "transcript");
    const target = stillThere ? previous : fallback;
    if (target) {
      onSelectView(target);
    }
  };

  // Fork: a real tooltip naming the action, since the bars icon alone does
  // not say what it does (redline2-oct3, R2; HIG: help tags name the action).
  // Owner review, Oct 3: the icon-only toggle was hard to find, so it shows
  // a visible "Transcript" label (NN/g "Icon Usability": label icons; Apple
  // HIG Buttons: add a label when an icon's meaning isn't obvious). The name
  // stays "Transcript" and aria-pressed carries the state (WAI-ARIA APG
  // Button: a toggle's label does not change with its state). Under 480 px
  // the label drops to the icon plus tooltip, like Resume.
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-transcript-toggle
            aria-pressed={showingTranscript}
            onClick={handleClick}
            className={cn([
              // Fork: a segment inside the one bar, not its own pill
              // (redline3 S3).
              "text-foreground hover:bg-accent inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full px-2.5 text-sm font-medium whitespace-nowrap transition-colors @max-[480px]:gap-0.5",
              "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
              showingTranscript && "bg-accent",
            ])}
          >
            {isTranscribing ? (
              <Spinner size={16} className="shrink-0" />
            ) : (
              // Fork: Lucide AudioLines, the bars Granola's toggle shows
              // (redline-oct3, H2).
              <TranscriptAudioIcon />
            )}
            <span className="@max-[480px]:sr-only">{t`Transcript`}</span>
            <CaretDown
              aria-hidden
              className={cn([
                "size-3 transition-transform",
                !showingTranscript && "rotate-180",
              ])}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function NoteAskField({
  hideWhenNarrow = false,
  separated = false,
  trailing,
}: {
  hideWhenNarrow?: boolean;
  separated?: boolean;
  trailing?: React.ReactNode;
}) {
  const { t } = useLingui();
  const { chat } = useShell();
  const [value, setValue] = useState("");
  const placeholder = t`Ask anything`;

  const submit = () => {
    const prompt = value.trim();
    if (prompt) {
      queueChatPrompt(prompt);
      setValue("");
    }
    chat.sendEvent({ type: "OPEN" });
  };

  return (
    <form
      data-note-ask
      role="search"
      aria-label={t`Ask about this note`}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className={cn([
        // Fork: the field fills the rest of the one bar (redline3 S3); the
        // bar draws the border, shadow and focus ring.
        "flex h-full min-w-0 flex-1 items-center gap-2",
        !separated && "pl-3",
        // Fork: the field is its own container, so ⌘ J hides first and the
        // chip then drops to its icon as the field narrows (beside Resume,
        // or a ~720 px window), never clipping (WCAG 2.2 SC 1.4.10 Reflow;
        // Apple HIG Toolbars: icon-only items keep a help tag).
        "@container/ask",
        hideWhenNarrow && "@max-[760px]:hidden",
      ])}
    >
      {separated ? (
        <span
          aria-hidden
          data-note-bar-divider
          className="bg-border h-5 w-px shrink-0"
        />
      ) : null}
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        // Fork: ⌘ J on a Mac, Ctrl+J elsewhere (Apple HIG, Keyboards;
        // Microsoft Writing Style Guide, Keys and keyboard shortcuts).
        aria-keyshortcuts={ariaKeyShortcut(["mod", "J"])}
        className="placeholder:text-muted-foreground text-foreground h-full min-w-[6.5rem] flex-1 bg-transparent text-sm focus:outline-none"
      />
      <Kbd className="shrink-0 @max-[22rem]/ask:hidden">
        {kbdLabel(["mod", "J"])}
      </Kbd>
      {trailing}
    </form>
  );
}

const barChipClassName = cn([
  "border-border text-foreground hover:bg-accent inline-flex h-7 max-w-full min-w-0 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-xs whitespace-nowrap transition-colors",
  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
]);

// Same prompt as the chat's "Draft follow-up email" starter, so both read
// the same in every language. The label shows while the field has room and
// drops to the icon only in a narrow field, where the tooltip names it
// (redline3 S3; Apple HIG Toolbars).
function FollowUpEmailChip() {
  const { t } = useLingui();
  const { chat } = useShell();
  const label = t`Draft follow-up email`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            onClick={() => {
              queueChatPrompt(t`Draft a follow-up email to the participants`);
              chat.sendEvent({ type: "OPEN" });
            }}
            className={barChipClassName}
          >
            <Envelope aria-hidden className="text-muted-foreground size-3.5" />
            <span className="truncate @max-[19rem]/ask:sr-only">{label}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
