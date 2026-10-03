import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  openSearch: vi.fn(),
  copyTranscript: vi.fn(),
}));

vi.mock("./search/context", () => ({
  useSearch: () => ({ open: mocks.openSearch }),
}));

vi.mock("./header-transcript", () => ({
  useCopyTranscript: () => ({
    canCopyTranscript: true,
    copyTranscript: mocks.copyTranscript,
  }),
}));

vi.mock("~/session/components/shared", () => ({
  useHasTranscript: () => true,
}));

vi.mock("~/stt/contexts", () => ({
  useListener: (selector: (state: unknown) => unknown) =>
    selector({ getSessionMode: () => "inactive" }),
}));

import { TranscriptToolbar } from "./transcript-toolbar";

import type { EditorView } from "~/store/zustand/tabs/schema";

const summary = { type: "enhanced", id: "note-1" } as EditorView;
const transcript = { type: "transcript" } as EditorView;

// Fork: one h-8 row under the player with a way back to the summary
// (redline-oct3, H2).
describe("TranscriptToolbar", () => {
  afterEach(cleanup);

  it("keeps the view switch, search, edit and copy in one h-8 row", () => {
    render(
      <TranscriptToolbar
        sessionId="session-1"
        editMode={false}
        onEditModeChange={vi.fn()}
        editorTabs={[summary, transcript]}
        onSelectView={vi.fn()}
      />,
    );

    const toolbar = screen.getByRole("toolbar", { name: "Transcript" });
    expect(toolbar.className).toContain("h-8");
    expect(
      Array.from(toolbar.querySelectorAll("button")).map(
        (button) => button.getAttribute("aria-label") ?? button.textContent,
      ),
    ).toEqual([
      "Summary",
      "Transcript",
      "Search transcript",
      "Edit transcript",
      "Copy transcript",
    ]);
  });

  it("goes back to the summary", () => {
    const onSelectView = vi.fn();
    render(
      <TranscriptToolbar
        sessionId="session-1"
        editMode={false}
        editorTabs={[{ type: "raw" } as EditorView, summary, transcript]}
        onSelectView={onSelectView}
      />,
    );

    expect(screen.getByRole("button", { name: "Transcript" }).ariaPressed).toBe(
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Summary" }));

    expect(onSelectView).toHaveBeenCalledWith(summary);
  });
});
