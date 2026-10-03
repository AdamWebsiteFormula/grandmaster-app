import { useCallback, useMemo } from "react";

import { CaretDown, Copy, Sparkle } from "@anlg/ui/components/icons";
import { Spinner } from "@anlg/ui/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@anlg/ui/components/ui/tooltip";
import { cn } from "@anlg/utils";

import {
  copyTextToClipboard,
  getEnhancedNoteTitle,
  getStoredNoteMarkdown,
  iconHeaderViewClassName,
  noteChipClassName,
} from "./header-shared";
import {
  TemplatePickerPopover,
  type TemplateSelection,
} from "./template-picker";

import { useAITaskTask } from "~/ai/hooks";
import { getEnhancerService } from "~/services/enhancer";
import { useEnhancedNoteActions } from "~/session/components/note-input/enhanced-actions";
import { useEnhancedNote } from "~/session/queries";
import {
  type MenuItemDef,
  useNativeContextMenu,
} from "~/shared/hooks/useNativeContextMenu";
import { createTaskId } from "~/store/zustand/ai-task/task-configs";
import { useUserTemplate } from "~/templates";

export function HeaderViewEnhanced({
  isActive,
  onClick = () => {},
  sessionId,
  enhancedNoteId,
  canRemove = false,
  onRemove,
  onSelectNote,
  variant = "tray",
}: {
  isActive: boolean;
  onClick?: () => void;
  sessionId: string;
  enhancedNoteId: string;
  canRemove?: boolean;
  onRemove?: () => void;
  onSelectNote?: (enhancedNoteId: string) => void;
  /** "chip": the template pill in the row under the note title. */
  variant?: "tray" | "chip";
}) {
  if (!isActive) {
    return (
      <HeaderViewEnhancedInactive
        enhancedNoteId={enhancedNoteId}
        onClick={onClick}
        variant={variant}
      />
    );
  }

  return (
    <HeaderViewEnhancedActive
      sessionId={sessionId}
      enhancedNoteId={enhancedNoteId}
      canRemove={canRemove}
      onRemove={onRemove}
      onSelectNote={onSelectNote}
      variant={variant}
    />
  );
}

function useEnhancedViewTitle(enhancedNoteId: string) {
  const enhancedNote = useEnhancedNote(enhancedNoteId);
  const rawTitle = enhancedNote?.title;
  const templateId = enhancedNote?.templateId;
  const { data: template } = useUserTemplate(templateId);
  const templateTitle = template?.title?.trim() || null;
  const viewTitle = getEnhancedNoteTitle({
    rawTitle,
    templateTitle,
    templateId,
  });

  return {
    viewTitle,
    templateTooltip:
      templateId && templateTitle
        ? `${templateTitle} was used to generate this summary.`
        : undefined,
  };
}

function useEnhancedViewGenerating(enhancedNoteId: string) {
  const taskId = createTaskId(enhancedNoteId, "enhance");
  const enhanceTask = useAITaskTask(taskId, "enhance");

  return enhanceTask.isGenerating;
}

function HeaderViewEnhancedInactive({
  onClick = () => {},
  enhancedNoteId,
  variant = "tray",
}: {
  enhancedNoteId: string;
  onClick?: () => void;
  variant?: "tray" | "chip";
}) {
  const { viewTitle, templateTooltip } = useEnhancedViewTitle(enhancedNoteId);
  const isGenerating = useEnhancedViewGenerating(enhancedNoteId);

  if (variant === "chip") {
    return (
      <button
        type="button"
        onClick={onClick}
        title={templateTooltip}
        className={noteChipClassName(false)}
      >
        {isGenerating ? (
          <Spinner size={14} className="shrink-0" />
        ) : (
          <Sparkle aria-hidden />
        )}
        <span className="min-w-0 truncate">{viewTitle}</span>
      </button>
    );
  }

  return (
    <button
      data-main-area-window-drag-region
      data-tauri-drag-region="false"
      type="button"
      aria-label={viewTitle}
      onClick={onClick}
      // WCAG 2.2 SC 4.1.2: bare icon tab needs a name (aria-label) and a visible tooltip.
      title={templateTooltip ?? viewTitle}
      className={iconHeaderViewClassName(false, "tray", "px-2")}
    >
      {isGenerating ? (
        <Spinner size={16} className="shrink-0" />
      ) : (
        <Sparkle className="size-4" />
      )}
    </button>
  );
}

