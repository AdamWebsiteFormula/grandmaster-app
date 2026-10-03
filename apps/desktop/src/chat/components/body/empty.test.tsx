import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/chat/hooks/use-chat-appearance", () => ({
  useChatAppearance: () => ({ isDarkAppearance: false }),
}));

import { ChatBodyEmpty } from "./empty";

// Fork: home chat starter prompts, as Granola recipes
// (docs.granola.ai/help-center/getting-more-from-your-notes/recipes).
describe("ChatBodyEmpty", () => {
  beforeEach(() => {
    cleanup();
  });

  it("shows three starter prompts on home chat, with no note open", () => {
    const onSendMessage = vi.fn();
    render(<ChatBodyEmpty hasContext={false} onSendMessage={onSendMessage} />);

    const chips = screen.getAllByRole("button");
    expect(chips.map((chip) => chip.textContent)).toEqual([
      "What did I commit to this week?",
      "Summarize this week's meetings",
      "Prep me for my next meeting",
    ]);

    fireEvent.click(
      screen.getByRole("button", { name: "Prep me for my next meeting" }),
    );
    expect(onSendMessage).toHaveBeenCalledWith("Prep me for my next meeting", [
      { type: "text", text: "Prep me for my next meeting" },
    ]);
  });

  it("shows note prompts without trailing periods when a note is open", () => {
    render(<ChatBodyEmpty hasContext />);

    const labels = screen
      .getAllByRole("button")
      .map((chip) => chip.textContent);
    expect(labels).toEqual([
      "List action items",
      "Draft follow-up email",
      "Find key decisions",
    ]);
  });
});
