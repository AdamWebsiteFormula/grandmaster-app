import { useLingui } from "@lingui/react/macro";

import {
  CheckCircle,
  Copy,
  Globe,
  MagnifyingGlass,
  PencilSimple,
} from "@anlg/ui/components/icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@anlg/ui/components/ui/popover";
import { cn } from "@anlg/utils";

import { useCopyTranscript } from "./header-transcript";
import { useSearch } from "./search/context";

import { useHasTranscript } from "~/session/components/shared";
import {
  CORE_TRANSCRIPTION_LANGUAGE_CODES,
  getAdditionalSpokenLanguages,
  getBaseLanguageDisplayName,
} from "~/settings/general/language";
import { MainLanguageView } from "~/settings/general/main-language";
import { useSetSettingValues } from "~/settings/queries";
import { useConfigValue } from "~/shared/config";
import { ariaKeyShortcut, shortcutLabel } from "~/shared/shortcut-label";
import type { EditorView } from "~/store/zustand/tabs/schema";
import { useListener } from "~/stt/contexts";

const toolbarButtonClassName = cn([
  "text-muted-foreground hover:bg-accent hover:text-foreground inline-flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors",
  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
  "aria-pressed:bg-accent aria-pressed:text-foreground",
]);

// Fork: a small switch with a quiet selected pill: the page background with
// a field border (3:1 or more on the track, WCAG 2.2 SC 1.4.11), not a solid
// white pill (redline2-oct3, R2).
const segmentClassName = cn([
  "inline-flex h-6 cursor-pointer items-center rounded-full px-2 text-xs font-medium transition-colors",
  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
]);

const languageChipClassName = cn([
  "text-muted-foreground hover:bg-accent hover:text-foreground inline-flex h-7 max-w-40 min-w-0 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-xs whitespace-nowrap transition-colors",
  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
]);

// Fork: one h-8 row under the audio player. On the left a Summary /
// Transcript switch, so the way back to the summary is always in view; on
// the right language, search, edit and copy together (redline-oct3, H2; Granola's
// transcript bar keeps its tools in one slim row, granola-compare-oct3 §2).
export function TranscriptToolbar({
  sessionId,
  editMode,
  onEditModeChange,
  editorTabs = [],
  onSelectView,
}: {
  sessionId: string;
  editMode: boolean;
  onEditModeChange?: (editMode: boolean) => void;
  editorTabs?: EditorView[];
  onSelectView?: (view: EditorView) => void;
}) {
  const { t } = useLingui();
  const search = useSearch();
  const hasTranscript = useHasTranscript(sessionId);
  const sessionMode = useListener((state) => state.getSessionMode(sessionId));
  const { canCopyTranscript, copyTranscript } = useCopyTranscript(sessionId);
  const canEdit =
    sessionMode === "inactive" && hasTranscript && Boolean(onEditModeChange);
  const searchLabel = t`Search transcript`;
  const copyLabel = t`Copy transcript`;
  const editLabel = editMode ? t`Done editing` : t`Edit transcript`;
  const notesView =
    editorTabs.find((view) => view.type === "enhanced") ??
    editorTabs.find((view) => view.type !== "transcript");

  return (
    <div
      role="toolbar"
      aria-label={t`Transcript`}
      data-transcript-toolbar
      className="mx-auto mb-2 flex h-8 w-full max-w-[680px] shrink-0 items-center gap-1"
    >
      {notesView && onSelectView ? (
        <div
          role="group"
          aria-label={t`View`}
          data-transcript-view-switch
          // Fork: a white track in light, so the switch reads as a control on
          // the 96% panel, while the selected pill keeps its 3:1 edge (Apple
          // HIG, Segmented controls; WCAG 2.2 SC 1.4.11).
          className="bg-card dark:bg-muted inline-flex h-7 items-center gap-0.5 rounded-full p-0.5"
        >
          <button
            type="button"
            aria-pressed={false}
            onClick={() => onSelectView(notesView)}
            className={cn([
              segmentClassName,
              "text-muted-foreground hover:text-foreground",
            ])}
          >
            {notesView.type === "enhanced" ? t`Summary` : t`Notes`}
          </button>
          <button
            type="button"
            aria-pressed
            className={cn([
              segmentClassName,
              "bg-background text-foreground ring-input ring-1 ring-inset",
            ])}
          >
            {t`Transcript`}
          </button>
        </div>
      ) : null}
      <div className="flex-1" />
      {/* Fork: Resume lives in the note's bottom bar (redline3 S3), so the
          toolbar no longer repeats it. */}
      <TranscriptLanguageChip />
      {search ? (
        <button
          type="button"
          aria-label={searchLabel}
          // Fork: ⌘F on a Mac, Ctrl+F elsewhere (Microsoft Writing Style
          // Guide, Keys and keyboard shortcuts).
          title={`${searchLabel} (${shortcutLabel(["mod", "F"])})`}
          aria-keyshortcuts={ariaKeyShortcut(["mod", "F"])}
          onClick={() => search.open()}
          className={toolbarButtonClassName}
        >
          <MagnifyingGlass aria-hidden className="size-4" />
        </button>
      ) : null}
      {canEdit ? (
        <button
          type="button"
          aria-label={editLabel}
          aria-pressed={editMode}
          title={editLabel}
          onClick={() => onEditModeChange?.(!editMode)}
          className={toolbarButtonClassName}
        >
          {editMode ? (
            <CheckCircle aria-hidden className="size-4" />
          ) : (
            <PencilSimple aria-hidden className="size-4" />
          )}
        </button>
      ) : null}
      {canCopyTranscript ? (
        <button
          type="button"
          aria-label={copyLabel}
          title={copyLabel}
          onClick={() => {
            void copyTranscript();
          }}
          className={toolbarButtonClassName}
        >
          <Copy aria-hidden className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

// Fork: the spoken language, picked in place in a small popover with the
// same select as Settings › General, so the live note stays open (Granola
// screen 06: language picker inline in the transcript footer;
// journey-meeting P3). Transcription itself is untouched; a change applies
// to the next recording and summary.
function TranscriptLanguageChip() {
  const { t } = useLingui();
  const setSettingValues = useSetSettingValues();
  const mainLanguage = useConfigValue("ai_language");
  const spokenLanguages = useConfigValue("spoken_languages");
  const extraLanguages = parseLanguageList(spokenLanguages);
  const extraCount = extraLanguages.filter(
    (code) => code && code !== mainLanguage,
  ).length;
  const name = mainLanguage ? getBaseLanguageDisplayName(mainLanguage) : "";
  if (!name) {
    return null;
  }
  const label = extraCount > 0 ? `${name} +${extraCount}` : name;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={t`Spoken language`}
          className={languageChipClassName}
        >
          <Globe aria-hidden className="text-muted-foreground size-3.5" />
          <span className="truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        data-transcript-language-popover
        className="w-80 p-4"
      >
        <MainLanguageView
          stacked
          value={mainLanguage}
          supportedLanguages={CORE_TRANSCRIPTION_LANGUAGE_CODES}
          onChange={(value) =>
            setSettingValues({
              ai_language: value,
              spoken_languages: JSON.stringify(
                getAdditionalSpokenLanguages(value, extraLanguages),
              ),
            })
          }
        />
      </PopoverContent>
    </Popover>
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
