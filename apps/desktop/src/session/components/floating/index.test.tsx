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
}));

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
  });

  // Fork tests: journey-meeting P1 (Resume), P2 (narrow pane), P3 (chip,
  // shadow).
  it("offers Resume after Stop when the note has a transcript or audio", () => {
    hoisted.canResume = true;
    renderBar({ allowListening: true });
    expect(hoisted.recordingBarProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ showResume: true }),
    );
    const stack = document.querySelector("[data-note-bar-stack]")!;
    expect(stack.className).toContain("right-4");
  });

  it("offers no Resume on a blank note, while another note records, or in a standalone window", () => {
    hoisted.canResume = true;
    hoisted.hasTranscript = false;
    renderBar({ allowListening: true, audioExists: false });
    expect(hoisted.recordingBarProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ showResume: false }),
    );
    cleanup();

    hoisted.hasTranscript = true;
    hoisted.canResume = false;
    renderBar({ allowListening: true });
    expect(hoisted.recordingBarProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ showResume: false }),
    );
    cleanup();

    hoisted.canResume = true;
    renderBar({ allowListening: false });
    expect(hoisted.recordingBarProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ showResume: false }),
    );
  });

  it("offers Resume from saved audio alone", () => {
    hoisted.canResume = true;
    hoisted.hasTranscript = false;
    renderBar({ allowListening: true, audioExists: true });
    expect(hoisted.recordingBarProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ showResume: true }),
    );
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
    expect(
      screen.getByRole("button", { name: "Show transcript" }),
    ).toBeTruthy();
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

  it("gives the note bar pills a light-only shadow", () => {
    renderBar();
    const ask = document.querySelector("[data-note-ask]")!;
    expect(ask.className).toContain("shadow-sm");
    expect(ask.className).toContain("dark:shadow-none");
  });

  afterEach(() => {
    cleanup();
  });

  it("is a full bar, so the Ask field is never clipped", () => {
    renderBar();

    const stack = document.querySelector("[data-note-bar-stack]")!;
    // Was a 150 px slot around a 196 px pill ("Ask anythi…").
    expect(stack.className).not.toContain("w-[150px]");
    expect(stack.className).toContain("w-[min(520px,calc(100%-2rem))]");
    const input = screen.getByRole("textbox", { name: "Ask anything" });
    expect(input.getAttribute("placeholder")).toBe("Ask anything");
    expect(input.className).toContain("flex-1");
    expect(input.className).toContain("min-w-[6.5rem]");
    expect(input.closest("form")?.className).toContain("flex-1");
    expect(screen.getByText("⌘ J")).not.toBeNull();
  });

  it("orders the bar: transcript toggle, Ask field, follow-up chip", () => {
    renderBar();

    const bar = document.querySelector("[data-note-bar]")!;
    const controls = Array.from(bar.querySelectorAll("button, input")).map(
      (element) =>
        element.getAttribute("aria-label") ?? element.textContent ?? "",
    );
    expect(controls).toEqual([
      "Show transcript",
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

    fireEvent.click(screen.getByRole("button", { name: "Show transcript" }));
    expect(onSelectView).toHaveBeenLastCalledWith(TRANSCRIPT);

    view.rerender(
      <FloatingActionButton
        currentView={TRANSCRIPT}
        editorTabs={[ENHANCED, RAW, TRANSCRIPT]}
        onSelectView={onSelectView}
        tab={tab}
      />,
    );
    const hide = screen.getByRole("button", { name: "Hide transcript" });
    expect(hide.getAttribute("aria-pressed")).toBe("true");
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

    fireEvent.focus(screen.getByRole("button", { name: "Show transcript" }));
    expect(
      (await screen.findAllByText("Show transcript")).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("tooltip").textContent).toBe("Show transcript");
  });

  it("hides the transcript toggle when there is no transcript", () => {
    renderBar({ editorTabs: [ENHANCED, RAW] });

    expect(
      screen.queryByRole("button", { name: "Show transcript" }),
    ).toBeNull();
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
    expect(hoisted.recordingBarProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ showResume: false }),
    );
    cleanup();

    hoisted.chatMode = "RightPanelOpen";
    renderBar({ allowListening: true });
    expect(hoisted.recordingBarProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ showResume: true }),
    );
    cleanup();

    hoisted.chatMode = "FloatingClosed";
    renderBar({ allowListening: true });
    expect(hoisted.recordingBarProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ showResume: true }),
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
    const chip = screen.getByRole("button", { name: "Draft follow-up email" });
    expect(chip.getAttribute("title")).toBe("Draft follow-up email");
    const label = screen.getByText("Draft follow-up email", {
      selector: "span",
    });
    expect(label.className).toContain("@max-[22rem]/ask:sr-only");
    expect(screen.getByText("⌘ J").className).toContain(
      "@max-[15rem]/ask:hidden",
    );
  });

  it("moves beside the recording bar while recording", () => {
    hoisted.sessionMode = "active";
    renderBar();

    const stack = document.querySelector("[data-note-bar-stack]")!;
    expect(stack.className).toContain("right-4");
    expect(stack.className).toContain("w-[min(360px,calc(100%-2rem))]");
  });

  it("keeps a selection slot stacked above the bar", () => {
    renderBar();

    const slot = document.querySelector("[data-session-fab-selection]");
    const stack = slot?.parentElement;

    expect(stack?.className).toContain("flex-col-reverse");
    expect(stack?.className).toContain("bottom-3");
    expect(slot?.className).toContain("mb-2");
    expect(slot?.className).toContain("peer-hover/session-fab:translate-y-0");
    expect(slot?.className).toContain(
      "peer-focus-within/session-fab:translate-y-0",
    );
  });
});
