import { createContext, useContext } from "react";

import type { ChatSessionRenderProps } from "./session-provider";

// Fork: the one chat session the app shares, for the Chat page, which shows
// an open conversation in its own column instead of the right panel (owner
// test, Oct 4). MainChatPanels provides it.
export const ChatSessionPropsContext =
  createContext<ChatSessionRenderProps | null>(null);

export function useChatSessionProps() {
  return useContext(ChatSessionPropsContext);
}
