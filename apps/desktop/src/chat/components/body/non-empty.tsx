import { useLingui } from "@lingui/react/macro";
import type { ChatStatus } from "ai";

import { ErrorMessage } from "~/chat/components/message/error";
import { LoadingMessage } from "~/chat/components/message/loading";
import { NormalMessage } from "~/chat/components/message/normal";
import { MessageTimestamp } from "~/chat/components/message/timestamp";
import { followUpRecipes, RecipeRow } from "~/chat/components/recipes";
import { hasRenderableContent } from "~/chat/message-content";
import type { AnlgUIMessage } from "~/chat/types";

function isWaitingForAssistantContent(message: AnlgUIMessage | undefined) {
  if (message?.role !== "assistant") {
    return false;
  }

  const lastPart = message.parts[message.parts.length - 1];
  if (!lastPart) {
    return false;
  }

  if (lastPart.type === "step-start") {
    return true;
  }

  const state = "state" in lastPart ? lastPart.state : undefined;
  return (
    lastPart.type.startsWith("tool-") &&
    (state === "output-available" || state === "output-error")
  );
}

export function ChatBodyNonEmpty({
  messages,
  status,
  error,
  onReload,
  onSendMessage,
}: {
  messages: AnlgUIMessage[];
  status: ChatStatus;
  error?: Error;
  onReload?: () => void;
  onSendMessage?: (
    content: string,
    parts: Array<{ type: "text"; text: string }>,
  ) => void;
}) {
  const { t } = useLingui();
  const showErrorState = status === "error" && error;
  const lastMessage = messages[messages.length - 1];
  const showLoadingState =
    (status === "submitted" || status === "streaming") &&
    (lastMessage?.role !== "assistant" ||
      !hasRenderableContent(lastMessage) ||
      isWaitingForAssistantContent(lastMessage));

  let lastAssistantIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") {
      lastAssistantIndex = i;
      break;
    }
  }

  return (
    <div className="flex flex-col">
      {messages[0]?.metadata?.createdAt !== undefined && (
        <div className="pt-2 pb-4 text-center">
          <MessageTimestamp
            createdAt={messages[0].metadata.createdAt}
            showDate
          />
        </div>
      )}
      {messages.map((message, index) => (
        <NormalMessage
          key={message.id}
          message={message}
          handleReload={
            message.role === "assistant" &&
            index === lastAssistantIndex &&
            onReload
              ? onReload
              : undefined
          }
        />
      ))}
      {/* Fork: follow-up chips under a finished answer, as Granola's "Say
          more" (granola-compare-oct3 section 4). */}
      {onSendMessage &&
      status === "ready" &&
      lastMessage?.role === "assistant" &&
      hasRenderableContent(lastMessage) ? (
        <RecipeRow
          label={t`Follow-ups`}
          recipes={followUpRecipes()}
          onSelect={(prompt) =>
            onSendMessage(prompt, [{ type: "text", text: prompt }])
          }
          wrap
          className="pt-1 pb-2"
        />
      ) : null}
      {showLoadingState && <LoadingMessage />}
      {showErrorState && <ErrorMessage error={error} onRetry={onReload} />}
    </div>
  );
}
