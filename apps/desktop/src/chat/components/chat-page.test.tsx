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
  queueChatPrompt: vi.fn(),
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

  it("shows five recents, then all after See all", () => {
    mocks.groups = Array.from({ length: 7 }, (_, index) => group(index, index));
    render(<ChatPage />);

    expect(screen.getAllByRole("button", { name: /^Chat \d/ })).toHaveLength(5);
    const recents = screen
      .getByRole("heading", { name: "Recents" })
      .closest("section")!;
    fireEvent.click(within(recents).getByRole("button", { name: "See all" }));
    expect(screen.getAllByRole("button", { name: /^Chat \d/ })).toHaveLength(7);
    expect(
      within(recents).getByRole("button", { name: "Show less" }),
    ).toBeTruthy();
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

  it("sends the typed question on Enter", () => {
    render(<ChatPage />);

    const field = screen.getByRole("textbox", { name: "Ask anything" });
    fireEvent.change(field, { target: { value: "What did Bo promise?" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(mocks.queueChatPrompt).toHaveBeenCalledWith("What did Bo promise?");
  });
});

describe("chat page helpers", () => {
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
