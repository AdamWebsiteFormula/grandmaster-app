import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { downloadDir, join } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/plugin-dialog";
import { format as formatDateFns } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";

import { json2md } from "@anlg/editor/markdown";
import { commands as analyticsCommands } from "@anlg/plugin-analytics";
import {
  commands as exportCommands,
  type ExportMetadata,
  type TranscriptItem,
} from "@anlg/plugin-export";
import { commands as fs2Commands } from "@anlg/plugin-fs2";
import { commands as openerCommands } from "@anlg/plugin-opener2";
import { Button } from "@anlg/ui/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@anlg/ui/components/ui/dialog";

import { formatDate, formatDuration } from "./export-utils";

import { useTranscriptExportSegments } from "~/session/components/note-input/transcript/export-data";
import {
  useEnhancedNote,
  useEnhancedNoteRecords,
  useSession,
  useSessionParticipants,
} from "~/session/queries";
import { getSessionEvent } from "~/session/utils";
import { getStoredSettingValues } from "~/settings/queries";
import {
  GlassDialogCancelButton,
  GlassDialogContent,
} from "~/shared/ui/glass-dialog";
import type { EditorView } from "~/store/zustand/tabs/schema";
import { useSessionTranscriptMetadata } from "~/stt/queries";

type FileFormat = "pdf" | "txt" | "md" | "org";

