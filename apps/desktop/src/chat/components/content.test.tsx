import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatContent } from "./content";

import { queueChatPrompt, usePendingChatPrompt } from "~/chat/pending-prompt";

vi.mock("./body", () => ({
  ChatBody: () => <div data-testid="chat-body" />,
}));

vi.mock("./input", () => ({
  ChatMessageInput: ({
    onSendMessage,
  }: {
    onSendMessage: (
      content: string,
      parts: Array<{ type: "text"; text: string }>,
    ) => void;
  }) => (
    <button
      type="button"
      data-testid="chat-input"
      onClick={() =>
        onSendMessage("Queued follow-up", [
          { type: "text", text: "Queued follow-up" },
        ])
      }
    >
      Mock input
    </button>
  ),
}));

class FakeDataTransfer {
  dropEffect = "none";
  private readonly values = new Map<string, string>();

  get types() {
    return Array.from(this.values.keys());
  }

  getData(type: string) {
    return this.values.get(type) ?? "";
  }

  setData(type: string, value: string) {
    this.values.set(type, value);
  }
}

const renderContent = (onAddContextEntity = vi.fn()) => {
  const { container } = render(
    <ChatContent
      sessionId="active-session"
      messages={[]}
      sendMessage={vi.fn()}
      regenerate={vi.fn()}
      stop={vi.fn()}
      status="ready"
      model={{} as never}
      handleSendMessage={vi.fn()}
      pendingRefs={[]}
      onAddContextEntity={onAddContextEntity}
      isSystemPromptReady
    />,
  );

  return container.querySelector("[data-chat-content]");
};

