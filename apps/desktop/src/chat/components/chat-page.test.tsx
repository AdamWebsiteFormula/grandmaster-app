import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  chat: {
    scope: "general",
    mode: "FloatingClosed" as string,
    sendEvent: vi.fn(),
    startNewChat: vi.fn(),
    selectChat: vi.fn(),
  },
  groups: [] as {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    ownerUserId: string;
  }[],
  email: null as string | null,
  profileName: null as string | null,
  queueChatPrompt: vi.fn(),
  sessionProps: { messages: [] } as unknown,
}));

vi.mock("~/auth", () => ({ useOptionalAuth: () => null }));
vi.mock("~/shared/owner-user", () => ({ useOwnerUserId: () => "me" }));
vi.mock("~/contacts/queries", () => ({
  usePersonalContact: () => ({
    data: mocks.profileName === null ? null : { name: mocks.profileName },
  }),
}));

vi.mock("~/contexts/shell", () => ({
  useShell: () => ({ chat: mocks.chat }),
}));
vi.mock("~/chat/store/queries", () => ({
  useChatGroups: () => mocks.groups,
}));
vi.mock("~/chat/pending-prompt", () => ({
  queueChatPrompt: mocks.queueChatPrompt,
}));
vi.mock("~/chat/components/input/model-menu", () => ({
  ChatModelMenu: () => <button type="button">Auto</button>,
}));
vi.mock("~/chat/components/chat-panel", () => ({
  ChatPanelFrame: ({
    layout,
    onBack,
    sessionProps,
  }: {
    layout?: string;
    onBack?: () => void;
    sessionProps: unknown;
  }) => (
    <button
      type="button"
      data-testid="chat-conversation"
      data-layout={layout}
      data-has-session={String(sessionProps === mocks.sessionProps)}
      onClick={onBack}
    >
      All chats
    </button>
  ),
}));
vi.mock("~/chat/components/session-props-context", () => ({
  useChatSessionProps: () => mocks.sessionProps,
}));
vi.mock("~/shared/main", () => ({
  StandardContentWrapper: ({ children }: { children: React.ReactNode }) =>
    children,
}));
vi.mock("~/upshot-plan/session", () => ({
  ensureUpshotSessionLoaded: () => Promise.resolve(),
  useUpshotAccount: (
    selector: (state: { session: { email: string } | null }) => unknown,
  ) => selector({ session: mocks.email ? { email: mocks.email } : null }),
}));

import {
  ChatPage,
  compactAge,
  firstNameFromEmail,
  firstNameFromProfile,
  TabContentChat,
} from "./chat-page";

const group = (index: number, hoursAgo: number) => {
  const at = new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
  return {
    id: `chat-${index}`,
    title: `Chat ${index}`,
    createdAt: at,
    updatedAt: at,
    ownerUserId: "me",
  };
};

