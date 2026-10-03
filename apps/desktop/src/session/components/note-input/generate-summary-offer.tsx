import { useLingui } from "@lingui/react/macro";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { Sparkle } from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";
import { toast } from "@anlg/ui/components/ui/toast";
import { hasSummaryContent } from "@anlg/utils/session";

import { showModelNotReadyToast } from "./enhanced/model-not-ready";

import { getEnhancerService } from "~/services/enhancer";
import {
  hasStoredNoteContent,
  useHasTranscript,
} from "~/session/components/shared";
import { useIsSessionEnhancing } from "~/session/hooks/useEnhancedNotes";
import { useEnhancedNoteRecords, useSession } from "~/session/queries";
import type { SessionMode } from "~/store/zustand/listener/general";
import { type Tab, useTabs } from "~/store/zustand/tabs";
import { useListener } from "~/stt/contexts";

// Fork: after a meeting, My notes always offers Generate summary when there
// is no summary, as Granola offers to enhance notes after every meeting
// (docs.granola.ai/help-center/getting-started/granola-101; Granola taking-notes
// docs, "enhance notes after the meeting"). A skipped automatic summary says
// why in plain words next to the button (NN/g #1 visibility of system status,
// #3 user control, #9 plain error messages).

export type GenerateSummaryOfferReason = "too_short" | "offline" | null;

export function shouldOfferGenerateSummary({
  sessionMode,
  hasTranscript,
  hasNotes,
  hasSummary,
  isGenerating,
}: {
  sessionMode: SessionMode;
  hasTranscript: boolean;
  hasNotes: boolean;
  hasSummary: boolean;
  isGenerating: boolean;
}): boolean {
  return (
    sessionMode === "inactive" &&
    !hasSummary &&
    !isGenerating &&
    (hasTranscript || hasNotes)
  );
}

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function getOnline() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

export function useIsOnline() {
  return useSyncExternalStore(subscribeOnline, getOnline, () => true);
}

export function useGenerateSummaryOffer(sessionId: string) {
  const session = useSession(sessionId);
  const hasTranscript = useHasTranscript(sessionId);
  const sessionMode = useListener((state) => state.getSessionMode(sessionId));
  const notes = useEnhancedNoteRecords(sessionId);
  const isGenerating = useIsSessionEnhancing(sessionId);
  const online = useIsOnline();
  const hasNotes = hasStoredNoteContent(session?.raw_md);
  const hasSummary = notes.some((note) =>
    hasSummaryContent(note.content, session?.title),
  );
  const visible =
    session !== null &&
    shouldOfferGenerateSummary({
      sessionMode,
      hasTranscript,
      hasNotes,
      hasSummary,
      isGenerating,
    });

  // The same check the automatic summary runs, so the reason shown here
  // matches why it was skipped.
  const [tooShort, setTooShort] = useState(false);
  useEffect(() => {
    if (!visible || !hasTranscript) {
      setTooShort(false);
      return;
    }
    const service = getEnhancerService();
    if (!service) {
      return;
    }
    let canceled = false;
    service
      .checkEligibility(sessionId)
      .then((eligibility) => {
        if (!canceled) {
          setTooShort(
            !eligibility.eligible &&
              eligibility.code === "transcript_too_short",
          );
        }
      })
      .catch((error: unknown) => {
        console.error("[generate-summary] eligibility check failed", error);
      });
    return () => {
      canceled = true;
    };
  }, [visible, hasTranscript, sessionId]);

  const reason: GenerateSummaryOfferReason = !online
    ? "offline"
    : tooShort
      ? "too_short"
      : null;

  return { visible, reason, hasNotes, hasTranscript, online };
}

function showSummaryView(sessionId: string, noteId: string) {
  const tabsState = useTabs.getState();
  const sessionTab = tabsState.tabs.find(
    (tab): tab is Extract<Tab, { type: "sessions" }> =>
      tab.type === "sessions" && tab.id === sessionId,
  );
  if (sessionTab) {
    tabsState.updateSessionTabState(sessionTab, {
      ...sessionTab.state,
      view: { type: "enhanced", id: noteId },
    });
  }
}

export function useGenerateSummaryAction(sessionId: string) {
  const { t } = useLingui();
  const online = useIsOnline();
  const [pending, setPending] = useState(false);

  const generate = useCallback(async () => {
    if (!online) {
      // NN/g #5 error prevention: say why instead of starting a run that
      // can only fail.
      toast.error(
        t`You're offline. Connect to the internet to generate a summary.`,
        {
          id: `generate-summary-offline-${sessionId}`,
        },
      );
      return;
    }
    const service = getEnhancerService();
    if (!service) {
      showModelNotReadyToast();
      return;
    }
    setPending(true);
    try {
      const result = await service.enhance(sessionId, {
        allowShortTranscript: true,
      });
      if (result.type === "no_model") {
        showModelNotReadyToast();
        return;
      }
      if (result.type === "started" || result.type === "already_active") {
        showSummaryView(sessionId, result.noteId);
      }
    } catch (error) {
      console.error("[generate-summary] failed to start", error);
      toast.error(t`Summary wasn't generated`, {
        id: `generate-summary-failed-${sessionId}`,
        description: t`Upshot couldn't start the summary. Try again in a moment.`,
      });
    } finally {
      setPending(false);
    }
  }, [online, sessionId, t]);

  return { generate, pending };
}

export function GenerateSummaryOffer({ sessionId }: { sessionId: string }) {
  const { t } = useLingui();
  const { visible, reason, hasNotes, hasTranscript } =
    useGenerateSummaryOffer(sessionId);
  const { generate, pending } = useGenerateSummaryAction(sessionId);

  if (!visible) {
    return null;
  }

  const message =
    reason === "offline"
      ? t`You're offline. Connect to the internet to generate a summary.`
      : reason === "too_short"
        ? hasNotes
          ? t`Too little was said for a full summary. Generate one from your notes anyway?`
          : t`Too little was said for a full summary. Add a few notes, or generate one anyway.`
        : hasTranscript
          ? t`No summary yet. Turn this meeting into clear notes.`
          : t`No summary yet. Turn your notes into a clear summary.`;

  return (
    <div
      data-generate-summary-offer
      role="status"
      className="bg-muted mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl px-4 py-3"
    >
      <p className="text-muted-foreground min-w-0 flex-1 basis-56 text-sm text-pretty">
        {message}
      </p>
      <Button
        type="button"
        onClick={() => {
          void generate();
        }}
        disabled={pending}
        size="sm"
        // Neutral, so the screen keeps one orange accent; the outline (field
        // border, 3:1) separates it from the muted card (design-system.md
        // Contrast; WCAG 2.2 SC 1.4.11).
        variant="outline"
        className="shrink-0 gap-2"
      >
        <Sparkle size={16} aria-hidden />
        <span>{t`Generate summary`}</span>
      </Button>
    </div>
  );
}
