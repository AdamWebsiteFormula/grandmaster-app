import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfigError } from "./config-error";

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  model: { modelId: "upshot" } as unknown,
  toast: vi.fn(),
  llmStatus: { status: "pending", reason: "missing_model" } as unknown,
  signedIn: false,
  openSignIn: vi.fn(),
}));

vi.mock("@anlg/ui/components/ui/toast", () => ({
  toast: mocks.toast,
}));

vi.mock("~/ai/contexts", () => ({
  useAITask: (
    selector: (state: { generate: typeof mocks.generate }) => unknown,
  ) => selector({ generate: mocks.generate }),
}));
vi.mock("~/ai/hooks", () => ({
  useLanguageModel: () => mocks.model,
  useLLMConnectionStatus: () => mocks.llmStatus,
}));
vi.mock("~/upshot-plan", () => ({ openUpshotSignIn: mocks.openSignIn }));
vi.mock("~/upshot-plan/session", () => ({
  useUpshotAccount: (select: (state: { session: unknown }) => unknown) =>
    select({ session: mocks.signedIn ? {} : null }),
}));
vi.mock("~/session/queries", () => ({
  useEnhancedNote: () => ({ templateId: "template-1" }),
}));
vi.mock("~/store/zustand/ai-task/task-configs", () => ({
  createTaskId: () => "enhance-task",
}));

describe("ConfigError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.model = { modelId: "upshot" };
    mocks.llmStatus = { status: "pending", reason: "missing_model" };
    mocks.signedIn = false;
  });

  // Fork test: task test, Oct 8 (signed out, Try again looped on "getting
  // ready").
  it("asks a signed-out user to sign in instead of waiting", () => {
    mocks.llmStatus = {
      status: "error",
      reason: "unauthenticated",
      providerId: "anarlog",
    };
    render(<ConfigError sessionId="session-1" enhancedNoteId="note-1" />);

    expect(screen.getByText("Sign in to write this summary")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(mocks.openSignIn).toHaveBeenCalledWith("hosted");
  });

  // Fork test: journey-meeting P3 (model briefly missing).
  it("keeps Try again enabled with no model and says why nothing ran", () => {
    mocks.model = null;
    render(<ConfigError sessionId="session-1" enhancedNoteId="note-1" />);

    const button = screen.getByRole("button", { name: "Try again" });
    expect(button.hasAttribute("disabled")).toBe(false);
    fireEvent.click(button);

    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      "Upshot AI is getting ready. Try again in a minute.",
      { id: "summary-model-not-ready" },
    );
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
