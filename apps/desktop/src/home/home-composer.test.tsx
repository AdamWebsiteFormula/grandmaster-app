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
  platform: "macos",
  model: { modelId: "upshot" } as unknown,
  llmStatus: { status: "success" } as unknown,
  toast: vi.fn(),
  openSignIn: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => mocks.platform }));

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
vi.mock("~/ai/hooks", () => ({
  useLanguageModel: () => mocks.model,
  useLLMConnectionStatus: () => mocks.llmStatus,
}));
vi.mock("@anlg/ui/components/ui/toast", () => ({ toast: mocks.toast }));
vi.mock("~/upshot-plan", () => ({ openUpshotSignIn: mocks.openSignIn }));
vi.mock("~/upshot-plan/session", () => ({
  useUpshotAccount: (select: (state: { session: unknown }) => unknown) =>
    select({ session: null }),
}));

import { HomeComposer } from "./home-composer";

describe("HomeComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chat.mode = "FloatingClosed";
    mocks.groups = [];
    mocks.platform = "macos";
    mocks.model = { modelId: "upshot" };
    mocks.llmStatus = { status: "success" };
  });
  afterEach(cleanup);

  // Microsoft Writing Style Guide, Keys and keyboard shortcuts: never ⌘
  // off a Mac.
  it("shows Ctrl+J off a Mac", () => {
    mocks.platform = "windows";
    render(<HomeComposer />);

    expect(screen.getByText("Ctrl+J")).toBeTruthy();
    expect(screen.queryByText("⌘ J")).toBeNull();
    expect(
      screen
        .getByRole("textbox", { name: "Ask anything" })
        .getAttribute("aria-keyshortcuts"),
    ).toBe("Control+J");
  });

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
    const send = screen.getByRole("button", { name: "Send" });
    // Fork: Send uses the brand accent (redline5-oct3).
    expect(send.className).toContain("bg-primary");
    fireEvent.click(send);
    expect(mocks.queueChatPrompt).toHaveBeenCalledWith("What's due Friday?");
    expect(mocks.chat.sendEvent).toHaveBeenCalledWith({ type: "OPEN" });
  });

  // Fork test: task test, Oct 8 (with no model the question was cleared
  // and sent later in another chat).
  it("keeps the question and says why when Upshot AI is not ready", () => {
    mocks.model = null;
    mocks.llmStatus = { status: "pending", reason: "missing_model" };
    render(<HomeComposer />);

    const input = screen.getByRole("textbox", {
      name: "Ask anything",
    }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "What is due Friday?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(mocks.queueChatPrompt).not.toHaveBeenCalled();
    expect(mocks.chat.sendEvent).not.toHaveBeenCalled();
    expect(input.value).toBe("What is due Friday?");
    expect(mocks.toast).toHaveBeenCalledTimes(1);
  });

  it("asks a signed-out user to sign in instead of sending", () => {
    mocks.model = null;
    mocks.llmStatus = {
      status: "error",
      reason: "unauthenticated",
      providerId: "anarlog",
    };
    render(<HomeComposer />);

    fireEvent.change(screen.getByRole("textbox", { name: "Ask anything" }), {
      target: { value: "What is due Friday?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(mocks.openSignIn).toHaveBeenCalledWith("hosted");
    expect(mocks.queueChatPrompt).not.toHaveBeenCalled();
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
