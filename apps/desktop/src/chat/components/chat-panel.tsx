import { type ReactNode, useCallback } from "react";

import { cn } from "@anlg/utils";

import { ChatBody } from "./body";
import { ChatContent } from "./content";
import { ChatSession, type ChatSessionRenderProps } from "./session-provider";
import { ChatToolbarControls } from "./toolbar-controls";
import { useSessionTab } from "./use-session-tab";

import { useLanguageModel } from "~/ai/hooks";
import { useChatAppearance } from "~/chat/hooks/use-chat-appearance";
import { useChatActions } from "~/chat/store/use-chat-actions";
import { chatFloatingPanelClassNames } from "~/chat/surface";
import { useShell } from "~/contexts/shell";
import { useFolderSelection } from "~/folders/selection";
import { useSessionHasTranscript } from "~/session/queries";
import { useOwnerUserId } from "~/shared/owner-user";
import { folderIdForNewNote, useSidebarNotes } from "~/sidebar/note-filter";
import { isBatchTranscriptionPending } from "~/store/zustand/listener/general-shared";
import { useTabs } from "~/store/zustand/tabs";
import { useListener } from "~/stt/contexts";

export function ChatSessionHost({
  children,
}: {
  children: (sessionProps: ChatSessionRenderProps | null) => ReactNode;
}) {
  const { chat } = useShell();
  const { groupId, sessionId } = chat;
  const { currentSessionId } = useSessionTab();
  const noteFilter = useSidebarNotes((state) => state.noteFilter);
  const folderFilter = useSidebarNotes((state) => state.folderFilter);
  const contextSessionId =
    chat.scope === "automations" ? undefined : currentSessionId;
  // Fork: on a folder page, chat answers from that folder's notes, as
  // Granola's space chat does (journey-after P2 "Folder page"; granola-screens/11).
  const onFolderPage = useTabs((state) => state.currentTab?.type === "folders");
  const pageFolder = useFolderSelection((state) => state.selectedPath);
  const folderId =
    chat.scope === "automations"
      ? undefined
      : onFolderPage && pageFolder
        ? pageFolder
        : folderIdForNewNote(noteFilter, folderFilter);
  const ownerUserId = useOwnerUserId();
  const hasAvailableTranscript = useSessionHasTranscript(
    contextSessionId ?? "",
  );
  const batchTranscriptionPending = useListener((state) => {
    if (!contextSessionId) {
      return false;
    }
    return isBatchTranscriptionPending(
      state.getSessionMode(contextSessionId),
      state.live,
      state.live.batchTranscriptionPendingBySession[contextSessionId],
    );
  });

  if (!ownerUserId) {
    return <>{children(null)}</>;
  }

  return (
    <ChatSession
      sessionId={sessionId}
      chatGroupId={groupId}
      currentSessionId={contextSessionId}
      folderId={folderId}
      hasAvailableTranscript={hasAvailableTranscript}
      isBatchTranscriptionPending={batchTranscriptionPending}
      unstyled
    >
      {children}
    </ChatSession>
  );
}

export function ChatPanelFrame({
  layout: frameLayout = "floating",
  onBack,
  onDraftContentChange,
  onOpenFloating,
  onOpenRightPanel,
  sessionProps,
}: {
  // Fork: "page" is the Chat page, where the conversation stays in the
  // column you typed in (owner test, Oct 4). It draws like the right panel.
  layout?: "floating" | "right-panel" | "page";
  onBack?: () => void;
  onDraftContentChange?: (hasDraftContent: boolean) => void;
  onOpenFloating?: () => void;
  onOpenRightPanel?: () => void;
  sessionProps: ChatSessionRenderProps | null;
}) {
  const { chat } = useShell();
  const { groupId, setGroupId, rollbackFailedGroup } = chat;
  const { panelClassName, toolbarSurface } = useChatAppearance();
  const isPage = frameLayout === "page";
  const layout = isPage ? "right-panel" : frameLayout;
  const isFloating = layout === "floating";
  const model = useLanguageModel("chat");

  const handleGroupCreated = useCallback(
    (newGroupId: string) => {
      setGroupId(newGroupId);
    },
    [setGroupId],
  );

  const handleGroupCreateFailed = useCallback(
    (failedGroupId: string) => {
      rollbackFailedGroup(failedGroupId);
    },
    [rollbackFailedGroup],
  );

  const { handleSendMessage } = useChatActions({
    chatScope: chat.scope,
    groupId,
    onGroupCreated: handleGroupCreated,
    onGroupCreateFailed: handleGroupCreateFailed,
  });

  return (
    <div
      className={cn([
        "flex min-h-0 flex-col overflow-hidden",
        isFloating ? "max-h-full" : "h-full",
        isPage
          ? "bg-background text-foreground"
          : isFloating
            ? chatFloatingPanelClassNames()
            : panelClassName,
      ])}
    >
      {chat.scope === "automations" ? null : (
        <div
          data-tauri-drag-region={!isFloating || undefined}
          className={cn([
            "flex shrink-0 pr-0 pl-0",
            isPage
              ? "h-12 items-center"
              : isFloating
                ? "h-11 items-center"
                : "h-9 items-start pt-[9px]",
          ])}
        >
          <ChatToolbarControls
            chatScope={chat.scope}
            currentChatGroupId={groupId}
            layout={layout}
            onBack={isPage ? onBack : undefined}
            onClose={() => chat.sendEvent({ type: "CLOSE" })}
            onNewChat={chat.startNewChat}
            onOpenFloating={onOpenFloating}
            onOpenRightPanel={onOpenRightPanel}
            onSelectChat={chat.selectChat}
            surface={toolbarSurface}
          />
        </div>
      )}
      {sessionProps && (
        <ChatContent
          {...sessionProps}
          layout={layout}
          onDraftContentChange={onDraftContentChange}
          model={model}
          handleSendMessage={handleSendMessage}
          showRecipes={sessionProps.contextEntities.length > 0}
        >
          <ChatBody
            messages={sessionProps.messages}
            status={sessionProps.status}
            error={sessionProps.error}
            onReload={sessionProps.regenerate}
            isModelConfigured={!!model}
            hasContext={sessionProps.contextEntities.length > 0}
            onSendMessage={(content, parts) => {
              handleSendMessage(
                content,
                parts,
                sessionProps.sendMessage,
                sessionProps.pendingRefs,
              );
            }}
          />
        </ChatContent>
      )}
    </div>
  );
}