function HeaderViewEnhancedActive({
  sessionId,
  enhancedNoteId,
  canRemove = false,
  onRemove,
  onSelectNote,
  variant = "tray",
}: {
  sessionId: string;
  enhancedNoteId: string;
  canRemove?: boolean;
  onRemove?: () => void;
  onSelectNote?: (enhancedNoteId: string) => void;
  variant?: "tray" | "chip";
}) {
  const { isGenerating, isError, onRegenerate } = useEnhanceLogic(
    sessionId,
    enhancedNoteId,
  );
  const enhancedNote = useEnhancedNote(enhancedNoteId);
  const content = enhancedNote?.content;
  const usedTemplateId = enhancedNote?.templateId?.trim() || null;
  const { viewTitle, templateTooltip } = useEnhancedViewTitle(enhancedNoteId);
  const noteMarkdown = useMemo(() => getStoredNoteMarkdown(content), [content]);

  const handleCopy = useCallback(() => {
    return copyTextToClipboard(
      noteMarkdown,
      {
        success: `${viewTitle} copied to clipboard`,
        error: `Failed to copy ${viewTitle}`,
      },
      { html: true },
    );
  }, [noteMarkdown, viewTitle]);
  const handleRegenerate = useCallback(() => {
    void onRegenerate(null);
  }, [onRegenerate]);
  const handleSelectTemplate = useCallback(
    (selection: TemplateSelection) => {
      if (isGenerating) {
        return;
      }

      const service = getEnhancerService();
      if (!service) {
        return;
      }

      onSelectNote?.(enhancedNoteId);

      void Promise.resolve(
        service.enhance(sessionId, {
          templateId: selection.templateId,
          targetNoteId: enhancedNoteId,
          templateTitle: selection.templateId ? selection.title : undefined,
        }),
      )
        .then((result) => {
          if (
            (result.type === "started" || result.type === "already_active") &&
            result.noteId !== enhancedNoteId
          ) {
            onSelectNote?.(result.noteId);
          }
        })
        .catch((error) => {
          console.error("[enhancer] failed to replace summary template", error);
        });
    },
    [enhancedNoteId, isGenerating, onSelectNote, sessionId],
  );
  const contextMenu = useMemo<MenuItemDef[]>(() => {
    const items: MenuItemDef[] = [
      {
        id: `copy-enhanced-${enhancedNoteId}`,
        text: "Copy",
        action: () => {
          void handleCopy();
        },
        disabled: noteMarkdown.length === 0,
      },
      {
        id: `regenerate-enhanced-${enhancedNoteId}`,
        text: "Regenerate",
        action: handleRegenerate,
        disabled: isGenerating,
      },
    ];

    if (canRemove) {
      items.push({ separator: true });
      items.push({
        id: `remove-enhanced-${enhancedNoteId}`,
        text: "Remove",
        action: () => {
          onRemove?.();
        },
        disabled: isGenerating || !onRemove,
      });
    }

    return items;
  }, [
    canRemove,
    enhancedNoteId,
    handleCopy,
    handleRegenerate,
    isGenerating,
    noteMarkdown.length,
    onRemove,
  ]);
  const showContextMenu = useNativeContextMenu(contextMenu);
  const templateMenuTrigger =
    variant === "chip" ? (
      <button
        type="button"
        aria-label={viewTitle}
        aria-current="page"
        aria-disabled={isGenerating}
        tabIndex={isGenerating ? -1 : 0}
        onContextMenu={showContextMenu}
        title={templateTooltip}
        className={noteChipClassName(
          false,
          cn([
            "text-foreground",
            isGenerating && "cursor-not-allowed opacity-70",
            isError && "text-destructive hover:text-destructive",
          ]),
        )}
      >
        {isGenerating ? (
          <Spinner size={14} className="shrink-0" />
        ) : (
          <Sparkle aria-hidden />
        )}
        <span className="min-w-0 truncate">{viewTitle}</span>
        <CaretDown aria-hidden className="!size-3" />
      </button>
    ) : (
      <button
        data-main-area-window-drag-region
        data-tauri-drag-region="false"
        type="button"
        aria-label={viewTitle}
        aria-current="page"
        aria-disabled={isGenerating}
        tabIndex={isGenerating ? -1 : 0}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onContextMenu={showContextMenu}
        title={templateTooltip}
        className={iconHeaderViewClassName(
          true,
          "tray",
          cn([
            "max-w-56 min-w-[62px] gap-1.5 px-2 @max-[480px]:max-w-12 @max-[480px]:min-w-12 @max-[480px]:gap-0 @max-[480px]:px-1.5",
            isGenerating ? "cursor-not-allowed opacity-70" : "cursor-pointer",
            isError
              ? [
                  "text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:bg-destructive/10",
                ]
              : [
                  "focus-visible:text-foreground focus-visible:bg-white",
                  "dark:focus-visible:text-foreground dark:focus-visible:bg-accent",
                ],
          ]),
        )}
      >
        {isGenerating ? (
          <Spinner size={16} className="shrink-0" />
        ) : (
          <Sparkle className="size-4" />
        )}
        <span className="min-w-0 truncate text-xs font-medium @max-[480px]:sr-only">
          {viewTitle}
        </span>
        <CaretDown className="size-3.5" />
      </button>
    );

  if (variant === "chip") {
    // Copy notes lives in the ⋯ and Share menus on the note page.
    return (
      <TemplatePickerPopover
        onSelectTemplate={handleSelectTemplate}
        usedTemplateId={usedTemplateId}
        onRegenerateUsed={handleRegenerate}
        isRegenerating={isGenerating}
        trigger={templateMenuTrigger}
      />
    );
  }

  return (
    <>
      <TemplatePickerPopover
        onSelectTemplate={handleSelectTemplate}
        usedTemplateId={usedTemplateId}
        onRegenerateUsed={handleRegenerate}
        isRegenerating={isGenerating}
        trigger={templateMenuTrigger}
      />
      <CopyNotesButton
        disabled={noteMarkdown.length === 0}
        onCopy={() => {
          void handleCopy();
        }}
      />
    </>
  );
}

// Visible one-click copy (Granola "Copy as markdown", Otter copy to clipboard).
// The right-click Copy on the summary title stays as well.
function CopyNotesButton({
  disabled,
  onCopy,
}: {
  disabled: boolean;
  onCopy: () => void;
}) {
  const label = "Copy notes";

  // Own provider so the header renders anywhere, including tests.
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            data-main-area-window-drag-region
            data-tauri-drag-region="false"
            type="button"
            aria-label={label}
            disabled={disabled}
            onClick={(event) => {
              event.stopPropagation();
              onCopy();
            }}
            className={iconHeaderViewClassName(
              false,
              "tray",
              "px-1.5 disabled:pointer-events-none disabled:opacity-40",
            )}
          >
            <Copy className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const useEnhanceLogic = (sessionId: string, enhancedNoteId: string) =>
  useEnhancedNoteActions({ sessionId, enhancedNoteId });
