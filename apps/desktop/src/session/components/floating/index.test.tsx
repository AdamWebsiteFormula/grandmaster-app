import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FloatingActionButton } from "./index";

import type { Tab } from "~/store/zustand/tabs";
import type { EditorView } from "~/store/zustand/tabs/schema";

const hoisted = vi.hoisted(() => ({
  sendEvent: vi.fn(),
  queueChatPrompt: vi.fn(),
  chatMode: "FloatingClosed",
  sessionMode: "inactive",
  hasTranscript: true,
  rawNote: "",
  canResume: true,
  recordingBarProps: vi.fn(),
  platform: "macos",
}));

vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => hoisted.platform }));

vi.mock("./recording-bar", () => ({
  RecordingBar: (props: unknown) => {
    hoisted.recordingBarProps(props);
    return null;
  },
}));

vi.mock("~/stt/contexts", () => ({
  useListener: (selector: (state: unknown) => unknown) =>
    selector({ getSessionMode: () => hoisted.sessionMode }),
}));

vi.mock("~/session/components/resume-recording", () => ({
  useCanResumeRecording: () => hoisted.canResume,
  ResumeRecordingButton: ({ variant }: { variant: string }) => (
    <button
      type="button"
      aria-label="Resume recording"
      data-resume-recording
      data-variant={variant}
    >
      Resume
    </button>
  ),
}));

vi.mock("~/session/components/shared", () => ({
  useHasTranscript: () => hoisted.hasTranscript,
  hasStoredNoteContent: (value: unknown) =>
    typeof value === "string" && value.trim().length > 0,
}));

vi.mock("~/session/queries", () => ({
  useSession: () => ({ raw_md: hoisted.rawNote }),
}));

vi.mock("~/contexts/shell", () => ({
  useShell: () => ({
    chat: { mode: hoisted.chatMode, sendEvent: hoisted.sendEvent },
  }),
}));

vi.mock("~/chat/pending-prompt", () => ({
  queueChatPrompt: hoisted.queueChatPrompt,
}));

const ENHANCED: EditorView = { type: "enhanced", id: "note-1" };
const RAW: EditorView = { type: "raw" };
const TRANSCRIPT: EditorView = { type: "transcript" };

