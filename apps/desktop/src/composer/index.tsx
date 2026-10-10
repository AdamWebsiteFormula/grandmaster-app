import { t } from "@lingui/core/macro";
import { platform } from "@tauri-apps/plugin-os";
import { useEffect, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { ChatEditor, type ChatEditorHandle } from "@anlg/editor/chat";
import type { PlaceholderFunction } from "@anlg/editor/plugins";
import { commands as windowsCommands } from "@anlg/plugin-windows";
import { ArrowUp, ArrowUpRight, Sparkle, X } from "@anlg/ui/components/icons";
import { toast } from "@anlg/ui/components/ui/toast";
import { cn } from "@anlg/utils";

import { useLanguageModel } from "~/ai/hooks";
import {
  useAutoFocusEditor,
  useDraftState,
  useSubmit,
} from "~/chat/components/input/hooks";
import { ChatSession } from "~/chat/components/session-provider";
import { dedupeByKey, type ContextRef } from "~/chat/context/entities";
import { useChatGroup } from "~/chat/store/queries";
import { useChatActions } from "~/chat/store/use-chat-actions";
import { useShell } from "~/contexts/shell";
import { useMentionConfig } from "~/editor-bridge/mention-config";
import { useOwnerUserId } from "~/shared/owner-user";

export function ComposerScreen() {
  const { chat } = useShell();
  const model = useLanguageModel("chat");
  const userId = useOwnerUserId();
  const currentChatGroup = useChatGroup(chat.groupId, chat.scope);
  const { handleSendMessage } = useChatActions({
    chatScope: chat.scope,
    groupId: chat.groupId,
    onGroupCreated: chat.setGroupId,
    onGroupCreateFailed: chat.rollbackFailedGroup,
  });

  useEffect(() => {
    chat.sendEvent({ type: "OPEN" });

    return () => {
      chat.sendEvent({ type: "CLOSE" });
    };
  }, [chat]);

  useHotkeys(
    "esc",
    () => {
      void dismissComposer();
    },
    {
      preventDefault: true,
      enableOnFormTags: true,
      enableOnContentEditable: true,
    },
    [],
  );

  if (!userId) {
    return <div className="h-screen w-screen bg-transparent" />;
  }

  return (
    <div className="h-screen w-screen bg-transparent">
      <ChatSession
        key={chat.sessionId}
        sessionId={chat.sessionId}
        chatGroupId={chat.groupId}
      >
        {(sessionProps) => {
          const sendMessage = (
            content: string,
            parts: Array<{ type: "text"; text: string }>,
            contextRefs?: ContextRef[],
          ) => {
            handleSendMessage(
              content,
              parts,
              sessionProps.sendMessage,
              contextRefs
                ? dedupeByKey([sessionProps.pendingRefs, contextRefs])
                : sessionProps.pendingRefs,
            );
          };

          return model ? (
            <ComposerInput
              draftKey={sessionProps.sessionId}
              disabled={!sessionProps.isSystemPromptReady}
              isStreaming={
                sessionProps.status === "streaming" ||
                sessionProps.status === "submitted"
              }
              onStop={sessionProps.stop}
              onSendMessage={sendMessage}
              title={currentChatGroup?.title || t`Ask Upshot AI anything`}
            />
          ) : (
            <ComposerSettingsCard />
          );
        }}
      </ChatSession>
    </div>
  );
}

function ComposerSettingsCard() {
  return (
    <div
      className={cn([
        "h-full w-full rounded-[28px] px-5 py-4",
        "bg-popover border-border text-popover-foreground border",
      ])}
    >
      <div className="flex items-center justify-between gap-3">
        <div data-tauri-drag-region className="min-w-0 flex-1 pr-4">
          <p className="text-muted-foreground text-xs font-semibold">
            {t`Composer`}
          </p>
          <p className="text-popover-foreground/72 truncate pt-1 text-sm">
            {/* Fork: no AI settings page, as in Granola
                (docs.granola.ai/help-center/getting-more-from-your-notes/understanding-model-selection-in-granola-chat). */}
            {t`Upshot AI is getting ready. Try again in a minute.`}
          </p>
        </div>

        <button
          type="button"
          aria-label={t`Close`}
          title={t`Close`}
          onClick={() => void dismissComposer()}
          data-tauri-drag-region="false"
          className={cn([
            "inline-flex size-8 items-center justify-center rounded-full",
            "bg-popover-foreground/7 text-popover-foreground/65 transition-colors",
            "hover:bg-popover-foreground/12 hover:text-popover-foreground",
          ])}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

function ComposerInput({
  draftKey,
  disabled,
  isStreaming,
  onStop,
  onSendMessage,
  title,
}: {
  draftKey: string;
  disabled?: boolean;
  isStreaming?: boolean;
  onStop?: () => void;
  title: string;
  onSendMessage: (
    content: string,
    parts: Array<{ type: "text"; text: string }>,
    contextRefs?: ContextRef[],
  ) => void;
}) {
  const editorRef = useRef<ChatEditorHandle>(null);
  const { hasContent, initialContent, handleEditorUpdate } = useDraftState({
    draftKey,
  });
  const handleSubmit = useSubmit({
    draftKey,
    editorRef,
    disabled,
    isStreaming,
    onSendMessage,
  });
  const mentionConfig = useMentionConfig();
  // Fork: "⌘ ↩" on a Mac, "Ctrl+Enter" elsewhere (Microsoft Writing Style
  // Guide, Keys and keyboard shortcuts).
  const sendShortcut = platform() === "macos" ? "⌘ ↩" : "Ctrl+Enter";

  useAutoFocusEditor({
    editorRef,
    disabled,
  });

  return (
    <div
      className={cn([
        "h-full w-full rounded-[28px] px-5 py-4",
        "bg-popover border-border text-popover-foreground border",
      ])}
    >
      <div className="mb-3 flex items-start justify-between gap-4">
        <div data-tauri-drag-region className="min-w-0 flex-1 pr-4">
          <p className="text-muted-foreground text-xs font-semibold">
            {t`Composer`}
          </p>
          <p className="text-popover-foreground/90 truncate pt-1 text-[15px]">
            {title}
          </p>
        </div>

        <div data-tauri-drag-region="false" className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void openMainWindow()}
            data-tauri-drag-region="false"
            className={cn([
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
              "bg-popover-foreground/7 text-popover-foreground/76",
              "hover:bg-popover-foreground/12 hover:text-popover-foreground transition-colors",
            ])}
          >
            <ArrowUpRight className="size-3.5" />
            {t`Open Upshot`}
          </button>
          <button
            type="button"
            aria-label={t`Close`}
            title={t`Close`}
            onClick={() => void dismissComposer()}
            data-tauri-drag-region="false"
            className={cn([
              "inline-flex size-8 items-center justify-center rounded-full",
              "bg-popover-foreground/7 text-popover-foreground/65 transition-colors",
              "hover:bg-popover-foreground/12 hover:text-popover-foreground",
            ])}
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <ChatEditor
        ref={editorRef}
        onAttachmentError={(message) => toast.error(message)}
        className={cn([
          "text-popover-foreground max-h-[88px] min-h-[34px] overflow-y-auto text-[15px] leading-6",
          "[&_.ProseMirror]:min-h-[34px] [&_.ProseMirror]:outline-none",
          "[&_.ProseMirror]:placeholder:text-muted-foreground",
        ])}
        initialContent={initialContent}
        mentionConfig={mentionConfig}
        placeholder={composerPlaceholder}
        onUpdate={handleEditorUpdate}
        onSubmit={handleSubmit}
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <span className="bg-popover-foreground/8 rounded-full px-2 py-1">
            {t`Esc to dismiss`}
          </span>
          <span className="bg-popover-foreground/8 rounded-full px-2 py-1">
            {t`${sendShortcut} to send`}
          </span>
        </div>

        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            className={cn([
              "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium",
              "bg-popover-foreground/8 text-popover-foreground/82 transition-colors",
              "hover:bg-popover-foreground/12 hover:text-popover-foreground",
            ])}
          >
            <Sparkle className="size-3.5" />
            {t`Stop`}
          </button>
        ) : (
          <button
            type="button"
            aria-label={t`Send`}
            title={t`Send`}
            onClick={handleSubmit}
            disabled={disabled}
            className={cn([
              "inline-flex size-10 items-center justify-center rounded-full",
              disabled
                ? "bg-popover-foreground/8 text-popover-foreground/25 cursor-default"
                : [
                    "bg-primary text-primary-foreground",
                    "transition-transform hover:scale-[1.02]",
                  ],
              !hasContent && !disabled && "opacity-55",
            ])}
          >
            <ArrowUp className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

const composerPlaceholder: PlaceholderFunction = ({ node, pos }) => {
  if (node.type.name === "paragraph" && pos === 0) {
    return t`Message Upshot AI`;
  }

  return "";
};

async function openMainWindow() {
  await windowsCommands.windowShow({ type: "main" });
  await dismissComposer();
}

async function dismissComposer() {
  const result = await windowsCommands.windowHide({ type: "composer" });

  if (result.status === "error") {
    console.error("Failed to dismiss composer:", result.error);
  }
}
