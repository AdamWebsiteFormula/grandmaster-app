import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  model: { modelId: "upshot" } as unknown,
  toast: vi.fn(),
}));

vi.mock("@anlg/ui/components/ui/toast", () => ({ toast: mocks.toast }));
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

import { GenerateSummary } from "./generate-summary";

// Fork tests: journey-meeting P3 (model briefly missing).
describe("GenerateSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.model = { modelId: "upshot" };
  });

  afterEach(cleanup);

  it("generates with the note's template", () => {
    render(<GenerateSummary sessionId="session-1" enhancedNoteId="note-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Generate summary" }));

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

  it("stays enabled with no model and says why nothing ran", () => {
    mocks.model = null;
    render(<GenerateSummary sessionId="session-1" enhancedNoteId="note-1" />);

    const button = screen.getByRole("button", { name: "Generate summary" });
    expect(button.hasAttribute("disabled")).toBe(false);
    fireEvent.click(button);

    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      "Upshot AI is getting ready. Try again in a minute.",
      { id: "summary-model-not-ready" },
    );
  });
});
