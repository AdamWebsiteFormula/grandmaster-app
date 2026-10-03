import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  chat: {
    mode: "FloatingClosed" as string,
    scope: "general",
    groupId: undefined as string | undefined,
    sendEvent: vi.fn(),
    startNewChat: vi.fn(),
    selectChat: vi.fn(),
  },
  groups: [] as unknown[],
  queueChatPrompt: vi.fn(),
}));

vi.mock("~/contexts/shell", () => ({
  useShell: () => ({ chat: mocks.chat }),
}));
vi.mock("~/chat/store/queries", () => ({
  useRecentChatGroups: () => mocks.groups,
}));
vi.mock("~/chat/pending-prompt", () => ({
  queueChatPrompt: mocks.queueChatPrompt,
}));
vi.mock("~/chat/components/input/model-menu", () => ({
  ChatModelMenu: () => <button type="button">Auto</button>,
}));
vi.mock("~/chat/components/toolbar-controls", () => ({
  ChatGroups: ({ label }: { label?: string }) => (
    <button type="button" aria-label={label ?? "Chat history"} />
  ),
}));
vi.mock("./home-view", () => ({ HOME_COLUMN_CLASS: "" }));

import { HomeComposer } from "./home-composer";

describe("HomeComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chat.mode = "FloatingClosed";
    mocks.groups = [];
  });
  afterEach(cleanup);

  it("shows starter chips, Ask anything and the model menu", () => {
    render(<HomeComposer />);

    for (const name of [
      "What did I commit to this week?",
      "Summarize this week's meetings",
      "Prep me for my next meeting",
      "Auto",
    ]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    expect(screen.getByRole("textbox", { name: "Ask anything" })).toBeTruthy();
    expect(screen.getByText("⌘ J")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Recent chats" })).toBeNull();
  });

  it("sends a chip's prompt in a new chat", () => {
    render(<HomeComposer />);

    fireEvent.click(
      screen.getByRole("button", { name: "Prep me for my next meeting" }),
    );
    expect(mocks.chat.startNewChat).toHaveBeenCalled();
    expect(mocks.queueChatPrompt).toHaveBeenCalledWith(
      "Prep me for my next meeting",
    );
    expect(mocks.chat.sendEvent).toHaveBeenCalledWith({ type: "OPEN" });
  });

  it("sends what was typed on Enter", () => {
    render(<HomeComposer />);

    const input = screen.getByRole("textbox", { name: "Ask anything" });
    fireEvent.change(input, { target: { value: "What's due Friday?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(mocks.queueChatPrompt).toHaveBeenCalledWith("What's due Friday?");
    expect(mocks.chat.sendEvent).toHaveBeenCalledWith({ type: "OPEN" });
  });

  it("shows history when there are past chats and hides while chat is open", () => {
    mocks.groups = [{ id: "g1" }];
    const { rerender } = render(<HomeComposer />);
    expect(screen.getByRole("button", { name: "Recent chats" })).toBeTruthy();

    mocks.chat.mode = "FloatingOpen";
    rerender(<HomeComposer />);
    expect(screen.queryByRole("textbox", { name: "Ask anything" })).toBeNull();
  });
});
