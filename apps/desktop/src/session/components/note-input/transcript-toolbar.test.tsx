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

// Fork: one h-8 row under the player (redline-oct3, H2); the way back to
// the summary is the bar's Transcript button (owner test, Oct 4).
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

  // Owner test, Oct 4: no Summary / Transcript switch here; the bar's one
  // Transcript button switches views, as in Granola.
  it("keeps language, search, edit and copy in one h-8 row, with no view switch", () => {
    render(
      <TranscriptToolbar
        sessionId="session-1"
        editMode={false}
        onEditModeChange={vi.fn()}
      />,
    );

    const toolbar = screen.getByRole("toolbar", { name: "Transcript" });
    expect(toolbar.className).toContain("h-8");
    expect(
      Array.from(toolbar.querySelectorAll("button")).map(
        (button) => button.getAttribute("aria-label") ?? button.textContent,
      ),
    ).toEqual([
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
