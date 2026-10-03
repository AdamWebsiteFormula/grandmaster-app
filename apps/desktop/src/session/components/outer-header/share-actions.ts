import { useLingui } from "@lingui/react/macro";
import { useCallback, useMemo } from "react";

import { commands as openerCommands } from "@anlg/plugin-opener2";
import { toast } from "@anlg/ui/components/ui/toast";

import {
  copyTextToClipboard,
  getStoredNoteMarkdown,
} from "~/session/components/note-input/header-shared";
import {
  useEnhancedNote,
  useEnhancedNoteRecords,
  useSession,
} from "~/session/queries";
import type { EditorView } from "~/store/zustand/tabs/schema";

// Fork: Granola's note menu leads with Copy notes and Send notes via email
// (granola-compare-oct3 §5). Mail goes through a mailto: link, so it opens the
// user's own mail app with nothing sent anywhere else.

// Mail apps and macOS cut very long mailto: URLs, so the body stops near
// here; the full notes go to the clipboard instead.
export const MAILTO_BODY_LIMIT = 1800;

export function markdownToPlainText(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) =>
      line
        .replace(/^(\s*)#{1,6}\s+/, "$1")
        .replace(/^(\s*)[*+]\s+/, "$1- ")
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, href) =>
          text === href ? text : `${text} (${href})`,
        )
        .replace(/(\*\*|__)(.+?)\1/g, "$2")
        .replace(/(^|[^\w*])\*([^*\n]+)\*(?!\w)/g, "$1$2")
        .replace(/(^|[^\w_])_([^_\n]+)_(?!\w)/g, "$1$2")
        .replace(/~~(.+?)~~/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, "$1"),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Drops a leading "# Title" line that repeats the email subject. */
function stripLeadingTitle(markdown: string, title: string): string {
  const trimmedTitle = title.trim();
  const lines = markdown.split("\n");
  const first = lines[0]?.replace(/^#{1,6}\s+/, "").trim();
  if (trimmedTitle && first === trimmedTitle) {
    return lines.slice(1).join("\n").trimStart();
  }
  return markdown;
}

export function buildNotesMailto({
  title,
  body,
  truncatedNote,
  limit = MAILTO_BODY_LIMIT,
}: {
  title: string;
  body: string;
  truncatedNote: string;
  limit?: number;
}): { url: string; truncated: boolean } {
  let mailBody = body;
  const truncated = body.length > limit;
  if (truncated) {
    const cut = body.lastIndexOf("\n", limit);
    mailBody = `${body.slice(0, cut > limit / 2 ? cut : limit).trimEnd()}\n\n…\n\n${truncatedNote}`;
  }
  const url = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(mailBody)}`;
  return { url, truncated };
}

/** Markdown of the notes the user is looking at (a summary, else My notes). */
export function useCurrentNotesMarkdown(
  sessionId: string,
  currentView: EditorView,
) {
  const session = useSession(sessionId);
  const enhancedNoteIds = useEnhancedNoteRecords(sessionId).map(
    (note) => note.id,
  );
  const enhancedNoteId =
    currentView.type === "enhanced"
      ? currentView.id
      : currentView.type === "transcript"
        ? (enhancedNoteIds[0] ?? "")
        : "";
  const enhancedContent = useEnhancedNote(enhancedNoteId)?.content;

  return useMemo(() => {
    const enhancedMarkdown = getStoredNoteMarkdown(enhancedContent);
    if (enhancedNoteId && enhancedMarkdown) {
      return enhancedMarkdown;
    }
    return getStoredNoteMarkdown(session?.raw_md);
  }, [enhancedContent, enhancedNoteId, session?.raw_md]);
}

export function useNoteShareActions(
  sessionId: string,
  currentView: EditorView,
) {
  const { t } = useLingui();
  const title = useSession(sessionId)?.title?.trim() ?? "";
  const markdown = useCurrentNotesMarkdown(sessionId, currentView);
  const canShareNotes = markdown.trim().length > 0;

  const copyNotes = useCallback(
    () =>
      copyTextToClipboard(
        markdown,
        {
          success: t`Notes copied to clipboard`,
          error: t`Couldn't copy your notes. Try again.`,
        },
        { html: true },
      ),
    [markdown, t],
  );

  const sendNotesViaEmail = useCallback(async () => {
    const subject = title || t`Meeting notes`;
    const body = markdownToPlainText(stripLeadingTitle(markdown, title));
    const { url, truncated } = buildNotesMailto({
      title: subject,
      body,
      truncatedNote: t`Full notes copied to clipboard. Paste them here.`,
    });
    if (truncated) {
      await copyTextToClipboard(body);
      toast.success(t`Full notes copied to clipboard`);
    }
    try {
      await openerCommands.openUrl(url, null);
    } catch (error) {
      console.error("[share] failed to open mail", error);
      toast.error(t`Couldn't open your mail app. Try again.`);
    }
  }, [markdown, t, title]);

  return { canShareNotes, copyNotes, sendNotesViaEmail };
}
