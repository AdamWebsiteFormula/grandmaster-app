import { act, cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signInMocks = vi.hoisted(() => ({ openSignIn: vi.fn() }));
vi.mock("~/upshot-plan", () => ({ openUpshotSignIn: signInMocks.openSignIn }));

vi.mock("@anlg/plugin-opener2", () => ({
  commands: { openUrl: vi.fn() },
}));

vi.mock("~/chat/hooks/use-chat-appearance", () => ({
  useChatAppearance: () => ({
    isDarkAppearance: false,
    toolbarSurface: "light",
    panelClassName: "",
    panelBorderClassName: "",
    elevatedSurfaceClassName: "",
    inputEditorClassName: "",
  }),
}));

vi.mock("~/env", () => ({
  env: { VITE_APP_URL: "http://localhost:3000" },
}));

import { ErrorMessage, getChatErrorText } from "./error";

import {
  resetUpshotAccountForTests,
  SIGN_IN_REQUIRED,
  UpshotRequestError,
  useUpshotAccount,
} from "~/upshot-plan/session";

describe("ErrorMessage", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders a bare string rejection instead of crashing", () => {
    // Tauri `invoke` rejects with the serialized Rust error, which is a plain
    // string; the AI SDK stores it as `useChat().error` as-is.
    render(<ErrorMessage error="cloudsync_activity_drain_timeout" />);

    expect(screen.getByText("cloudsync_activity_drain_timeout")).toBeTruthy();
  });
});

describe("getChatErrorText", () => {
  it("normalizes non-Error values to a string", () => {
    expect(getChatErrorText(new Error("boom"))).toBe("boom");
    expect(getChatErrorText("boom")).toBe("boom");
    expect(getChatErrorText(42)).toBe("42");
    expect(getChatErrorText(undefined)).toBe("undefined");
  });
});

// Fork: no upstream docs link; plain words for a context-length error
// (ux-audit-oct3 D).
describe("ErrorMessage context length", () => {
  beforeEach(() => {
    cleanup();
  });

  it("says to start a new chat and shows a visible Retry", () => {
    const onRetry = vi.fn();
    render(
      <ErrorMessage
        error={new Error("This model's context length is 8192 tokens")}
        onRetry={onRetry}
      />,
    );

    expect(
      screen.getByText(
        "This chat is too long. Start a new chat and try again.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Learn how to fix this")).toBeNull();
    screen.getByRole("button", { name: "Retry" }).click();
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

// Fork: Upshot AI needs a free account. Signed out, the sign-in error offers
// Sign in, not a Retry that cannot work.
describe("ErrorMessage sign-in required", () => {
  beforeEach(() => {
    cleanup();
    signInMocks.openSignIn.mockClear();
    resetUpshotAccountForTests();
  });

  it("signed out, shows Sign in instead of Retry and opens the dialog", () => {
    const onRetry = vi.fn();
    render(
      <ErrorMessage
        error={
          new UpshotRequestError(SIGN_IN_REQUIRED, 401, "sign_in_required")
        }
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText(SIGN_IN_REQUIRED)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    screen.getByRole("button", { name: "Sign in" }).click();
    expect(signInMocks.openSignIn).toHaveBeenCalledTimes(1);
    expect(signInMocks.openSignIn).toHaveBeenCalledWith("hosted");
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("recognizes the sign-in error from its message alone", () => {
    render(<ErrorMessage error={SIGN_IN_REQUIRED} onRetry={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("once signed in, brings Retry back", () => {
    render(<ErrorMessage error={SIGN_IN_REQUIRED} onRetry={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();

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

    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("other errors keep Retry and show no Sign in", () => {
    render(<ErrorMessage error={new Error("boom")} onRetry={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
  });

  it("signed out with no retry still offers Sign in", () => {
    render(<ErrorMessage error={SIGN_IN_REQUIRED} />);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
  });
});
