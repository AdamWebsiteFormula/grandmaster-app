import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfigError } from "./config-error";

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  model: { modelId: "upshot" } as unknown,
}));

vi.mock("~/ai/contexts", () => ({
  useAITask: (
    selector: (state: { generate: typeof mocks.generate }) => unknown,
  ) => selector({ generate: mocks.generate }),
}));
vi.mock("~/ai/hooks", () => ({ useLanguageModel: () => mocks.model }));
vi.mock("~/session/queries", () => ({
  useEnhancedNote: () => ({ templateId: "template-1" }),
}));
vi.mock("~/store/zustand/ai-task/task-configs", () => ({
  createTaskId: () => "enhance-task",
}));

describe("ConfigError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("says Upshot AI is getting ready as a status with Try again", () => {
    render(<ConfigError sessionId="session-1" enhancedNoteId="note-1" />);

    expect(screen.getByRole("status")).not.toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Upshot AI is getting ready")).not.toBeNull();
    expect(
      screen.getByText(
        "Try again in a minute to turn this transcript into a summary.",
      ),
    ).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(mocks.generate).toHaveBeenCalledWith("enhance-task", {
      model: mocks.model,
      taskType: "enhance",
      args: {
        sessionId: "session-1",
        enhancedNoteId: "note-1",
        templateId: "template-1",
      },
    });
  });
});
