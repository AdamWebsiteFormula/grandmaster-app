import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  chat: {
    mode: "FloatingClosed",
    startNewChat: vi.fn(),
    sendEvent: vi.fn(),
  },
  queueChatPrompt: vi.fn(),
}));

vi.mock("~/contexts/shell", () => ({ useShell: () => ({ chat: mocks.chat }) }));
vi.mock("~/chat/pending-prompt", () => ({
  queueChatPrompt: mocks.queueChatPrompt,
}));

import { FolderAskComposer } from "./folder-ask";

// Fork: journey-after P2 "Folder page": a scoped "Ask anything".
describe("FolderAskComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chat.mode = "FloatingClosed";
  });
  afterEach(cleanup);

  it("asks about the folder in a new chat", () => {
    render(<FolderAskComposer folderPath="Clients/Acme" />);

    const field = screen.getByRole("textbox", {
      name: "Ask about this folder",
    });
    expect(field.getAttribute("placeholder")).toBe("Ask about notes in Acme…");
    const send = screen.getByRole("button", { name: "Send" });
    expect(send.hasAttribute("disabled")).toBe(true);
    expect(send.className).toContain("bg-foreground");

    fireEvent.change(field, { target: { value: "  What did we decide?  " } });
    // Fork: with text, Send takes the brand accent (redline5-oct3).
    expect(send.className).toContain("bg-primary");
    fireEvent.submit(field.closest("form")!);

    expect(mocks.chat.startNewChat).toHaveBeenCalledOnce();
    expect(mocks.queueChatPrompt).toHaveBeenCalledWith("What did we decide?");
    expect(mocks.chat.sendEvent).toHaveBeenCalledWith({ type: "OPEN" });
    expect((field as HTMLInputElement).value).toBe("");
  });

  it("ignores an empty question", () => {
    render(<FolderAskComposer folderPath="Work" />);
    fireEvent.submit(
      screen
        .getByRole("textbox", { name: "Ask about this folder" })
        .closest("form")!,
    );
    expect(mocks.queueChatPrompt).not.toHaveBeenCalled();
  });

  it("steps aside while a chat is open", () => {
    mocks.chat.mode = "FloatingOpen";
    render(<FolderAskComposer folderPath="Work" />);
    expect(
      screen.queryByRole("textbox", { name: "Ask about this folder" }),
    ).toBeNull();
  });
});