describe("FloatingActionButton (note bar)", () => {
  const tab = {
    type: "sessions",
    id: "session-1",
    active: true,
    pinned: false,
    slotId: "slot-1",
    state: { view: null, autoStart: null },
  } as Extract<Tab, { type: "sessions" }>;

  const renderBar = (
    props: Partial<React.ComponentProps<typeof FloatingActionButton>> = {},
  ) =>
    render(
      <FloatingActionButton
        currentView={ENHANCED}
        editorTabs={[ENHANCED, RAW, TRANSCRIPT]}
        onSelectView={vi.fn()}
        tab={tab}
        {...props}
      />,
    );

  beforeEach(() => {
    hoisted.sendEvent.mockClear();
    hoisted.queueChatPrompt.mockClear();
    hoisted.chatMode = "FloatingClosed";
    hoisted.sessionMode = "inactive";
    hoisted.hasTranscript = true;
    hoisted.rawNote = "";
    hoisted.canResume = false;
    hoisted.recordingBarProps.mockClear();
    hoisted.platform = "macos";
  });

  // Fork tests: journey-meeting P1 (Resume), P2 (narrow pane), P3 (chip,
  // shadow).
  // redline3 S3: Resume is in the one centered bar, beside the toggle.
  it("offers Resume after Stop inside the centered bar, beside the toggle", () => {
    hoisted.canResume = true;
    hoisted.rawNote = "Launch review";
    renderBar({ allowListening: true });

    const bar = document.querySelector("[data-note-bar]")!;
    const resume = screen.getByRole("button", { name: "Resume recording" });
    expect(bar.contains(resume)).toBe(true);
    expect(resume.getAttribute("data-variant")).toBe("bar");
    const controls = Array.from(bar.querySelectorAll("button, input")).map(
      (element) =>
        element.getAttribute("aria-label") ?? element.textContent ?? "",
    );
    expect(controls).toEqual([
      "Transcript",
      "Resume recording",
      "Ask anything",
      "Draft follow-up email",
    ]);
    const stack = document.querySelector("[data-note-bar-stack]")!;
    expect(stack.className).toContain("left-1/2");
    expect(stack.className).toContain("-translate-x-1/2");
    expect(stack.className).not.toContain("right-4");
    expect(document.querySelector("[data-note-bar-divider]")).not.toBeNull();
  });

  it("passes the recording bar no Resume, so no far-left pill shows", () => {
    hoisted.canResume = true;
    renderBar({ allowListening: true });
    expect(hoisted.recordingBarProps).toHaveBeenLastCalledWith({
      sessionId: "session-1",
      holdQuietHint: false,
    });
    expect(
      screen.getAllByRole("button", { name: "Resume recording" }),
    ).toHaveLength(1);
  });

  it("offers no Resume on a blank note, while another note records, or in a standalone window", () => {
    hoisted.canResume = true;
    hoisted.hasTranscript = false;
    const noResume = () =>
      expect(
        screen.queryByRole("button", { name: "Resume recording" }),
      ).toBeNull();
    renderBar({ allowListening: true, audioExists: false });
    noResume();
    expect(document.querySelector("[data-note-bar-divider]")).not.toBeNull();
    cleanup();

    hoisted.hasTranscript = true;
    hoisted.canResume = false;
    renderBar({ allowListening: true });
    noResume();
    cleanup();

    hoisted.canResume = true;
    renderBar({ allowListening: false });
    noResume();
  });

  it("offers Resume from saved audio alone", () => {
    hoisted.canResume = true;
    hoisted.hasTranscript = false;
    renderBar({ allowListening: true, audioExists: true });
    expect(
      screen.getByRole("button", { name: "Resume recording" }),
    ).toBeTruthy();
  });

  it("hides only the Ask field in a narrow pane while recording", () => {
    hoisted.sessionMode = "active";
    renderBar();

    const bar = document.querySelector("[data-note-bar]")!;
    expect(bar.className).not.toContain("@max-[760px]:hidden");
    expect(document.querySelector("[data-note-ask]")!.className).toContain(
      "@max-[760px]:hidden",
    );
    expect(
      document.querySelector("[data-note-bar-stack]")!.className,
    ).toContain("@max-[760px]:w-auto");
    expect(screen.getByRole("button", { name: "Transcript" })).toBeTruthy();
  });

  it("keeps the Ask field in a narrow pane when not recording", () => {
    renderBar();
    expect(document.querySelector("[data-note-ask]")!.className).not.toContain(
      "@max-[760px]:hidden",
    );
  });

  it("hides the follow-up email chip on a blank note", () => {
    hoisted.hasTranscript = false;
    renderBar();
    expect(
      screen.queryByRole("button", { name: "Draft follow-up email" }),
    ).toBeNull();
    cleanup();

    hoisted.rawNote = "Agenda";
    renderBar();
    expect(
      screen.getByRole("button", { name: "Draft follow-up email" }),
    ).toBeTruthy();
  });

  it("is one card pill with a light-only shadow", () => {
    renderBar();
    const bar = document.querySelector("[data-note-bar]")!;
    for (const name of [
      "h-10",
      "rounded-full",
      "border",
      "border-input",
      "bg-card",
      "shadow-sm",
      "dark:shadow-none",
    ]) {
      expect(bar.className).toContain(name);
    }
    // The toggle and the field are segments of the bar, not pills of
    // their own.
    const ask = document.querySelector("[data-note-ask]")!;
    expect(ask.className).not.toContain("border");
    expect(ask.className).not.toContain("shadow-sm");
    const toggle = screen.getByRole("button", { name: "Transcript" });
    expect(toggle.className).not.toContain("border");
  });

  afterEach(() => {
    cleanup();
  });

  it("is a full bar, so the Ask field is never clipped", () => {
    renderBar();

    const stack = document.querySelector("[data-note-bar-stack]")!;
    // Was a 150 px slot around a 196 px pill ("Ask anythi…").
    expect(stack.className).not.toContain("w-[150px]");
    expect(stack.className).toContain("w-[min(680px,calc(100%-4rem))]");
    const input = screen.getByRole("textbox", { name: "Ask anything" });
    expect(input.getAttribute("placeholder")).toBe("Ask anything");
    expect(input.className).toContain("flex-1");
    expect(input.className).toContain("min-w-[6.5rem]");
    expect(input.closest("form")?.className).toContain("flex-1");
    expect(screen.getByText("⌘ J")).not.toBeNull();
  });

  // Microsoft Writing Style Guide, Keys and keyboard shortcuts.
  it("names Ctrl+J off a Mac", () => {
    hoisted.platform = "windows";
    renderBar();

    expect(screen.getByText("Ctrl+J")).not.toBeNull();
    expect(screen.queryByText("⌘ J")).toBeNull();
    expect(
      screen
        .getByRole("textbox", { name: "Ask anything" })
        .getAttribute("aria-keyshortcuts"),
    ).toBe("Control+J");
  });

  it("orders the bar: transcript toggle, Ask field, follow-up chip", () => {
    renderBar();

    const bar = document.querySelector("[data-note-bar]")!;
    const controls = Array.from(bar.querySelectorAll("button, input")).map(
      (element) =>
        element.getAttribute("aria-label") ?? element.textContent ?? "",
    );
    expect(controls).toEqual([
      "Transcript",
      "Ask anything",
      "Draft follow-up email",
    ]);
  });

  it("sends a typed question to chat", () => {
    renderBar();

    const input = screen.getByRole("textbox", { name: "Ask anything" });
    fireEvent.change(input, { target: { value: "What did we decide?" } });
    fireEvent.submit(input.closest("form")!);

    expect(hoisted.queueChatPrompt).toHaveBeenCalledWith("What did we decide?");
    expect(hoisted.sendEvent).toHaveBeenCalledWith({ type: "OPEN" });
  });

  it("drafts a follow-up email with the chat's existing prompt", () => {
    renderBar();

    fireEvent.click(
      screen.getByRole("button", { name: "Draft follow-up email" }),
    );

    expect(hoisted.queueChatPrompt).toHaveBeenCalledWith(
      "Draft a follow-up email to the participants",
    );
    expect(hoisted.sendEvent).toHaveBeenCalledWith({ type: "OPEN" });
  });

  it("toggles to the transcript and back to the notes", () => {
    const onSelectView = vi.fn();
    const view = renderBar({ onSelectView });

    fireEvent.click(screen.getByRole("button", { name: "Transcript" }));
    expect(onSelectView).toHaveBeenLastCalledWith(TRANSCRIPT);

    view.rerender(
      <FloatingActionButton
        currentView={TRANSCRIPT}
        editorTabs={[ENHANCED, RAW, TRANSCRIPT]}
        onSelectView={onSelectView}
        tab={tab}
      />,
    );
    const hide = screen.getByRole("button", { name: "Transcript" });
    expect(hide.getAttribute("aria-pressed")).toBe("true");
    expect(hide.textContent).toContain("Transcript");
    fireEvent.click(hide);
    expect(onSelectView).toHaveBeenLastCalledWith(ENHANCED);
  });

  // redline2-oct3 R2: the bar is the same on Summary and Transcript.
  it("keeps the email chip on the transcript; the language lives in the toolbar", () => {
    renderBar({ currentView: TRANSCRIPT });

    expect(
      screen.getByRole("button", { name: "Draft follow-up email" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "English +1" })).toBeNull();
  });

  // redline2-oct3 R2: the bars button names its real action.
  it("names the transcript toggle's action in a tooltip", async () => {
    renderBar();

    fireEvent.focus(screen.getByRole("button", { name: "Transcript" }));
    expect(
      (await screen.findAllByText("Show transcript")).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("tooltip").textContent).toBe("Show transcript");
  });

  // Owner review, Oct 3: the toggle shows a visible label, which drops to
  // the icon plus tooltip under 480 px (NN/g icon labels; Apple HIG).
  it("labels the transcript toggle with visible text", () => {
    renderBar();

    const toggle = screen.getByRole("button", { name: "Transcript" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(toggle.hasAttribute("aria-label")).toBe(false);
    const label = Array.from(toggle.querySelectorAll("span")).find(
      (span) => span.textContent === "Transcript",
    )!;
    expect(label.className).toContain("@max-[480px]:sr-only");
  });

  // Fork: no ring offset, so the focus ring stays inside the bar's border,
  // like the bar's other buttons (house rule: nothing touches edges).
  it("keeps the transcript toggle's focus ring inside the bar", () => {
    renderBar();

    const toggle = screen.getByRole("button", { name: "Transcript" });
    expect(toggle.className).toContain("focus-visible:ring-2");
    expect(toggle.className).not.toContain("ring-offset");
  });

  it("hides the transcript toggle when there is no transcript", () => {
    renderBar({ editorTabs: [ENHANCED, RAW] });

    expect(screen.queryByRole("button", { name: "Transcript" })).toBeNull();
  });

  it("steps aside while the chat is open", () => {
    hoisted.chatMode = "FloatingOpen";
    renderBar();

    expect(document.querySelector("[data-note-bar]")?.className).toContain(
      "hidden",
    );
  });

  // Fork tests: installed-build review Oct 3 (P2: chat covered "Resume
  // reco…"; P2: follow-up chip clipped at ~920 px).
  it("hides Resume while the floating chat covers the bottom, and brings it back after", () => {
    hoisted.canResume = true;
    hoisted.chatMode = "FloatingOpen";
    renderBar({ allowListening: true });
    expect(document.querySelector("[data-note-bar]")!.className).toContain(
      "hidden",
    );
    cleanup();

    hoisted.chatMode = "FloatingClosed";
    renderBar({ allowListening: true });
    expect(document.querySelector("[data-note-bar]")!.className).not.toContain(
      "hidden",
    );
    expect(
      screen.getByRole("button", { name: "Resume recording" }),
    ).toBeTruthy();
  });

  // redline3 S3: with chat in the right panel the Ask field would repeat
  // it, so the bar keeps the toggle and Resume only.
  it("keeps the toggle and Resume, without the Ask field, beside a right-panel chat", () => {
    hoisted.canResume = true;
    hoisted.chatMode = "RightPanelOpen";
    hoisted.rawNote = "Launch review";
    renderBar({ allowListening: true });

    const bar = document.querySelector("[data-note-bar]")!;
    expect(bar.className).not.toContain("hidden");
    expect(document.querySelector("[data-note-ask]")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Draft follow-up email" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Transcript" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Resume recording" }),
    ).toBeTruthy();
    expect(
      document.querySelector("[data-note-bar-stack]")!.className,
    ).toContain("w-auto");
  });

  it("hides an empty bar beside a right-panel chat", () => {
    hoisted.chatMode = "RightPanelOpen";
    renderBar({ editorTabs: [ENHANCED, RAW] });

    expect(document.querySelector("[data-note-bar]")!.className).toContain(
      "hidden",
    );
  });

  it("keeps the recording bar while the chat is open", () => {
    hoisted.sessionMode = "active";
    hoisted.chatMode = "FloatingOpen";
    renderBar({ allowListening: true });
    expect(hoisted.recordingBarProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ sessionId: "session-1" }),
    );
  });

  it("drops the follow-up chip to its icon when the Ask field narrows, never clipping it", () => {
    hoisted.canResume = true;
    hoisted.rawNote = "Launch review";
    renderBar({ allowListening: true });

    const form = document.querySelector("[data-note-ask]")!;
    expect(form.className).toContain("@container/ask");
    const label = screen.getByText("Draft follow-up email", {
      selector: "span",
    });
    // ⌘ J gives way first, then the chip label (redline3 S3).
    expect(label.className).toContain("@max-[19rem]/ask:sr-only");
    expect(screen.getByText("⌘ J").className).toContain(
      "@max-[22rem]/ask:hidden",
    );
  });

  it("names the icon-only follow-up chip in a tooltip", async () => {
    hoisted.rawNote = "Launch review";
    renderBar();

    fireEvent.focus(
      screen.getByRole("button", { name: "Draft follow-up email" }),
    );
    await screen.findByRole("tooltip");
    expect(screen.getByRole("tooltip").textContent).toBe(
      "Draft follow-up email",
    );
  });

  it("moves beside the recording bar while recording, leaving Stop uncovered", () => {
    hoisted.sessionMode = "active";
    renderBar();

    const stack = document.querySelector("[data-note-bar-stack]")!;
    expect(stack.className).toContain("right-4");
    expect(stack.className).toContain("left-auto");
    expect(stack.className).toContain("translate-x-0");
    expect(stack.className).toContain("w-[min(360px,calc(100%-2rem))]");
    expect(stack.className).not.toContain("left-1/2");
    expect(
      screen.queryByRole("button", { name: "Resume recording" }),
    ).toBeNull();
  });

  it("keeps a selection slot stacked above the bar", () => {
    renderBar();

    const slot = document.querySelector("[data-session-fab-selection]");
    const stack = slot?.parentElement;

    expect(stack?.className).toContain("flex-col-reverse");
    expect(stack?.className).toContain("bottom-4");
    expect(slot?.className).toContain("mb-2");
    expect(slot?.className).toContain("peer-hover/session-fab:translate-y-0");
    expect(slot?.className).toContain(
      "peer-focus-within/session-fab:translate-y-0",
    );
  });
});
