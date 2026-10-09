import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SegmentHeader } from "./segment-header";
import { TranscriptSelectionProvider } from "./selection-context";

import type { Segment } from "~/stt/live-segment";

vi.mock("./speaker-assign", () => ({
  SpeakerAssignPopover: ({ label }: { label: string }) => (
    <button type="button">{label}</button>
  ),
}));

beforeEach(() => {
  cleanup();
});

function renderSelectable(selected = false) {
  return render(
    <TranscriptSelectionProvider
      selectMode
      selectedKeys={new Set()}
      registerSource={() => () => {}}
    >
      <SegmentHeader
        transcriptId="transcript-1"
        sessionId="session-1"
        label="Artem"
        segment={createRemoteSegment(0)}
        selected={selected}
      />
      <SegmentHeader
        transcriptId="transcript-1"
        sessionId="session-1"
        label="Bea"
        segment={createRemoteSegment(1)}
      />
    </TranscriptSelectionProvider>,
  );
}

// Fork tests: task test, Oct 9 (selecting lines was mouse-only).
describe("SegmentHeader line checkbox", () => {
  it("is a keyboard checkbox that reports its state", () => {
    renderSelectable(true);
    const box = screen.getByRole("checkbox", {
      name: "Select line from Artem",
    });
    expect(box.getAttribute("tabindex")).toBe("0");
    expect(box.getAttribute("aria-checked")).toBe("true");
  });

  it("selects on Space, as a click does, and keeps Shift for ranges", () => {
    renderSelectable();
    const box = screen.getByRole("checkbox", {
      name: "Select line from Artem",
    });
    const clicks: boolean[] = [];
    box.addEventListener("click", (event) => clicks.push(event.shiftKey));

    fireEvent.keyDown(box, { key: " " });
    fireEvent.keyDown(box, { key: " ", shiftKey: true });

    expect(clicks).toEqual([false, true]);
  });

  it("moves between lines with the arrow keys", () => {
    renderSelectable();
    const first = screen.getByRole("checkbox", {
      name: "Select line from Artem",
    });
    const second = screen.getByRole("checkbox", {
      name: "Select line from Bea",
    });
    first.focus();

    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(document.activeElement).toBe(second);
    fireEvent.keyDown(second, { key: "ArrowUp" });
    expect(document.activeElement).toBe(first);
  });
});

describe("SegmentHeader", () => {
  it("keeps the speaker label visible without exposing timestamps", () => {
    render(
      <SegmentHeader
        transcriptId="transcript-1"
        sessionId="session-1"
        label="Speaker 3"
        segment={createRemoteSegment(2)}
      />,
    );

    expect(screen.getByRole("button", { name: "Speaker 3" })).toBeTruthy();
    expect(screen.queryByText("00:12 - 00:18")).toBeNull();
  });

  it("labels remote live segments as the unique other participant", () => {
    render(
      <SegmentHeader
        transcriptId="transcript-1"
        sessionId="session-1"
        label="Artem"
        segment={createRemoteSegment(0)}
      />,
    );

    expect(screen.getByRole("button", { name: "Artem" })).toBeTruthy();
  });

  it("updates cached remote labels when session participants change", () => {
    const segment = createRemoteSegment(0);
    const { rerender } = render(
      <SegmentHeader
        transcriptId="transcript-1"
        sessionId="session-1"
        label="Artem"
        segment={segment}
      />,
    );

    expect(screen.getByRole("button", { name: "Artem" })).toBeTruthy();

    rerender(
      <SegmentHeader
        transcriptId="transcript-1"
        sessionId="session-1"
        label="Speaker 1"
        segment={segment}
      />,
    );

    expect(screen.getByRole("button", { name: "Speaker 1" })).toBeTruthy();
  });
});

function createRemoteSegment(speakerIndex: number): Segment {
  return {
    id: "segment-1",
    key: {
      channel: "RemoteParty",
      speaker_index: speakerIndex,
      speaker_human_id: null,
    },
    start_ms: 12_000,
    end_ms: 18_000,
    text: "hello world",
    words: [
      {
        id: "word-1",
        text: "hello",
        start_ms: 12_000,
        end_ms: 13_000,
        channel: "RemoteParty",
        is_final: true,
      },
    ],
  } as Segment;
}
