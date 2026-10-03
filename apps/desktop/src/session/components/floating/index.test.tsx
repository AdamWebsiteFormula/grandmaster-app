import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FloatingActionButton } from "./index";

import type { Tab } from "~/store/zustand/tabs";
import type { EditorView } from "~/store/zustand/tabs/schema";

const hoisted = vi.hoisted(() => ({
  sendEvent: vi.fn(),
  queueChatPrompt: vi.fn(),
  openNew: vi.fn(),
  chatMode: "FloatingClosed",
  sessionMode: "inactive",
}));

vi.mock("./recording-bar", () => ({
  RecordingBar: () => null,
}));

vi.mock("~/stt/contexts", () => ({
  useListener: (selector: (state: unknown) => unknown) =>
    selector({ getSessionMode: () => hoisted.sessionMode }),
}));

vi.mock("~/contexts/shell", () => ({
  useShell: () => ({
    chat: { mode: hoisted.chatMode, sendEvent: hoisted.sendEvent },
  }),
}));

vi.mock("~/chat/pending-prompt", () => ({
  queueChatPrompt: hoisted.queueChatPrompt,
}));

vi.mock("~/shared/config", () => ({
  useConfigValue: (key: string) =>
    key === "ai_language" ? "en" : key === "spoken_languages" ? '["de"]' : "",
}));

vi.mock("~/store/zustand/tabs", () => ({
  useTabs: (selector: (state: unknown) => unknown) =>
    selector({ openNew: hoisted.openNew }),
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
    hoisted.openNew.mockClear();
    hoisted.chatMode = "FloatingClosed";
    hoisted.sessionMode = "inactive";
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

  it("shows the spoken language instead of the email chip on the transcript", () => {
    renderBar({ currentView: TRANSCRIPT });

    expect(
      screen.queryByRole("button", { name: "Draft follow-up email" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "English +1" }));
    expect(hoisted.openNew).toHaveBeenCalledWith({
      type: "settings",
      state: { tab: "app" },
    });
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
