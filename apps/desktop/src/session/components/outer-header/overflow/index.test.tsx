import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OverflowButton } from "./index";

import { openFloatingMeetingPanel } from "~/meeting-float/host";
import type { EditorView } from "~/store/zustand/tabs/schema";

const {
  uploadAudioMock,
  uploadTranscriptMock,
  regenerateTranscriptMock,
  audioExists,
  audioExistsResolved,
  currentNoteContent,
  useHasTranscriptMock,
  useListenerMock,
  useConfigValueMock,
  platformMock,
  windowShowMock,
  copyTranscriptMock,
  requestDeleteRecordingMock,
  canCopyTranscript,
} = vi.hoisted(() => ({
  copyTranscriptMock: vi.fn(),
  requestDeleteRecordingMock: vi.fn(),
  canCopyTranscript: { value: false },
  uploadAudioMock: vi.fn(),
  uploadTranscriptMock: vi.fn(),
  regenerateTranscriptMock: vi.fn(),
  audioExists: { value: false },
  audioExistsResolved: { value: true },
  currentNoteContent: { value: "" },
  useHasTranscriptMock: vi.fn(),
  useListenerMock: vi.fn(),
  useConfigValueMock: vi.fn(),
  platformMock: vi.fn(() => "macos"),
  windowShowMock: vi.fn(() => Promise.resolve({ status: "ok", data: null })),
}));

const summaryOffer = vi.hoisted(() => ({
  visible: false,
  generate: vi.fn(() => Promise.resolve()),
}));

vi.mock("~/session/components/note-input/generate-summary-offer", () => ({
  useGenerateSummaryOffer: () => ({ visible: summaryOffer.visible }),
  useGenerateSummaryAction: () => ({
    generate: summaryOffer.generate,
    pending: false,
  }),
}));

vi.mock("@tauri-apps/plugin-os", () => ({
  platform: platformMock,
}));

