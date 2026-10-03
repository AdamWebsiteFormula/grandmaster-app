import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  model: { modelId: "test-model" } as any,
  signIn: vi.fn(),
  toast: vi.fn(),
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
}));

vi.mock("~/auth", () => ({
  useAuth: () => ({ signIn: mocks.signIn }),
}));

vi.mock("~/session/queries", () => ({
  useEnhancedNote: () => ({ templateId: "template-1" }),
}));

vi.mock("~/store/zustand/ai-task/task-configs", () => ({
  createTaskId: () => "enhance-task",
}));

import { EnhanceError } from "./enhance-error";

function renderError(
  isUnauthenticated: boolean,
  error = new Error("AI generation did not return any text."),
) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <EnhanceError
        sessionId="session-1"
        enhancedNoteId="note-1"
        error={error}
        isUnauthenticated={isUnauthenticated}
      />
    </QueryClientProvider>,
  );
}

describe("EnhanceError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signIn.mockResolvedValue(undefined);
    mocks.model = { modelId: "test-model" };
  });

  afterEach(cleanup);

  it("explains that sign-in is required and opens sign-in", async () => {
    renderError(true);

    expect(screen.getByText("Sign in to generate this summary")).toBeTruthy();
    expect(
      screen.getByText(
        "Upshot could not generate this summary because you were not signed in. Sign in, then try again.",
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText("AI generation did not return any text."),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(mocks.signIn).toHaveBeenCalledOnce());
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("keeps the retry action for other generation failures", () => {
    renderError(false);

    expect(screen.getByText("Summary generation failed")).toBeTruthy();
    expect(
      screen.getByText("Upshot couldn't write this summary. Click Retry."),
    ).toBeTruthy();
    expect(
      screen.getByText("AI generation did not return any text."),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(mocks.generate).toHaveBeenCalledWith("enhance-task", {
      model: mocks.model,
      taskType: "enhance",
      args: {
        sessionId: "session-1",
        enhancedNoteId: "note-1",
        templateId: "template-1",
      },
    });
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  // Fork tests: journey-meeting P3 (413, 402, model briefly missing).
  it("says what to do when the meeting is too long, without a Retry that can't help", () => {
    renderError(false, new Error("This meeting is too long for Upshot AI."));

    expect(
      screen.getByText(
        "This meeting is too long for one summary. Try a shorter template, or ask in chat.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(
      screen.queryByText("This meeting is too long for Upshot AI."),
    ).toBeNull();
  });

  it("says Upshot AI is paused when out of credit and keeps Retry", () => {
    renderError(
      false,
      new Error("Upshot AI is out of credit for now. Try again later."),
    );

    expect(
      screen.getByText("Upshot AI is paused for now. Try again later."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("keeps Retry enabled with no model and says why nothing ran", () => {
    mocks.model = null;
    renderError(false);

    const retry = screen.getByRole("button", { name: "Retry" });
    expect(retry.hasAttribute("disabled")).toBe(false);
    fireEvent.click(retry);

    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      "Upshot AI is getting ready. Try again in a minute.",
      { id: "summary-model-not-ready" },
    );
  });

  it("explains a network failure in plain words", () => {
    renderError(false, new TypeError("Failed to fetch"));

    expect(
      screen.getByText(
        "Upshot can't reach the internet. Check your connection, then click Retry.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Failed to fetch")).toBeTruthy();
  });
});
