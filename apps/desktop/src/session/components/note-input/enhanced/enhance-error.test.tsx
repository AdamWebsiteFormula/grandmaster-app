import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  model: { modelId: "test-model" } as any,
  openSignIn: vi.fn(),
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

vi.mock("~/upshot-plan", () => ({ openUpshotSignIn: mocks.openSignIn }));

vi.mock("~/session/queries", () => ({
  useEnhancedNote: () => ({ templateId: "template-1" }),
}));

vi.mock("~/store/zustand/ai-task/task-configs", () => ({
  createTaskId: () => "enhance-task",
}));

import { EnhanceError } from "./enhance-error";

import {
  resetUpshotAccountForTests,
  SIGN_IN_REQUIRED,
  UpshotRequestError,
  useUpshotAccount,
} from "~/upshot-plan/session";

function signIn() {
  act(() => {
    useUpshotAccount.setState({
      loaded: true,
      session: {
        access_token: "access",
        refresh_token: "refresh",
        expires_at: Date.now() / 1000 + 3600,
        email: "judge@example.com",
      },
    });
  });
}

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
    mocks.model = { modelId: "test-model" };
    resetUpshotAccountForTests();
  });

  afterEach(cleanup);

  it("explains that sign-in is required and opens sign-in", () => {
    renderError(true);

    expect(screen.getByText("Sign in to write this summary")).toBeTruthy();
    expect(
      screen.getByText(
        "Upshot AI needs a free account. Sign in, then try again.",
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText("AI generation did not return any text."),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    // Opens the Google or Microsoft dialog, saying Upshot AI asked for it.
    expect(mocks.openSignIn).toHaveBeenCalledTimes(1);
    expect(mocks.openSignIn).toHaveBeenCalledWith("hosted");
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("asks to sign in when the Worker's sign-in error comes back", () => {
    renderError(
      false,
      new UpshotRequestError(SIGN_IN_REQUIRED, 401, "sign_in_required"),
    );

    expect(screen.getByText("Sign in to write this summary")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(screen.queryByText(SIGN_IN_REQUIRED)).toBeNull();
  });

  it("asks to sign in for the app's own sign-in message too", () => {
    renderError(false, new Error(SIGN_IN_REQUIRED));

    expect(screen.getByText("Sign in to write this summary")).toBeTruthy();
  });

  // Fork: once the sign-in lands, the same card says so (NN/g #1).
  it("once signed in, says so and offers Try again", () => {
    renderError(true);
    expect(screen.getByText("Sign in to write this summary")).toBeTruthy();

    signIn();

    expect(screen.getByText("You're signed in")).toBeTruthy();
    expect(screen.getByText("Try again to write this summary.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mocks.generate).toHaveBeenCalledWith(
      "enhance-task",
      expect.objectContaining({ taskType: "enhance" }),
    );
    expect(mocks.openSignIn).not.toHaveBeenCalled();
  });

  // Fork: the button says "Try again", as the not-ready state does
  // (NN/g #4; Apple HIG, Alerts).
  it("keeps the Try again action for other generation failures", () => {
    renderError(false);

    expect(screen.getByText("Summary generation failed")).toBeTruthy();
    expect(
      screen.getByText("Upshot couldn't write this summary. Try again."),
    ).toBeTruthy();
    expect(
      screen.getByText("AI generation did not return any text."),
    ).toBeTruthy();

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
    expect(mocks.openSignIn).not.toHaveBeenCalled();
  });

  // Fork tests: journey-meeting P3 (413, 402, model briefly missing).
  it("says what to do when the meeting is too long, without a Try again that can't help", () => {
    renderError(false, new Error("This meeting is too long for Upshot AI."));

    expect(
      screen.getByText(
        "This meeting is too long for one summary. Try a shorter template, or ask in chat.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(
      screen.queryByText("This meeting is too long for Upshot AI."),
    ).toBeNull();
  });

  it("says Upshot AI is paused when out of credit and keeps Try again", () => {
    renderError(
      false,
      new Error("Upshot AI is out of credit for now. Try again later."),
    );

    expect(
      screen.getByText("Upshot AI is paused for now. Try again later."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("keeps Try again enabled with no model and says why nothing ran", () => {
    mocks.model = null;
    renderError(false);

    const retry = screen.getByRole("button", { name: "Try again" });
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
        "Upshot can't reach the internet. Check your connection, then try again.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Failed to fetch")).toBeTruthy();
  });
});
