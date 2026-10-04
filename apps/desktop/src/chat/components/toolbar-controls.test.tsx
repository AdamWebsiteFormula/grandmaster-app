import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useRecentChatGroups: vi.fn(() => []),
}));

vi.mock("@anlg/ui/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@anlg/ui/components/ui/dropdown-menu", () => ({
  appFloatingMenuPanelClassName: "",
  AppFloatingPanel: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenu: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("~/chat/store/queries", () => ({
  useRecentChatGroups: mocks.useRecentChatGroups,
}));

import { ChatToolbarControls } from "./toolbar-controls";

describe("ChatToolbarControls", () => {
  beforeEach(() => {
    cleanup();
    mocks.useRecentChatGroups.mockClear();
  });

  it("wires layout-specific toolbar actions", () => {
    const onClose = vi.fn();
    const onOpenRightPanel = vi.fn();
    const onOpenFloating = vi.fn();
    const { rerender } = render(
      <ChatToolbarControls
        chatScope="general"
        currentChatGroupId={undefined}
        layout="floating"
        onClose={onClose}
        onNewChat={vi.fn()}
        onOpenFloating={onOpenFloating}
        onOpenRightPanel={onOpenRightPanel}
        onSelectChat={vi.fn()}
        surface="light"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Open in right panel" }),
    );

    expect(onOpenRightPanel).toHaveBeenCalledOnce();
    // Fork: icon-only buttons show a help tag (Apple HIG Offering help).
    expect(
      screen
        .getByRole("button", { name: "Open in right panel" })
        .getAttribute("title"),
    ).toBe("Open in right panel");
    expect(
      screen
        .getByRole("button", { name: "Chat history" })
        .getAttribute("title"),
    ).toBe("Chat history");
    // Fork: the floating chat has a close button too (ux-audit-oct3 D).
    fireEvent.click(screen.getByRole("button", { name: "Close chat" }));
    expect(onClose).toHaveBeenCalledOnce();
    onClose.mockClear();

    rerender(
      <ChatToolbarControls
        chatScope="general"
        currentChatGroupId={undefined}
        layout="right-panel"
        onClose={onClose}
        onNewChat={vi.fn()}
        onOpenFloating={onOpenFloating}
        onSelectChat={vi.fn()}
        surface="light"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Float chat" }));
    fireEvent.click(screen.getByRole("button", { name: "Close chat" }));

    expect(onOpenFloating).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("button", { name: "Open in right panel" }),
    ).toBeNull();
  });

  // Owner test, Oct 4: on the Chat page the conversation fills the page, so
  // the toolbar offers a way back instead of Float and Close.
  it("leads with All chats on the Chat page and drops Float and Close", () => {
    const onBack = vi.fn();
    render(
      <ChatToolbarControls
        chatScope="general"
        currentChatGroupId={undefined}
        layout="right-panel"
        onBack={onBack}
        onNewChat={vi.fn()}
        onSelectChat={vi.fn()}
        surface="light"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "All chats" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "New chat" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Float chat" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Close chat" })).toBeNull();
  });

  it("loads history for the active chat scope", () => {
    render(
      <ChatToolbarControls
        chatScope="automations"
        currentChatGroupId={undefined}
        onNewChat={vi.fn()}
        onOpenRightPanel={vi.fn()}
        onSelectChat={vi.fn()}
      />,
    );

    expect(mocks.useRecentChatGroups).toHaveBeenCalledWith("automations", 5);
  });
});