describe("ChatContent", () => {
  beforeEach(() => {
    cleanup();
  });

  it("sends a prompt picked on Home once the chat is ready", () => {
    queueChatPrompt("Prep me for my next meeting");
    const handleSendMessage = vi.fn();
    const props = {
      sessionId: "home-session",
      messages: [],
      sendMessage: vi.fn(),
      regenerate: vi.fn(),
      stop: vi.fn(),
      status: "ready" as const,
      model: {} as never,
      handleSendMessage,
      pendingRefs: [],
    };
    const { rerender } = render(
      <ChatContent {...props} isSystemPromptReady={false} />,
    );
    expect(handleSendMessage).not.toHaveBeenCalled();

    rerender(<ChatContent {...props} isSystemPromptReady />);
    expect(handleSendMessage).toHaveBeenCalledTimes(1);
    expect(handleSendMessage.mock.calls[0].slice(0, 2)).toEqual([
      "Prep me for my next meeting",
      [{ type: "text", text: "Prep me for my next meeting" }],
    ]);
    expect(usePendingChatPrompt.getState().prompt).toBeNull();
  });

  it("shows note recipes above the field and sends one", () => {
    const handleSendMessage = vi.fn();
    const props = {
      sessionId: "note-session",
      messages: [],
      sendMessage: vi.fn(),
      regenerate: vi.fn(),
      stop: vi.fn(),
      status: "ready" as const,
      model: {} as never,
      handleSendMessage,
      pendingRefs: [],
      isSystemPromptReady: true,
    };
    const { rerender } = render(<ChatContent {...props} />);
    expect(screen.queryByRole("group", { name: "Recipes" })).toBeNull();

    rerender(<ChatContent {...props} showRecipes />);
    fireEvent.click(
      screen.getByRole("button", { name: "Draft follow-up email" }),
    );
    expect(handleSendMessage.mock.calls[0].slice(0, 2)).toEqual([
      "Draft a follow-up email to the participants",
      [{ type: "text", text: "Draft a follow-up email to the participants" }],
    ]);
  });

  it("keeps context on new messages", () => {
    const handleSendMessage = vi.fn();
    const sendMessage = vi.fn();
    const contextRef = {
      kind: "human" as const,
      key: "human:manual:artem",
      humanId: "artem",
    };

    render(
      <ChatContent
        sessionId="active-session"
        messages={[]}
        sendMessage={sendMessage}
        regenerate={vi.fn()}
        stop={vi.fn()}
        status="ready"
        model={{} as never}
        handleSendMessage={handleSendMessage}
        pendingRefs={[contextRef]}
        isSystemPromptReady
      />,
    );

    fireEvent.click(screen.getByTestId("chat-input"));

    expect(handleSendMessage).toHaveBeenCalledWith(
      "Queued follow-up",
      [{ type: "text", text: "Queued follow-up" }],
      sendMessage,
      [contextRef],
    );
  });

  it("adds dropped session refs to chat context", () => {
    const onAddContextEntity = vi.fn();
    const container = renderContent(onAddContextEntity);
    const dataTransfer = new FakeDataTransfer();

    dataTransfer.setData(
      "application/x-anarlog-session-context",
      JSON.stringify({ sessionId: "session-1" }),
    );

    fireEvent.dragOver(container!, { dataTransfer });
    fireEvent.drop(container!, { dataTransfer });

    expect(dataTransfer.dropEffect).toBe("copy");
    expect(onAddContextEntity).toHaveBeenCalledWith({
      kind: "session",
      key: "session:manual:session-1",
      source: "manual",
      sessionId: "session-1",
    });
  });

  it("queues messages submitted while streaming", () => {
    const handleSendMessage = vi.fn();
    const sendMessage = vi.fn();

    render(
      <ChatContent
        sessionId="active-session"
        messages={[]}
        sendMessage={sendMessage}
        regenerate={vi.fn()}
        stop={vi.fn()}
        status="streaming"
        model={{} as never}
        handleSendMessage={handleSendMessage}
        pendingRefs={[]}
        isSystemPromptReady
      />,
    );

    fireEvent.click(screen.getByTestId("chat-input"));

    expect(screen.getByText("Queued follow-up")).toBeTruthy();
    expect(handleSendMessage).not.toHaveBeenCalled();
  });

  it("removes queued messages before they are sent", () => {
    const handleSendMessage = vi.fn();
    const { rerender } = render(
      <ChatContent
        sessionId="active-session"
        messages={[]}
        sendMessage={vi.fn()}
        regenerate={vi.fn()}
        stop={vi.fn()}
        status="streaming"
        model={{} as never}
        handleSendMessage={handleSendMessage}
        pendingRefs={[]}
        isSystemPromptReady
      />,
    );

    fireEvent.click(screen.getByTestId("chat-input"));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove queued message: Queued follow-up",
      }),
    );

    expect(screen.queryByText("Queued follow-up")).toBeNull();

    rerender(
      <ChatContent
        sessionId="active-session"
        messages={[]}
        sendMessage={vi.fn()}
        regenerate={vi.fn()}
        stop={vi.fn()}
        status="ready"
        model={{} as never}
        handleSendMessage={handleSendMessage}
        pendingRefs={[]}
        isSystemPromptReady
      />,
    );

    expect(handleSendMessage).not.toHaveBeenCalled();
  });

  it("sends the next queued message when the chat becomes ready", async () => {
    const handleSendMessage = vi.fn();
    const sendMessage = vi.fn();
    const { rerender } = render(
      <ChatContent
        sessionId="active-session"
        messages={[]}
        sendMessage={sendMessage}
        regenerate={vi.fn()}
        stop={vi.fn()}
        status="streaming"
        model={{} as never}
        handleSendMessage={handleSendMessage}
        pendingRefs={[
          { kind: "session", key: "session:auto", sessionId: "s1" },
        ]}
        isSystemPromptReady
      />,
    );

    fireEvent.click(screen.getByTestId("chat-input"));

    rerender(
      <ChatContent
        sessionId="active-session"
        messages={[]}
        sendMessage={sendMessage}
        regenerate={vi.fn()}
        stop={vi.fn()}
        status="ready"
        model={{} as never}
        handleSendMessage={handleSendMessage}
        pendingRefs={[]}
        isSystemPromptReady
      />,
    );

    await waitFor(() => {
      expect(handleSendMessage).toHaveBeenCalledWith(
        "Queued follow-up",
        [{ type: "text", text: "Queued follow-up" }],
        sendMessage,
        [{ kind: "session", key: "session:auto", sessionId: "s1" }],
      );
    });
  });

  it("continues dequeueing if a send does not enter a busy state", async () => {
    const handleSendMessage = vi.fn();
    const sendMessage = vi.fn();
    const { rerender } = render(
      <ChatContent
        sessionId="active-session"
        messages={[]}
        sendMessage={sendMessage}
        regenerate={vi.fn()}
        stop={vi.fn()}
        status="streaming"
        model={{} as never}
        handleSendMessage={handleSendMessage}
        pendingRefs={[]}
        isSystemPromptReady
      />,
    );

    fireEvent.click(screen.getByTestId("chat-input"));
    fireEvent.click(screen.getByTestId("chat-input"));

    rerender(
      <ChatContent
        sessionId="active-session"
        messages={[]}
        sendMessage={sendMessage}
        regenerate={vi.fn()}
        stop={vi.fn()}
        status="ready"
        model={{} as never}
        handleSendMessage={handleSendMessage}
        pendingRefs={[]}
        isSystemPromptReady
      />,
    );

    await waitFor(() => {
      expect(handleSendMessage).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText("Queued follow-up")).toBeNull();
  });
});
