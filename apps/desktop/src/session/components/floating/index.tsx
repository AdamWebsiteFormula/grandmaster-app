import { useLingui } from "@lingui/react/macro";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";

import { CaretDown, Envelope, Globe } from "@anlg/ui/components/icons";
import { Kbd } from "@anlg/ui/components/ui/kbd";
import { Spinner } from "@anlg/ui/components/ui/spinner";
import { cn } from "@anlg/utils";

import { RecordingBar } from "./recording-bar";
import { setSessionFabSelectionHost } from "./selection-slot";

import { queueChatPrompt } from "~/chat/pending-prompt";
import { useShell } from "~/contexts/shell";
import { TranscriptAudioIcon } from "~/session/components/note-input/header-transcript-icon";
import { getBaseLanguageDisplayName } from "~/settings/general/language";
import { useConfigValue } from "~/shared/config";
import { useTabs } from "~/store/zustand/tabs";
import type { EditorView, Tab } from "~/store/zustand/tabs/schema";
import { useListener } from "~/stt/contexts";

// Fork: Granola's note has one bottom bar: a round transcript toggle, a wide
// chat field, and a "Write follow up email" chip at its end
// (granola-compare-oct3 §1, P1). It replaces a 150 px slot that clipped
// "Ask anything" to "Ask anythi…".
export function FloatingActionButton(props: {
  allowListening?: boolean;
  audioExists?: boolean;
  currentView: EditorView;
  editorTabs?: EditorView[];
  onSelectView?: (view: EditorView) => void;
  isTranscribing?: boolean;
  skipReason?: string | null;
  tab: Extract<Tab, { type: "sessions" }>;
}) {
  const recordingBarShown = useListener(
    (state) => state.getSessionMode(props.tab.id) !== "inactive",
  );
  const { chat } = useShell();
  const isChatOpen = chat.mode !== "FloatingClosed";

  return (
    <>
      <RecordingBar sessionId={props.tab.id} />
      <div
        data-note-bar-stack
        className={cn([
          "pointer-events-none absolute bottom-3 left-1/2 z-30 flex w-[min(520px,calc(100%-2rem))] -translate-x-1/2 flex-col-reverse items-center",
          // The recording bar sits bottom left, so while it shows the note
          // bar moves to the bottom right and narrows beside it.
          recordingBarShown &&
            "right-4 left-auto w-[min(360px,calc(100%-2rem))] translate-x-0",
        ])}
      >
        <div
          data-note-bar
          className={cn([
            "peer/session-fab pointer-events-auto relative flex h-11 w-full max-w-full items-center gap-2",
            // Fork: the recording bar and the note bar overlap in a narrow note pane, so the bar hides there while recording (ux-audit-oct3 C, WCAG 1.4.10).
            recordingBarShown && "@max-[760px]:hidden",
            isChatOpen && "hidden",
          ])}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key="note-bar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex h-full w-full min-w-0 items-center gap-2"
            >
              <TranscriptToggle
                currentView={props.currentView}
                editorTabs={props.editorTabs ?? []}
                onSelectView={props.onSelectView}
                isTranscribing={props.isTranscribing ?? false}
              />
              <NoteAskField
                trailing={
                  props.currentView.type === "transcript" ? (
                    <TranscriptLanguageChip />
                  ) : (
                    <FollowUpEmailChip />
                  )
                }
              />
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

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={showingTranscript}
      title={label}
      onClick={handleClick}
      className={cn([
        "border-input bg-popover text-foreground hover:bg-accent inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-0.5 rounded-full border px-2.5 transition-colors",
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
      <CaretDown
        aria-hidden
        className={cn([
          "size-3 transition-transform",
          !showingTranscript && "rotate-180",
        ])}
      />
    </button>
  );
}

function NoteAskField({ trailing }: { trailing?: React.ReactNode }) {
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
        "border-input bg-popover flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border pr-1.5 pl-4",
        "focus-within:ring-ring focus-within:ring-offset-background focus-within:ring-2 focus-within:ring-offset-2",
      ])}
    >
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        aria-keyshortcuts="Meta+J"
        className="placeholder:text-muted-foreground text-foreground h-full min-w-[6.5rem] flex-1 bg-transparent text-sm focus:outline-none"
      />
      <Kbd className="shrink-0 @max-[560px]:hidden">⌘ J</Kbd>
      {trailing}
    </form>
  );
}

const barChipClassName = cn([
  "border-border text-foreground hover:bg-accent inline-flex h-7 max-w-full min-w-0 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-xs whitespace-nowrap transition-colors",
  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
]);

// Same prompt as the chat's "Draft follow-up email" starter, so both read
// the same in every language.
function FollowUpEmailChip() {
  const { t } = useLingui();
  const { chat } = useShell();
  const label = t`Draft follow-up email`;

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        queueChatPrompt(t`Draft a follow-up email to the participants`);
        chat.sendEvent({ type: "OPEN" });
      }}
      className={barChipClassName}
    >
      <Envelope aria-hidden className="text-muted-foreground size-3.5" />
      <span className="truncate @max-[420px]:sr-only">{label}</span>
    </button>
  );
}

// Fork: Granola shows the spoken language in the transcript footer. Upshot
// reads it from Settings > General and links there; transcription itself is
// untouched (granola-compare-oct3 §2, P3).
function TranscriptLanguageChip() {
  const { t } = useLingui();
  const openNew = useTabs((state) => state.openNew);
  const mainLanguage = useConfigValue("ai_language");
  const spokenLanguages = useConfigValue("spoken_languages");
  const extraCount = parseLanguageList(spokenLanguages).filter(
    (code) => code && code !== mainLanguage,
  ).length;
  const name = mainLanguage ? getBaseLanguageDisplayName(mainLanguage) : "";
  if (!name) {
    return null;
  }
  const label = extraCount > 0 ? `${name} +${extraCount}` : name;

  return (
    <button
      type="button"
      title={t`Spoken language. Change it in Settings › General.`}
      onClick={() => openNew({ type: "settings", state: { tab: "app" } })}
      className={barChipClassName}
    >
      <Globe aria-hidden className="text-muted-foreground size-3.5" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function parseLanguageList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}
