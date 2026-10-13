import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  model: null as unknown,
  inferSummaryFormat: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("~/ai/hooks", () => ({
  useLanguageModel: () => mocks.model,
}));

vi.mock("./auto-format-inference", () => ({
  inferSummaryFormat: mocks.inferSummaryFormat,
  MAX_FORMAT_EXAMPLE_LENGTH: 10_000,
  MAX_FORMAT_EXAMPLES: 5,
}));

vi.mock("@anlg/ui/components/ui/toast", () => ({
  toast: { error: mocks.toastError },
}));

import { AutoFormatExamplesDialog } from "./auto-format-examples-dialog";

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  render(
    <AutoFormatExamplesDialog onClose={() => {}} onGenerated={() => {}} />,
    { wrapper },
  );
  fireEvent.change(
    screen.getByPlaceholderText("Paste a past summary you like"),
    {
      target: { value: "Decisions\n- Ship Friday" },
    },
  );
  fireEvent.click(screen.getByRole("button", { name: "Improve format" }));
}

describe("AutoFormatExamplesDialog errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.model = null;
  });

  afterEach(() => {
    cleanup();
  });

  it("says Upshot AI is getting ready when no model is loaded", async () => {
    renderDialog();

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Upshot AI is getting ready. Try again in a minute.",
      ),
    );
  });

  it("shows a plain line, not the raw error, when the model fails", async () => {
    mocks.model = {};
    mocks.inferSummaryFormat.mockRejectedValueOnce(
      new Error("429 rate_limit_exceeded: upstream"),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    renderDialog();

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Couldn't learn the format from these examples. Try again.",
      ),
    );
    expect(mocks.toastError).not.toHaveBeenCalledWith(
      expect.stringContaining("429"),
    );
  });
});
