import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  openSearch: vi.fn(),
  copyTranscript: vi.fn(),
  openNew: vi.fn(),
  setSettingValues: vi.fn(),
  canResume: false,
  sessionMode: "inactive",
  platform: "macos",
}));

vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => mocks.platform }));

vi.mock("~/settings/queries", () => ({
  useSetSettingValues: () => mocks.setSettingValues,
}));

vi.mock("~/settings/general/main-language", () => ({
  MainLanguageView: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <button type="button" onClick={() => onChange("de")}>
      {`Main language ${value}`}
    </button>
  ),
}));

vi.mock("~/session/components/resume-recording", () => ({
  useCanResumeRecording: () => mocks.canResume,
  ResumeRecordingButton: ({ variant }: { variant: string }) => (
    <button type="button" aria-label="Resume recording" data-variant={variant}>
      Resume
    </button>
  ),
}));

vi.mock("~/shared/config", () => ({
  useConfigValue: (key: string) =>
    key === "ai_language" ? "en" : key === "spoken_languages" ? '["de"]' : "",
}));

vi.mock("~/store/zustand/tabs", () => ({
  useTabs: (selector: (state: unknown) => unknown) =>
    selector({ openNew: mocks.openNew }),
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
    selector({ getSessionMode: () => mocks.sessionMode }),
}));

import { TranscriptToolbar } from "./transcript-toolbar";

import type { EditorView } from "~/store/zustand/tabs/schema";

const summary = { type: "enhanced", id: "note-1" } as EditorView;
const transcript = { type: "transcript" } as EditorView;

// Fork: one h-8 row under the player with a way back to the summary
// (redline-oct3, H2).
describe("TranscriptToolbar", () => {
  afterEach(() => {
    cleanup();
    mocks.canResume = false;
    mocks.sessionMode = "inactive";
    mocks.platform = "macos";
    mocks.setSettingValues.mockClear();
    mocks.openNew.mockClear();
  });

  // Fork tests: journey-meeting P1 (Resume) and P3 (language in place).
  it("leaves Resume to the note's bottom bar once recording stops", () => {
    mocks.canResume = true;
    render(<TranscriptToolbar sessionId="session-1" editMode={false} />);

    expect(
      screen.queryByRole("button", { name: "Resume recording" }),
    ).toBeNull();
  });

  it("offers no Resume while recording or when it can't start", () => {
    mocks.canResume = true;
    mocks.sessionMode = "active";
    render(<TranscriptToolbar sessionId="session-1" editMode={false} />);
    expect(
      screen.queryByRole("button", { name: "Resume recording" }),
    ).toBeNull();
    cleanup();

    mocks.sessionMode = "inactive";
    mocks.canResume = false;
    render(<TranscriptToolbar sessionId="session-1" editMode={false} />);
    expect(
      screen.queryByRole("button", { name: "Resume recording" }),
    ).toBeNull();
  });

  it("keeps the view switch, language, search, edit and copy in one h-8 row", () => {
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
      "English +1",
      "Search transcript",
      "Edit transcript",
      "Copy transcript",
    ]);
  });

  // Microsoft Writing Style Guide, Keys and keyboard shortcuts.
  it.each([
    ["macos", "Search transcript (⌘F)", "Meta+F"],
    ["windows", "Search transcript (Ctrl+F)", "Control+F"],
  ])("names the find key on %s", (os, title, aria) => {
    mocks.platform = os;
    render(<TranscriptToolbar sessionId="session-1" editMode={false} />);

    const search = screen.getByRole("button", { name: "Search transcript" });
    expect(search.getAttribute("title")).toBe(title);
    expect(search.getAttribute("aria-keyshortcuts")).toBe(aria);
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

  // redline2-oct3 R2: a small switch with a quiet selected pill.
  it("draws a small switch with a quiet selected segment", () => {
    render(
      <TranscriptToolbar
        sessionId="session-1"
        editMode={false}
        editorTabs={[summary, transcript]}
        onSelectView={vi.fn()}
      />,
    );

    const selected = screen.getByRole("button", { name: "Transcript" });
    expect(selected.className).toContain("h-6");
    expect(selected.className).toContain("px-2");
    expect(selected.className).toContain("text-xs");
    expect(selected.className).toContain("bg-background");
    expect(selected.className).not.toContain("bg-foreground");
  });

  it("changes the language in place instead of opening Settings", async () => {
    render(<TranscriptToolbar sessionId="session-1" editMode={false} />);

    fireEvent.click(screen.getByRole("button", { name: "English +1" }));
    const picker = await screen.findByRole("button", {
      name: "Main language en",
    });
    expect(mocks.openNew).not.toHaveBeenCalled();

    fireEvent.click(picker);
    expect(mocks.setSettingValues).toHaveBeenCalledWith({
      ai_language: "de",
      spoken_languages: "[]",
    });
  });
});