describe("ChatPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.groups = [];
    mocks.email = null;
    mocks.profileName = null;
    mocks.chat.mode = "FloatingClosed";
  });
  afterEach(cleanup);

  it("greets by first name when signed in", () => {
    mocks.email = "adam.willingham@project-go.com";
    render(<TabContentChat />);

    expect(
      screen.getByRole("heading", { name: "Hi Adam, ask anything" }),
    ).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Ask anything" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Auto" })).toBeTruthy();
  });

  it("says Ask anything when signed out and hides Recents until a chat exists", () => {
    render(<ChatPage />);

    expect(screen.getByRole("heading", { name: "Ask anything" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Recents" })).toBeNull();
    expect(screen.queryByText("Your chats show up here")).toBeNull();
  });

  it("lists recent chats with ages and opens one in the chat panel", () => {
    mocks.groups = [group(1, 23), group(2, 30)];
    render(<ChatPage />);

    expect(screen.getByRole("heading", { name: "Recents" })).toBeTruthy();
    const row = screen.getByRole("button", { name: /Chat 1/ });
    expect(row.textContent).toContain("23h");
    expect(
      screen.getByRole("button", { name: /Chat 2/ }).textContent,
    ).toContain("1d");
    expect(
      screen
        .getAllByRole("button", { name: /See all/ })
        .map((button) =>
          button.closest("[role=group]")?.getAttribute("aria-label"),
        ),
    ).toEqual(["Recipes"]);

    fireEvent.click(row);
    expect(mocks.chat.selectChat).toHaveBeenCalledWith("chat-1");
    expect(mocks.chat.sendEvent).toHaveBeenCalledWith({
      type: "OPEN_RIGHT_PANEL",
    });
  });

  it("shows three recents, then all after See all", () => {
    mocks.groups = Array.from({ length: 7 }, (_, index) => group(index, index));
    render(<ChatPage />);

    expect(screen.getAllByRole("button", { name: /^Chat \d/ })).toHaveLength(3);
    const recents = screen
      .getByRole("heading", { name: "Recents" })
      .closest("section")!;
    const seeAll = within(recents).getByRole("button", { name: "See all" });
    // Right-aligned on the heading row, as Granola's Chat page Recents.
    expect(seeAll.parentElement?.className).toContain("justify-between");
    expect(seeAll.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(seeAll);
    expect(screen.getAllByRole("button", { name: /^Chat \d/ })).toHaveLength(7);
    expect(
      within(recents)
        .getByRole("button", { name: "Show less" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("shows three recipes and See all, which expands the rest", () => {
    render(<ChatPage />);

    const recipes = screen.getByRole("group", { name: "Recipes" });
    const labels = () =>
      Array.from(recipes.querySelectorAll("button")).map(
        (button) => button.textContent,
      );
    expect(labels()).toEqual([
      "What did I commit to this week?",
      "Summarize this week's meetings",
      "Prep me for my next meeting",
      "See all",
    ]);

    const seeAll = within(recipes).getByRole("button", { name: "See all" });
    expect(seeAll.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(seeAll);
    expect(labels()).toEqual([
      "What did I commit to this week?",
      "Summarize this week's meetings",
      "Prep me for my next meeting",
      "Draft follow-up email",
      "List action items",
      "Show less",
    ]);
  });

  it("sends a recipe's prompt in a new chat", () => {
    render(<ChatPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Prep me for my next meeting" }),
    );
    expect(mocks.chat.startNewChat).toHaveBeenCalled();
    expect(mocks.queueChatPrompt).toHaveBeenCalledWith(
      "Prep me for my next meeting",
    );
    expect(mocks.chat.sendEvent).toHaveBeenCalledWith({
      type: "OPEN_RIGHT_PANEL",
    });
  });

  // Fork: journey-after P3 "Chat page greeting".
  it("greets by the Profile name before the email", () => {
    mocks.profileName = "Taylor Brooks";
    mocks.email = "info@project-go.com";
    render(<ChatPage />);
    expect(
      screen.getByRole("heading", { name: "Hi Taylor, ask anything" }),
    ).toBeTruthy();
  });

  it("falls back to the email rule with an empty Profile name", () => {
    mocks.profileName = "   ";
    mocks.email = "adam@project-go.com";
    render(<ChatPage />);
    expect(
      screen.getByRole("heading", { name: "Hi Adam, ask anything" }),
    ).toBeTruthy();
  });

  // Fork: journey-after P1 "Chat page": one composer at a time.
  // Owner test, Oct 4: the conversation stays in the page, not the right
  // panel.
  it("shows an open chat in the page's own column, with All chats", () => {
    mocks.chat.mode = "RightPanelOpen";
    mocks.groups = [group(1, 1)];
    render(<ChatPage />);

    const conversation = screen.getByTestId("chat-conversation");
    expect(conversation.dataset.layout).toBe("page");
    expect(conversation.dataset.hasSession).toBe("true");
    expect(
      conversation.closest("[data-chat-page-conversation]"),
    ).not.toBeNull();
    expect(screen.queryByRole("heading", { name: "Recents" })).toBeNull();

    fireEvent.click(conversation);
    expect(mocks.chat.sendEvent).toHaveBeenCalledWith({ type: "CLOSE" });
  });

  it("hides the greeting and composer while a floating chat is open", () => {
    mocks.chat.mode = "FloatingOpen";
    mocks.groups = [group(1, 1)];
    render(<ChatPage />);

    expect(screen.queryByRole("textbox", { name: "Ask anything" })).toBeNull();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.getByRole("heading", { name: "Recents" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Recipes" })).toBeTruthy();
  });

  it("continues the open chat when a recipe is picked", () => {
    mocks.chat.mode = "FloatingOpen";
    render(<ChatPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Prep me for my next meeting" }),
    );
    expect(mocks.chat.startNewChat).not.toHaveBeenCalled();
    expect(mocks.queueChatPrompt).toHaveBeenCalledWith(
      "Prep me for my next meeting",
    );
  });

  // Fork: journey-after P3 "Chat page › Recents".
  it("ages a recent chat from its last message", () => {
    const created = new Date(Date.now() - 48 * 3_600_000).toISOString();
    const updated = new Date(Date.now() - 2 * 3_600_000).toISOString();
    mocks.groups = [
      { ...group(1, 48), createdAt: created, updatedAt: updated },
    ];
    render(<ChatPage />);
    expect(
      screen.getByRole("button", { name: /Chat 1/ }).textContent,
    ).toContain("2h");
  });

  it("sends the typed question on Enter", () => {
    render(<ChatPage />);

    const field = screen.getByRole("textbox", { name: "Ask anything" });
    fireEvent.change(field, { target: { value: "What did Bo promise?" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(mocks.queueChatPrompt).toHaveBeenCalledWith("What did Bo promise?");
  });
});

describe("chat page helpers", () => {
  it("takes a first name from a Profile name", () => {
    expect(firstNameFromProfile("Adam Willingham")).toBe("Adam");
    expect(firstNameFromProfile("  ")).toBeNull();
    expect(firstNameFromProfile(undefined)).toBeNull();
  });

  it("takes a first name from an email", () => {
    expect(firstNameFromEmail("adam@project-go.com")).toBe("Adam");
    expect(firstNameFromEmail("jane_doe@x.com")).toBe("Jane");
    expect(firstNameFromEmail("a1@x.com")).toBeNull();
    expect(firstNameFromEmail(null)).toBeNull();
  });

  it("formats compact ages", () => {
    const now = Date.UTC(2026, 9, 3, 12);
    expect(compactAge(now, now)).toBeNull();
    expect(compactAge(now - 12 * 60_000, now)).toBe("12m");
    expect(compactAge(now - 23 * 3_600_000, now)).toBe("23h");
    expect(compactAge(now - 2 * 86_400_000, now)).toBe("2d");
  });
});
