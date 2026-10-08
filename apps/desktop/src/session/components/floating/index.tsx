import { useLingui } from "@lingui/react/macro";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";

import {
  CaretDown,
  Envelope,
  Sparkle,
  TextAlignLeft,
} from "@anlg/ui/components/icons";
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

import { ChatModelMenu } from "~/chat/components/input/model-menu";
import { queueChatPrompt } from "~/chat/pending-prompt";
import { useShell } from "~/contexts/shell";
import { isWelcomeNoteEvent } from "~/onboarding/welcome-note.constants";
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
  const sessionRecord = useSession(sessionId);
  const rawNote = sessionRecord?.raw_md;
  const canResume = useCanResumeRecording(sessionId);
  // Fork: Resume shows after Stop when there is something to add to
  // (journey-meeting P1).
  const showResume =
    props.allowListening !== false &&
    canResume &&
    (hasTranscript || Boolean(props.audioExists));
  // Fork: the follow-up email chip needs something to draft from
  // (journey-meeting P3; NN/g #5 error prevention).
  // Fork: and not on the welcome note, a how-to (NN/g #8).
  const canDraftEmail =
    !isWelcomeNoteEvent(sessionRecord?.event_json) &&
    (hasTranscript || hasStoredNoteContent(rawNote));
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
      {/* Fork: note text fades out under the floating bar instead of
          showing through and below it, as on Home (Apple HIG, Scroll views:
          a scroll edge effect behind floating elements). Solid up to the
          bar's top (bottom-4 + h-10 = 56 px), then a 24 px fade above it, so
          a line under the bar softens instead of being cut, and the last
          visible line stays readable. */}
      <div
        aria-hidden
        data-note-bar-fade
        className={cn([
          "from-panel via-panel pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t via-70% to-transparent",
          (floatingChatOpen || barEmpty) && "hidden",
        ])}
      />
      <RecordingBar sessionId={sessionId} holdQuietHint={floatingChatOpen} />
      <div
        data-note-bar-stack
        className={cn([
          // Fork: as wide as the note text column (576 px, 32 px gutters;
          // note-input px-8), so the Ask field takes the leftover width, as
          // in Granola's bar; 16 px above the panel bottom (redline4-oct3;
          // Apple HIG Layout margins).
          "pointer-events-none absolute bottom-4 left-1/2 z-30 flex w-[min(576px,calc(100%-4rem))] -translate-x-1/2 flex-col-reverse items-center",
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
            // Contrast and Dialogs). In dark it is lighter than the page, as
            // the Home composer is (Apple HIG Dark Mode: raised is lighter).
            "border-input bg-card dark:bg-muted shadow-sm dark:shadow-none",
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
  // The notes view the button goes back to: the last one shown, or the first
  // notes view when that one is gone.
  const previous = lastNotesViewRef.current;
  const stillThere =
    previous &&
    editorTabs.some(
      (view) =>
        view.type === previous.type &&
        (view.type !== "enhanced" ||
          (previous.type === "enhanced" && view.id === previous.id)),
    );
  const backTarget = stillThere
    ? previous
    : editorTabs.find((view) => view.type !== "transcript");
  const backToMyNotes = backTarget?.type === "raw";
  const handleClick = () => {
    if (!showingTranscript) {
      onSelectView(transcriptTab);
      return;
    }
    if (backTarget) {
      onSelectView(backTarget);
    }
  };

  // Fork: a real tooltip naming the action, since the bars icon alone does
  // not say what it does (redline2-oct3, R2; HIG: help tags name the action).
  // Owner review, Oct 3: the icon-only toggle was hard to find, so it shows
  // a visible "Transcript" label (NN/g "Icon Usability": label icons; Apple
  // HIG Buttons: add a label when an icon's meaning isn't obvious). Owner
  // test, Oct 4: on the transcript, a fixed "Transcript" label hid the way
  // back, so the button then names where it goes, "Summary" or "My notes",
  // with the icon the switch above uses. A button whose label changes is a
  // plain button, not a toggle, so it has no aria-pressed (WAI-ARIA APG
  // Button). Under 480 px the label drops to the icon plus tooltip, like
  // Resume.
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-transcript-toggle
            onClick={handleClick}
            className={cn([
              // Fork: a segment inside the one bar, not its own pill
              // (redline3 S3).
              "text-foreground hover:bg-accent inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full px-2.5 text-sm font-medium whitespace-nowrap transition-colors @max-[480px]:gap-0.5",
              // Fork: no ring offset, so the focus ring stays inside the
              // bar instead of crossing its border, like the bar's other
              // buttons (house rule: nothing touches edges; NN/g #4).
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
            ])}
          >
            {isTranscribing ? (
              <Spinner size={16} className="shrink-0" />
            ) : showingTranscript ? (
              backToMyNotes ? (
                <TextAlignLeft aria-hidden className="size-4 shrink-0" />
              ) : (
                <Sparkle aria-hidden className="size-4 shrink-0" />
              )
            ) : (
              // Fork: Lucide AudioLines, the bars Granola's toggle shows
              // (redline-oct3, H2).
              <TranscriptAudioIcon />
            )}
            <span className="@max-[480px]:sr-only">
              {showingTranscript
                ? backToMyNotes
                  ? t`My notes`
                  : t`Summary`
                : t`Transcript`}
            </span>
            {!showingTranscript && (
              <CaretDown aria-hidden className="size-3 rotate-180" />
            )}
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
          // Fork: -ml-1 mr-1 centers the divider between the button's
          // label and the field's text, about 11.5 pt each side (picture
          // review, Oct 8: 15 and 8 pt; Apple HIG, Layout).
          className="bg-border -ml-1 mr-1 h-5 w-px shrink-0"
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
        className="placeholder:text-muted-foreground text-foreground h-full min-w-[5rem] flex-1 bg-transparent text-sm focus:outline-none"
      />
      {/* Fork: in the 576 px note bar, ⌘ J hides below 28rem and the Draft
          chip below 21rem, so nothing spills out of the bar (in-app probe,
          Oct 6). `!` because @anlg/ui's later stylesheet re-shows them with
          its own inline-flex. */}
      <Kbd className="shrink-0 @max-[28rem]/ask:hidden!">
        {kbdLabel(["mod", "J"])}
      </Kbd>
      {/* Fork: pick the model before you type, as on Home, in the chat, and
          in Granola's Ask bar (owner test, Oct 4). It outlasts the ⌘J hint
          as the field narrows. */}
      <span data-note-ask-model className="shrink-0 @max-[17rem]/ask:hidden">
        <ChatModelMenu compact />
      </span>
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
            // Fork: below 21rem the chip hides instead of dropping to a bare
            // envelope, which read as a send button beside the field
            // (picture review, Oct 6; NN/g "Icon Usability"). Chat's
            // recipes keep the same prompt one click away.
            className={cn([barChipClassName, "@max-[21rem]/ask:hidden!"])}
          >
            <Envelope aria-hidden className="text-muted-foreground size-3.5" />
            <span className="truncate">{label}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