function markdownToText(content: string): string {
  return content
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function markdownToOrg(content: string): string {
  return content
    .replace(/^(#{1,6})\s+/gm, (_match, hashes: string) => {
      return `${"*".repeat(hashes.length)} `;
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "[[$2][$1]]")
    .replace(/\*\*(.*?)\*\*/g, "*$1*")
    .replace(/__(.*?)__/g, "*$1*")
    .replace(/`([^`]+)`/g, "~$1~")
    .trim();
}

export function ExportModal({
  sessionId,
  currentView,
  open,
  onOpenChange,
}: {
  sessionId: string;
  currentView: EditorView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLingui();
  const [format, setFormat] = useState<FileFormat>("pdf");
  const [includeMemo, setIncludeMemoState] = useState(false);
  const [includeSummary, setIncludeSummaryState] = useState(true);
  const [includeTranscript, setIncludeTranscript] = useState(false);
  // Once the user ticks a box, the summary-based default stops moving it.
  const includeTouchedRef = useRef(false);
  const setIncludeMemo = (value: boolean) => {
    includeTouchedRef.current = true;
    setIncludeMemoState(value);
  };
  const setIncludeSummary = (value: boolean) => {
    includeTouchedRef.current = true;
    setIncludeSummaryState(value);
  };

  const session = useSession(sessionId);
  const sessionTitle = session?.title;
  const sessionCreatedAt = session?.created_at;
  const event = session ? getSessionEvent(session) : null;
  const eventTitle = event?.title;
  const rawMd = session?.raw_md;

  // Fork: exporting from My notes or Transcript used to drop the summary silently;
  // fall back to the note's first summary (ux-audit-oct3 C, NN/g #5).
  const enhancedNoteRecords = useEnhancedNoteRecords(sessionId);
  const enhancedNoteId =
    currentView.type === "enhanced"
      ? currentView.id
      : (enhancedNoteRecords[0]?.id ?? "");
  const enhancedNoteContent = useEnhancedNote(enhancedNoteId)?.content;
  // Fork: with no summary yet, default to My notes and disable Summary, so an
  // export never "succeeds" with only a title (journey-after P2 "Export, no
  // summary"; NN/g #1, #5).
  const hasSummary = enhancedNoteRecords.length > 0;
  useEffect(() => {
    if (includeTouchedRef.current) return;
    setIncludeSummaryState(hasSummary);
    setIncludeMemoState(!hasSummary);
  }, [hasSummary]);
  const participants = useSessionParticipants(sessionId);

  const participantNames = useMemo(
    () => participants.map((participant) => participant.name).filter(Boolean),
    [participants],
  );

  const { data: transcriptItems, isLoading: isTranscriptLoading } =
    useTranscriptExportSegments(sessionId);

  const transcripts = useSessionTranscriptMetadata(sessionId);

  const transcriptDuration = useMemo((): string | null => {
    if (transcripts.length === 0) {
      return null;
    }

    let minStartedAt: number | null = null;
    let maxEndedAt: number | null = null;

    for (const transcript of transcripts) {
      if (minStartedAt === null || transcript.startedAt < minStartedAt) {
        minStartedAt = transcript.startedAt;
      }
      if (transcript.endedAt !== undefined) {
        if (maxEndedAt === null || transcript.endedAt > maxEndedAt) {
          maxEndedAt = transcript.endedAt;
        }
      }
    }

    if (minStartedAt !== null && maxEndedAt !== null) {
      return formatDuration(minStartedAt, maxEndedAt);
    }
    return null;
  }, [transcripts]);

  const getMemoMd = (): string => {
    if (!rawMd) return "";
    try {
      const parsed = JSON.parse(rawMd);
      return json2md(parsed);
    } catch {
      return "";
    }
  };

  const getSummaryMd = (): string => {
    if (!enhancedNoteContent) return "";
    try {
      const parsed = JSON.parse(enhancedNoteContent);
      return json2md(parsed);
    } catch {
      return "";
    }
  };

  const getTranscriptText = (): string => {
    if (transcriptItems.length === 0) return "";
    return transcriptItems
      .map((item) => {
        const speaker = item.speaker ? `${item.speaker}: ` : "";
        return `${speaker}${item.text}`;
      })
      .join("\n\n");
  };

  const buildMdContent = (): string => {
    const sections: string[] = [];
    const title = sessionTitle || t`Untitled`;
    sections.push(`# ${title}`);

    if (sessionCreatedAt) {
      sections.push(`- ${t`Created`}: ${formatDate(sessionCreatedAt)}`);
    }

    if (participantNames.length > 0) {
      sections.push(`- ${t`Participants`}: ${participantNames.join(", ")}`);
    }

    if (transcriptDuration) {
      sections.push(`- ${t`Duration`}: ${transcriptDuration}`);
    }

    if (includeMemo) {
      const memo = getMemoMd();
      if (memo) {
        sections.push("");
        sections.push(`## ${t`My notes`}`);
        sections.push(memo);
      }
    }

    if (includeSummary) {
      const summary = getSummaryMd();
      if (summary) {
        sections.push("");
        sections.push(`## ${t`Summary`}`);
        sections.push(summary);
      }
    }

    if (includeTranscript) {
      const transcript = getTranscriptText();
      if (transcript) {
        sections.push("");
        sections.push(`## ${t`Transcript`}`);
        sections.push(transcript);
      }
    }

    return sections.join("\n");
  };

  const buildTxtContent = (): string => {
    const sections: string[] = [];
    const title = sessionTitle || t`Untitled`;
    sections.push(title);
    sections.push("=".repeat(title.length));

    if (sessionCreatedAt) {
      sections.push(formatDate(sessionCreatedAt));
    }

    if (participantNames.length > 0) {
      sections.push(`${t`Participants`}: ${participantNames.join(", ")}`);
    }

    if (transcriptDuration) {
      sections.push(`${t`Duration`}: ${transcriptDuration}`);
    }

    if (includeMemo) {
      const memo = getMemoMd();
      if (memo) {
        sections.push("");
        sections.push(t`My notes`);
        sections.push("-".repeat(8));
        sections.push(markdownToText(memo));
      }
    }

    if (includeSummary) {
      const summary = getSummaryMd();
      if (summary) {
        sections.push("");
        sections.push(t`Summary`);
        sections.push("-".repeat(7));
        sections.push(markdownToText(summary));
      }
    }

    if (includeTranscript) {
      const transcript = getTranscriptText();
      if (transcript) {
        sections.push("");
        sections.push(t`Transcript`);
        sections.push("-".repeat(10));
        sections.push(transcript);
      }
    }

    return sections.join("\n");
  };

  const buildOrgContent = (): string => {
    const sections: string[] = [];
    const title = sessionTitle || t`Untitled`;
    sections.push(`#+TITLE: ${title}`);

    if (sessionCreatedAt) {
      sections.push(`#+DATE: ${formatDate(sessionCreatedAt)}`);
    }

    sections.push("");
    sections.push(`* ${t`Metadata`}`);

    if (sessionCreatedAt) {
      sections.push(`- ${t`Created`} :: ${formatDate(sessionCreatedAt)}`);
    }

    if (participantNames.length > 0) {
      sections.push(`- ${t`Participants`} :: ${participantNames.join(", ")}`);
    }

    if (transcriptDuration) {
      sections.push(`- ${t`Duration`} :: ${transcriptDuration}`);
    }

    if (includeMemo) {
      const memo = getMemoMd();
      if (memo) {
        sections.push("");
        sections.push(`* ${t`My notes`}`);
        sections.push(markdownToOrg(memo));
      }
    }

    if (includeSummary) {
      const summary = getSummaryMd();
      if (summary) {
        sections.push("");
        sections.push(`* ${t`Summary`}`);
        sections.push(markdownToOrg(summary));
      }
    }

    if (includeTranscript) {
      const transcript = getTranscriptText();
      if (transcript) {
        sections.push("");
        sections.push(`* ${t`Transcript`}`);
        sections.push(transcript);
      }
    }

    return sections.join("\n");
  };

  const buildPdfContent = (): {
    enhancedMd: string;
    memoMd: string | null;
    transcript: { items: TranscriptItem[] } | null;
    metadata: ExportMetadata | null;
  } => {
    const metadata: ExportMetadata = {
      title: sessionTitle || t`Untitled`,
      createdAt: sessionCreatedAt ? formatDate(sessionCreatedAt) : "",
      participants: participantNames,
      eventTitle: eventTitle || null,
      duration: transcriptDuration,
    };

    let memoMd: string | null = null;
    if (includeMemo) {
      const memo = getMemoMd();
      if (memo) memoMd = memo;
    }

    const parts: string[] = [];

    if (includeSummary) {
      const summary = getSummaryMd();
      if (summary) parts.push(summary);
    }

    return {
      enhancedMd: parts.join("\n\n"),
      memoMd,
      transcript:
        includeTranscript && transcriptItems.length > 0
          ? { items: transcriptItems }
          : null,
      metadata,
    };
  };

  const { mutate, isPending, error } = useMutation({
    mutationFn: async () => {
      const { values } = await getStoredSettingValues();
      const directory = values.export_directory || (await downloadDir());
      const sanitizedTitle = (
        (sessionTitle ?? t`Untitled`).trim() || t`Untitled`
      ).replace(/[<>:"/\\|?*]/g, "_");
      // Fork: Export… always shows the Save panel, with a readable name like
      // "Weekly sync – Oct 3, 2026.pdf" (journey-after P2 "Export…"; Apple
      // HIG, File management: Export shows a save panel).
      const filename = `${sanitizedTitle.slice(0, 100)} – ${formatDateFns(new Date(), "MMM d, yyyy")}.${format}`;
      const defaultPath = await join(directory, filename);
      const path = await save({
        defaultPath,
        filters: [{ name: format.toUpperCase(), extensions: [format] }],
      });
      if (!path) return null;

      if (format === "pdf") {
        const exportContent = buildPdfContent();
        const result = await exportCommands.export(path, exportContent);
        if (result.status === "error") {
          throw new Error(result.error);
        }
      } else {
        const textContent =
          format === "md"
            ? buildMdContent()
            : format === "org"
              ? buildOrgContent()
              : buildTxtContent();
        const result = await fs2Commands.writeTextFile(path, textContent);
        if (result.status === "error") {
          throw new Error(result.error);
        }
      }

      return path;
    },
    onSuccess: (path) => {
      if (!path) return;
      void analyticsCommands.event({
        event: "session_exported",
        format,
        include_summary: includeSummary,
        include_transcript: includeTranscript,
      });
      void openerCommands.revealItemInDir(path);
      onOpenChange(false);
    },
    onError: console.error,
  });

  const hasAnyContentSelected =
    includeMemo || (includeSummary && hasSummary) || includeTranscript;
  const isTranscriptPending = includeTranscript && isTranscriptLoading;
  if (!open) {
    return null;
  }

  // Fork: one opaque dialog surface with Cancel, real fieldsets, no shadows
  // (ux-audit-oct3 C; design-system dialogs, HIG sheets, WCAG 1.3.1).
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <GlassDialogContent className="text-center">
        <div className="flex flex-col gap-1">
          <DialogTitle className="text-base leading-normal font-semibold">
            <Trans>Export</Trans>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            <Trans>Choose a file format and what to include.</Trans>
          </DialogDescription>
        </div>

        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 w-full text-sm font-medium">
              <Trans>File format</Trans>
            </legend>
            <div className="flex justify-center gap-4">
              {/* Fork: no "Org" (Emacs jargon for this audience;
                  journey-after P3 "Export format", NN/g #2). */}
              {(["pdf", "txt", "md"] as const).map((f) => (
                <label
                  key={f}
                  className="flex cursor-pointer items-center gap-1.5 text-sm"
                >
                  <input
                    type="radio"
                    name="export-format"
                    checked={format === f}
                    onChange={() => setFormat(f)}
                    // Fork: radios and checkboxes stay neutral, never the
                    // accent (design-system "The one accent"; NN/g #4).
                    className="accent-foreground"
                  />
                  {f === "md" ? "Markdown" : f.toUpperCase()}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 w-full text-sm font-medium">
              <Trans>Include</Trans>
            </legend>
            <div className="flex justify-center gap-4">
              {(
                [
                  [
                    "memo",
                    <Trans>My notes</Trans>,
                    includeMemo,
                    setIncludeMemo,
                  ],
                  [
                    "summary",
                    <Trans>Summary</Trans>,
                    includeSummary,
                    setIncludeSummary,
                  ],
                  [
                    "transcript",
                    <Trans>Transcript</Trans>,
                    includeTranscript,
                    setIncludeTranscript,
                  ],
                ] as const
              ).map(([id, label, checked, setter]) => {
                const unavailable = id === "summary" && !hasSummary;
                return (
                  <label
                    key={id}
                    className={
                      unavailable
                        ? "flex cursor-default items-center gap-1.5 text-sm opacity-60"
                        : "flex cursor-pointer items-center gap-1.5 text-sm"
                    }
                  >
                    <input
                      type="checkbox"
                      checked={unavailable ? false : checked}
                      disabled={unavailable}
                      aria-describedby={
                        unavailable ? "export-no-summary" : undefined
                      }
                      onChange={(e) => setter(e.target.checked)}
                      // Fork: neutral, as the radios above and the Home
                      // follow-up checkboxes (design-system "The one
                      // accent"; NN/g #4).
                      className="accent-foreground"
                    />
                    {label}
                  </label>
                );
              })}
            </div>
            {hasSummary ? null : (
              <p
                id="export-no-summary"
                className="text-muted-foreground text-xs"
              >
                <Trans>No summary yet</Trans>
              </p>
            )}
          </fieldset>
        </div>

        {/* Fork: the save panel picks the folder, so the fix names that step
            (NN/g heuristic #9, help users recover from errors). */}
        {error && (
          <p role="alert" className="text-destructive text-xs">
            <Trans>
              Couldn't export this note. Pick another folder and try again.
            </Trans>
          </p>
        )}
        <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:justify-normal">
          <GlassDialogCancelButton
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            <Trans>Cancel</Trans>
          </GlassDialogCancelButton>
          <Button
            type="button"
            onClick={() => mutate(null)}
            disabled={
              isPending || isTranscriptPending || !hasAnyContentSelected
            }
            className="h-8 rounded-full px-4 text-xs font-medium"
          >
            {isPending
              ? t`Exporting…`
              : isTranscriptPending
                ? t`Preparing transcript…`
                : t`Export`}
          </Button>
        </DialogFooter>
      </GlassDialogContent>
    </Dialog>
  );
}