vi.mock("@anlg/ui/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@anlg/ui/components/ui/dropdown-menu", () => ({
  appFloatingMenuPanelClassName: "overflow-hidden p-1.5",
  AppFloatingPanel: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  DropdownMenuPortal: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuSub: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSubContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSubTrigger: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
      <span aria-hidden>›</span>
    </button>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("../audio-saved", () => ({
  AudioSavedMenuItem: () => (
    <button type="button">Audio saved on this Mac</button>
  ),
}));

vi.mock("./delete", () => ({
  DeleteNote: () => <button type="button">Delete note</button>,
}));

vi.mock("./listening", () => ({
  Listening: ({ resume }: { resume: boolean }) => (
    <button type="button">
      {resume ? "Resume listening" : "Start listening"}
    </button>
  ),
}));

vi.mock("./misc", () => ({
  ShowInFolder: () => <button type="button">Show in folder</button>,
}));

vi.mock("./lock-note", () => ({
  LockNote: () => <button type="button">Lock Note</button>,
}));

vi.mock("../metadata", () => ({
  MetadataPanelContent: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="meeting-info-popover">{sessionId}</div>
  ),
}));

vi.mock("~/meeting-float/host", () => ({
  openFloatingMeetingPanel: vi.fn(),
}));

vi.mock("~/audio-player", () => ({
  useAudioPlayer: () => ({
    audioExists: audioExists.value,
    audioExistsResolved: audioExistsResolved.value,
    requestDeleteRecording: requestDeleteRecordingMock,
  }),
}));

vi.mock("~/session/components/note-input/header-transcript", () => ({
  useCopyTranscript: () => ({
    canCopyTranscript: canCopyTranscript.value,
    copyTranscript: copyTranscriptMock,
  }),
}));

vi.mock("~/session/components/note-input/transcript/actions", () => ({
  useRegenerateTranscript: () => regenerateTranscriptMock,
}));

vi.mock("@anlg/plugin-windows", () => ({
  commands: {
    windowShow: windowShowMock,
  },
}));

vi.mock("~/session/components/shared", () => ({
  useCurrentNoteHasContent: () => currentNoteContent.value.trim().length > 0,
  useHasTranscript: useHasTranscriptMock,
}));

vi.mock("~/shared/config", () => ({
  useConfigValue: useConfigValueMock,
}));

vi.mock("~/stt/contexts", () => ({
  useListener: useListenerMock,
}));

vi.mock("~/stt/useUploadFile", () => ({
  useUploadFile: vi.fn(() => ({
    uploadAudio: uploadAudioMock,
    uploadTranscript: uploadTranscriptMock,
  })),
}));

type Scenario = {
  transcript?: boolean;
  content?: string;
  audio?: boolean;
  audioResolved?: boolean;
  mode?: string;
  floatingPanel?: boolean;
  platform?: string;
};

const ACTIONS = [
  "Upload audio",
  "Upload transcript",
  "Start listening",
  "Resume listening",
  "Transcribe again",
  "Open floating panel",
  "Copy transcript",
  "Open in new window",
  "Delete recording",
  "Delete note",
] as const;

function arrange({
  transcript = true,
  content = "",
  audio = false,
  audioResolved = true,
  mode = "inactive",
  floatingPanel = false,
  platform = "macos",
}: Scenario) {
  useHasTranscriptMock.mockReturnValue(transcript);
  currentNoteContent.value = content;
  audioExists.value = audio;
  audioExistsResolved.value = audioResolved;
  useConfigValueMock.mockReturnValue(floatingPanel);
  platformMock.mockReturnValue(platform);
  useListenerMock.mockImplementation((selector) =>
    selector({ getSessionMode: () => mode, stop: vi.fn() }),
  );
}

function renderOverflow(
  props: Partial<React.ComponentProps<typeof OverflowButton>> = {},
) {
  return render(
    <OverflowButton
      sessionId="session-1"
      currentView={{ type: "enhanced", id: "note-1" } as EditorView}
      {...props}
    />,
  );
}

function visibleActions() {
  return ACTIONS.filter((name) => screen.queryByRole("button", { name }));
}

describe("OverflowButton", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    summaryOffer.visible = false;
    arrange({});
  });

  // Fork tests: installed-build review Oct 3 (P1: nothing in ⋯ made a
  // summary after Stop).
  it("offers Generate summary when the note has no summary", () => {
    summaryOffer.visible = true;
    renderOverflow({ currentView: { type: "raw" } as EditorView });

    fireEvent.click(screen.getByRole("button", { name: "Generate summary" }));
    expect(summaryOffer.generate).toHaveBeenCalledTimes(1);
  });

  it("leaves Generate summary out once a summary exists or while recording", () => {
    renderOverflow();
    expect(
      screen.queryByRole("button", { name: "Generate summary" }),
    ).toBeNull();
  });

  it.each<
    [
      string,
      Scenario,
      Partial<React.ComponentProps<typeof OverflowButton>>,
      string[],
    ]
  >([
    [
      "empty note without a recording",
      { transcript: false },
      {},
      [
        "Upload audio",
        "Upload transcript",
        "Start listening",
        "Open in new window",
        "Delete note",
      ],
    ],
    [
      "note with content",
      { transcript: false, content: "Existing content" },
      {},
      ["Start listening", "Open in new window", "Delete note"],
    ],
    [
      "pending audio lookup",
      { transcript: false, audio: true, audioResolved: false },
      {},
      ["Resume listening", "Open in new window", "Delete note"],
    ],
    [
      "transcript without a recording",
      {},
      {},
      ["Resume listening", "Open in new window", "Delete note"],
    ],
    [
      "recorded audio",
      { transcript: false, audio: true },
      {},
      [
        "Resume listening",
        "Transcribe again",
        "Open in new window",
        "Delete recording",
        "Delete note",
      ],
    ],
    [
      "active listening",
      { transcript: false, mode: "active", floatingPanel: true },
      {},
      [
        "Start listening",
        "Open floating panel",
        "Open in new window",
        "Delete note",
      ],
    ],
    [
      "finalizing",
      { audio: true, mode: "finalizing", floatingPanel: true },
      {},
      ["Resume listening", "Open in new window", "Delete note"],
    ],
    [
      "batch transcription",
      { audio: true, mode: "running_batch" },
      {},
      ["Resume listening", "Open in new window", "Delete note"],
    ],
    [
      "listening disabled",
      { mode: "active", floatingPanel: true },
      { allowListening: false },
      ["Open in new window", "Delete note"],
    ],
    [
      "standalone window",
      {},
      { standaloneWindow: true },
      ["Resume listening", "Delete note"],
    ],
  ])("offers the right actions for %s", (_label, scenario, props, expected) => {
    arrange(scenario);
    renderOverflow(props);

    expect(visibleActions()).toEqual(expected);
  });

  it("uploads audio and transcripts into an empty note", () => {
    arrange({ transcript: false });
    renderOverflow();

    fireEvent.click(screen.getByRole("button", { name: "Upload audio" }));
    fireEvent.click(screen.getByRole("button", { name: "Upload transcript" }));

    expect(uploadAudioMock).toHaveBeenCalledTimes(1);
    expect(uploadTranscriptMock).toHaveBeenCalledTimes(1);
  });

  it("copies the transcript and asks before deleting the recording from the menu", () => {
    arrange({ transcript: true, audio: true });
    canCopyTranscript.value = true;
    renderOverflow();

    fireEvent.click(screen.getByRole("button", { name: "Copy transcript" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete recording" }));

    expect(copyTranscriptMock).toHaveBeenCalledTimes(1);
    expect(requestDeleteRecordingMock).toHaveBeenCalledTimes(1);
    canCopyTranscript.value = false;
  });

  it("asks before re-transcribing recorded audio", () => {
    arrange({ transcript: false, audio: true });
    renderOverflow();

    fireEvent.click(screen.getByRole("button", { name: "Transcribe again" }));

    expect(regenerateTranscriptMock).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("Transcribe this recording again?"),
    ).toBeTruthy();
    expect(
      within(dialog).getByText(
        "This replaces the current transcript, including your edits and speaker names.",
      ),
    ).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Transcribe again" }),
    );

    expect(regenerateTranscriptMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the transcript when Transcribe again is canceled", () => {
    arrange({ transcript: false, audio: true });
    renderOverflow();

    fireEvent.click(screen.getByRole("button", { name: "Transcribe again" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancel",
      }),
    );

    expect(regenerateTranscriptMock).not.toHaveBeenCalled();
  });

  it.each(["macos", "linux"])(
    "opens the floating panel while actively listening on %s",
    (platform) => {
      arrange({ mode: "active", floatingPanel: true, platform });
      renderOverflow();

      fireEvent.click(
        screen.getByRole("button", { name: "Open floating panel" }),
      );

      expect(openFloatingMeetingPanel).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: "session-1", enabled: true }),
      );
    },
  );

  it("opens the current note in a standalone window", () => {
    renderOverflow();

    fireEvent.click(screen.getByRole("button", { name: "Open in new window" }));

    expect(windowShowMock).toHaveBeenCalledWith({
      type: "note",
      value: "session-1",
    });
  });

  // Fork: sharing lives in Share only (redline-oct3, H2).
  it("leaves copy, email and export to the Share menu", () => {
    renderOverflow();

    expect(screen.queryByRole("button", { name: "Copy notes" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Send notes via email" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Export…" })).toBeNull();
  });

  // granola-compare-oct3 §5: the note, then the recording, Delete note last.
  it("orders the menu like Granola's: note, recording, delete", () => {
    arrange({ transcript: true, audio: true });
    canCopyTranscript.value = true;
    renderOverflow();

    const labels = Array.from(document.querySelectorAll("button, hr")).map(
      (element) =>
        element.tagName === "HR"
          ? "---"
          : (element.getAttribute("aria-label") ?? element.textContent ?? "")
              .replace("›", "")
              .trim(),
    );
    canCopyTranscript.value = false;

    expect(labels).toEqual([
      "More",
      "Version history",
      "Open in new window",
      "Show in folder",
      "Lock Note",
      "---",
      "Recording",
      "Resume listening",
      "Transcribe again",
      "Copy transcript",
      "Audio saved on this Mac",
      "---",
      "Delete recording",
      "---",
      "Delete note",
    ]);
  });
});
