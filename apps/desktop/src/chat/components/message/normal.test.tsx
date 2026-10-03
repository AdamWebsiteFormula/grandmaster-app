import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ copy: vi.fn() }));

vi.mock("~/session/components/note-input/header-shared", () => ({
  copyTextToClipboard: mocks.copy,
}));

import { NormalMessage } from "./normal";

import type { AnlgUIMessage } from "~/chat/types";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const email = {
  id: "assistant-1",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "# Follow-up\n\n**Next steps:** ship Tuesday",
      state: "done",
    },
  ],
} as AnlgUIMessage;

// Fork: journey-after P2 "Draft follow-up email": Copy writes HTML so the
// draft pastes formatted into Gmail or Outlook.
describe("NormalMessage copy", () => {
  it("copies the answer as HTML and Markdown", async () => {
    mocks.copy.mockResolvedValue(true);
    render(<NormalMessage message={email} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy message" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy(),
    );
    expect(mocks.copy).toHaveBeenCalledWith(
      "# Follow-up\n\n**Next steps:** ship Tuesday",
      undefined,
      { html: true },
    );
  });

  it("does not say Copied when the clipboard write fails", async () => {
    mocks.copy.mockResolvedValue(false);
    render(<NormalMessage message={email} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy message" }));

    await waitFor(() => expect(mocks.copy).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Copied" })).toBeNull();
  });
});
