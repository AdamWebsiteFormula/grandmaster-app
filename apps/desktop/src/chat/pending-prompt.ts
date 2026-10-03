// Fork: a prompt picked outside the chat (the home composer and its starter
// chips) waits here until the chat panel mounts, then is sent once.
import { create } from "zustand";

export const usePendingChatPrompt = create<{ prompt: string | null }>(() => ({
  prompt: null,
}));

export function queueChatPrompt(prompt: string) {
  usePendingChatPrompt.setState({ prompt });
}

export function takeChatPrompt(): string | null {
  const { prompt } = usePendingChatPrompt.getState();
  if (prompt !== null) usePendingChatPrompt.setState({ prompt: null });
  return prompt;
}
