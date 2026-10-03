import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
