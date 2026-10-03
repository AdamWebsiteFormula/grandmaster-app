import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render as renderUi, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  IdentityAssignment,
  RenderTranscriptRequest,
  RenderedTranscriptSegment,
} from "@anlg/plugin-transcription";

import { RenderTranscript } from "./transcript";

import type { Segment } from "~/stt/live-segment";

function render(ui: ReactNode, options?: Parameters<typeof renderUi>[1]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderUi(ui, {
    ...options,
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

const mocks = vi.hoisted(() => ({
  assignTranscriptSpeaker: vi.fn(),
  renderTranscriptSegments: vi.fn(),
  search: null as null | {
    activeMatchId: string | null;
    caseSensitive: boolean;
    isVisible: boolean;
    query: string;
    wholeWord: boolean;
  },
  useRenderedTranscriptData: vi.fn(),
  useTranscriptTimelineMetadata: vi.fn(() => ({
    offsetMs: 0,
    sessionId: "session-1",
  })),
}));

vi.mock("@anlg/plugin-transcription", () => ({
  commands: {
    renderTranscriptSegments: mocks.renderTranscriptSegments,
  },
}));

vi.mock("../../search/context", () => ({
  useSearch: () => mocks.search,
}));

vi.mock("./data-hooks", () => ({
  useRenderedTranscriptData: mocks.useRenderedTranscriptData,
  useTranscriptTimelineMetadata: mocks.useTranscriptTimelineMetadata,
}));

vi.mock("./word-span", () => ({
  WordSpan: ({ displayText }: { displayText: string }) => (
    <span>{displayText}</span>
  ),
}));

vi.mock("@anlg/ui/components/ui/popover", () => ({
  AppFloatingPanel: () => null,
  Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: () => null,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("~/calendar/queries", () => ({
  useSessionEventParticipants: () => [],
}));

vi.mock("~/contacts/queries", () => ({
  createHuman: vi.fn(),
  useHumans: () => [],
}));

vi.mock("~/session/queries", () => ({
  addSessionParticipant: vi.fn(),
  useSession: () => null,
  useSessionParticipants: () => [],
}));

vi.mock("~/stt/queries", () => ({
  assignTranscriptSpeaker: mocks.assignTranscriptSpeaker,
}));

describe("RenderTranscript", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.search = null;
    mocks.useRenderedTranscriptData.mockReturnValue({
      maxSpeakerNumber: undefined,
      request: createRenderRequest(createSegments(500)),
      segments: createSegments(500),
    });
  });

  it.each([false, true])(
    "keeps read and edit mode virtualized with one content and metadata subscription (editMode=%s)",
    (editMode) => {
      render(
        <RenderTranscript
          scrollElement={null}
          isLastTranscript
          shouldScrollToEnd={false}
          transcriptId="transcript-1"
          currentActive
          captureGeneration={7}
          editMode={editMode}
          liveSegments={createSegments(500)}
          currentMs={0}
          seek={vi.fn()}
          startPlayback={vi.fn()}
          audioExists
        />,
      );

      expect(document.querySelectorAll("section").length).toBeLessThanOrEqual(
        30,
      );
      expect(document.querySelectorAll("[data-transcript-editor]").length).toBe(
        editMode ? document.querySelectorAll("section").length : 0,
      );
      expect(
        document
          .querySelector("[data-transcript-virtual-total]")
          ?.getAttribute("data-transcript-virtual-total"),
      ).toBe("500");
      expect(mocks.useRenderedTranscriptData).toHaveBeenCalledOnce();
      expect(mocks.useRenderedTranscriptData).toHaveBeenCalledWith(
        "transcript-1",
        true,
        7,
      );
      expect(mocks.useTranscriptTimelineMetadata).toHaveBeenCalledTimes(1);
      expect(mocks.useTranscriptTimelineMetadata).toHaveBeenCalledWith(
        "transcript-1",
        false,
      );
    },
  );

  it("preserves persisted history when a recovered live preview only has the tail", () => {
    const prefix = createSegment("persisted", 0);
    const live = createSegment("live", 1);
    mocks.useRenderedTranscriptData.mockReturnValue({
      maxSpeakerNumber: undefined,
      request: createRenderRequest([prefix, live]),
      segments: [
        {
          ...prefix,
          end_ms: live.end_ms,
          text: `${prefix.text} ${live.text}`,
          words: [...prefix.words, ...live.words],
        },
      ],
    });

    render(
      <RenderTranscript
        scrollElement={null}
        isLastTranscript
        shouldScrollToEnd={false}
        transcriptId="transcript-1"
        currentActive
        liveSegments={[live]}
        currentMs={0}
        seek={vi.fn()}
        startPlayback={vi.fn()}
        audioExists
      />,
    );

    expect(document.querySelectorAll("section")).toHaveLength(2);
    expect(document.body.textContent).toContain("word-persisted");
    expect(document.body.textContent).toContain("word-live");
  });

  it("switches back to the persisted renderer after capture stops", () => {
    mocks.useRenderedTranscriptData.mockReturnValue({
      maxSpeakerNumber: undefined,
      request: createRenderRequest(createSegments(1)),
      segments: createSegments(1),
    });

    render(
      <RenderTranscript
        scrollElement={null}
        isLastTranscript
        shouldScrollToEnd={false}
        transcriptId="transcript-1"
        currentActive={false}
        liveSegments={[]}
        currentMs={0}
        seek={vi.fn()}
        startPlayback={vi.fn()}
        audioExists
      />,
    );

    expect(mocks.useRenderedTranscriptData).toHaveBeenCalledWith(
      "transcript-1",
      false,
      0,
    );
    expect(mocks.useTranscriptTimelineMetadata).toHaveBeenCalledWith(
      "transcript-1",
      true,
    );
    expect(document.querySelectorAll("section")).toHaveLength(1);
  });

  it("uses the volatile persisted fallback before live segments arrive", () => {
    mocks.useRenderedTranscriptData.mockReturnValue({
      maxSpeakerNumber: undefined,
      request: createRenderRequest(createSegments(1)),
      segments: createSegments(1),
    });

    render(
      <RenderTranscript
        scrollElement={null}
        isLastTranscript
        shouldScrollToEnd={false}
        transcriptId="transcript-1"
        currentActive
        liveSegments={[]}
        currentMs={0}
        seek={vi.fn()}
        startPlayback={vi.fn()}
        audioExists
      />,
    );

    expect(mocks.useRenderedTranscriptData).toHaveBeenCalledWith(
      "transcript-1",
      true,
      0,
    );
    expect(document.querySelectorAll("section")).toHaveLength(1);
  });

  it("applies current SQLite speaker assignments to visible live segments", () => {
    const live = createSegment("live", 0);
    const assignments: IdentityAssignment[] = [
      {
        human_id: "human-1",
        scope: {
          kind: "channel_speaker",
          channel: "MixedCapture",
          speaker_index: 0,
        },
      },
    ];
    const request = createRenderRequest([live], assignments);
    request.humans = [{ human_id: "human-1", name: "Ada" }];
    mocks.useRenderedTranscriptData.mockReturnValue({
      maxSpeakerNumber: undefined,
      request,
      segments: [],
    });

    render(
      <RenderTranscript
        scrollElement={null}
        isLastTranscript
        shouldScrollToEnd={false}
        transcriptId="transcript-1"
        currentActive
        liveSegments={[live]}
        currentMs={0}
        seek={vi.fn()}
        startPlayback={vi.fn()}
        audioExists
      />,
    );

    expect(screen.getByRole("button", { name: "Ada" })).toBeTruthy();
  });

  it("keeps context-resolved speaker names while a live update is re-resolved", async () => {
    const live = createSegment("live", 0);
    const request: RenderTranscriptRequest = {
      ...createRenderRequest([live]),
      speaker_context: { intervals: [] },
    };
    mocks.useRenderedTranscriptData.mockReturnValue({
      maxSpeakerNumber: undefined,
      request,
      segments: [],
    });
    const labelAda = (segment: Segment): RenderedTranscriptSegment => ({
      ...segment,
      speaker_label: "Ada",
      provisional_speaker: {
        name: "Ada",
        human_id: "human-1",
        reason: "sole_remote_participant",
      },
    });
    mocks.renderTranscriptSegments.mockResolvedValueOnce({
      status: "ok",
      data: [labelAda(live)],
    });

    const rendered = render(
      <RenderTranscript
        scrollElement={null}
        isLastTranscript
        shouldScrollToEnd={false}
        transcriptId="transcript-1"
        currentActive
        liveSegments={[live]}
        currentMs={0}
        seek={vi.fn()}
        startPlayback={vi.fn()}
        audioExists
      />,
    );
    await screen.findByRole("button", { name: "Ada" });

    mocks.renderTranscriptSegments.mockImplementationOnce(
      () => new Promise(() => {}),
    );
    const nextWord = {
      text: " next",
      start_ms: 100,
      end_ms: 200,
      channel: "MixedCapture" as const,
      is_final: false,
    };
    const updated = {
      ...live,
      id: "segment-live:next",
      end_ms: nextWord.end_ms,
      text: `${live.text}${nextWord.text}`,
      words: [...live.words, nextWord],
    };
    rendered.rerender(
      <RenderTranscript
        scrollElement={null}
        isLastTranscript
        shouldScrollToEnd={false}
        transcriptId="transcript-1"
        currentActive
        liveSegments={[updated]}
        currentMs={0}
        seek={vi.fn()}
        startPlayback={vi.fn()}
        audioExists
      />,
    );

    expect(mocks.renderTranscriptSegments).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Ada" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Speaker/ })).toBeNull();
    expect(document.body.textContent).toContain("next");
  });

  it("renders identities resolved by the native settled renderer", () => {
    const settled = createSegment("settled", 0);
    settled.key.speaker_human_id = "human-1";
    const assignments: IdentityAssignment[] = [
      {
        human_id: "human-1",
        scope: {
          kind: "channel_speaker",
          channel: "MixedCapture",
          speaker_index: 0,
        },
      },
    ];
    const request = createRenderRequest([settled], assignments);
    request.humans = [{ human_id: "human-1", name: "Ada" }];
    mocks.useRenderedTranscriptData.mockReturnValue({
      maxSpeakerNumber: undefined,
      request,
      segments: [settled],
    });

    render(
      <RenderTranscript
        scrollElement={null}
        isLastTranscript
        shouldScrollToEnd={false}
        transcriptId="transcript-1"
        currentActive={false}
        liveSegments={[]}
        currentMs={0}
        seek={vi.fn()}
        startPlayback={vi.fn()}
        audioExists
      />,
    );

    expect(screen.getByRole("button", { name: "Ada" })).toBeTruthy();
  });

  // redline2-oct3 R2: a small time label on every bubble, no centered
  // floating time.
  it("puts each bubble's start time in its label", () => {
    const first = createSegment("a", 0);
    const second = createSegment("b", 1);
    const later = createSegment("c", 0);
    later.words[0]!.start_ms = 75_000;
    const segments = [first, second, later];
    mocks.useRenderedTranscriptData.mockReturnValue({
      maxSpeakerNumber: undefined,
      request: createRenderRequest(segments),
      segments,
    });

    renderTranscript();

    expect(
      Array.from(document.querySelectorAll("[data-transcript-time]"))
        .map((label) => label.textContent)
        .sort(),
    ).toEqual(["· 00:00", "· 00:00", "· 01:15"]);
    expect(document.querySelector("[data-transcript-timestamp]")).toBeNull();
    expect(document.querySelectorAll("[data-transcript-bubble]").length).toBe(
      3,
    );
  });

  // Fork: display only, stored words untouched (redline-oct3, H2).
  it("shows one bubble per spoken result, a space after a glued sentence, and a time on each", () => {
    const words = [
      ["Okay,", 0],
      [" a", 400],
      [" reminder.", 800],
      ["I", 2_000],
      [" respond", 2_400],
      [" to", 2_800],
      [" messages.and", 3_200],
      [" make", 3_600],
      [" sure.", 4_000],
      ["And", 33_000],
      [" then.", 33_400],
    ] as const;
    const monologue: Segment = {
      id: "segment-mono",
      key: {
        channel: "DirectMic",
        speaker_index: null,
        speaker_human_id: null,
      },
      start_ms: 0,
      end_ms: 33_700,
      text: words.map(([text]) => text).join(""),
      words: words.map(([text, start], index) => ({
        id: `mono-${index}`,
        text,
        start_ms: start,
        end_ms: start + 300,
        channel: "DirectMic",
        is_final: true,
      })),
    };
    const stored = JSON.stringify(monologue);
    mocks.useRenderedTranscriptData.mockReturnValue({
      maxSpeakerNumber: undefined,
      request: createRenderRequest([monologue]),
      segments: [monologue],
    });

    renderTranscript();

    const bubbles = Array.from(
      document.querySelectorAll("[data-transcript-bubble]"),
    ).map((bubble) => bubble.textContent);
    expect(bubbles).toEqual([
      "Okay, a reminder.",
      "I respond to messages. and make sure.",
      "And then.",
    ]);
    expect(
      Array.from(document.querySelectorAll("[data-transcript-time]")).map(
        (label) => label.textContent,
      ),
    ).toEqual(["· 00:00", "· 00:02", "· 00:33"]);
    expect(JSON.stringify(monologue)).toBe(stored);
  });

  it("keeps the DOM bounded for a multi-hour transcript fixture", () => {
    const segments = createSegments(10_000);
    mocks.useRenderedTranscriptData.mockReturnValue({
      maxSpeakerNumber: undefined,
      request: createRenderRequest(segments),
      segments,
    });

    renderTranscript();

    expect(document.querySelectorAll("section").length).toBeLessThanOrEqual(30);
    expect(
      document
        .querySelector("[data-transcript-virtual-total]")
        ?.getAttribute("data-transcript-virtual-total"),
    ).toBe("10000");
  });

  it("mounts and scrolls to an active off-screen search match", () => {
    const segments = createSegments(1_000);
    mocks.useRenderedTranscriptData.mockReturnValue({
      maxSpeakerNumber: undefined,
      request: createRenderRequest(segments),
      segments,
    });
    mocks.search = {
      activeMatchId: "word-999",
      caseSensitive: false,
      isVisible: true,
      query: "word-999",
      wholeWord: false,
    };
    const scrollElement = createScrollElement();

    renderTranscript(scrollElement);

    expect(
      document.querySelector(
        "section[data-transcript-segment-id='segment-999']",
      ),
    ).toBeTruthy();
    expect(scrollElement.scrollTo).toHaveBeenCalled();
  });

  it("pins the active playback segment outside the viewport", () => {
    const segments = createSegments(1_000);
    mocks.useRenderedTranscriptData.mockReturnValue({
      maxSpeakerNumber: undefined,
      request: createRenderRequest(segments),
      segments,
    });

    renderTranscript(null, 99_950);

    expect(
      document.querySelector(
        "section[data-transcript-segment-id='segment-999']",
      ),
    ).toBeTruthy();
    expect(document.querySelectorAll("section").length).toBeLessThanOrEqual(30);
  });

  it("preserves visible segment nodes when incremental updates append", () => {
    const initial = createSegments(500);
    mocks.useRenderedTranscriptData.mockReturnValue({
      maxSpeakerNumber: undefined,
      request: createRenderRequest(initial),
      segments: initial,
    });
    const rendered = renderTranscript();
    const first = document.querySelector(
      "section[data-transcript-segment-id='segment-0']",
    );
    const updated = [...initial, createSegment("500", 500)];
    mocks.useRenderedTranscriptData.mockReturnValue({
      maxSpeakerNumber: undefined,
      request: createRenderRequest(updated),
      segments: updated,
    });

    rendered.rerender(
      <RenderTranscript
        scrollElement={null}
        isLastTranscript
        shouldScrollToEnd={false}
        transcriptId="transcript-1"
        currentActive={false}
        liveSegments={[]}
        currentMs={0}
        seek={vi.fn()}
        startPlayback={vi.fn()}
        audioExists
      />,
    );

    expect(
      document.querySelector("section[data-transcript-segment-id='segment-0']"),
    ).toBe(first);
    expect(document.querySelectorAll("section").length).toBeLessThanOrEqual(30);
  });

  it("preserves an active live segment while trailing words update", () => {
    const initial = createSegment("live-start:live-end", 0);
    mocks.useRenderedTranscriptData.mockReturnValue({
      maxSpeakerNumber: undefined,
      request: createRenderRequest([initial]),
      segments: [],
    });
    const rendered = render(
      <RenderTranscript
        scrollElement={null}
        isLastTranscript
        shouldScrollToEnd={false}
        transcriptId="transcript-1"
        currentActive
        liveSegments={[initial]}
        currentMs={0}
        seek={vi.fn()}
        startPlayback={vi.fn()}
        audioExists
      />,
    );
    const initialNode = document.querySelector(
      "section[data-transcript-segment-id='segment-live-start:live-end']",
    );
    const nextWord = {
      id: "word-live-next",
      text: " next",
      start_ms: 100,
      end_ms: 200,
      channel: "MixedCapture" as const,
      is_final: false,
    };
    const updated = {
      ...initial,
      id: "segment-live-start:live-next",
      end_ms: nextWord.end_ms,
      text: `${initial.text}${nextWord.text}`,
      words: [...initial.words, nextWord],
    };
    mocks.useRenderedTranscriptData.mockReturnValue({
      maxSpeakerNumber: undefined,
      request: createRenderRequest([updated]),
      segments: [],
    });

    rendered.rerender(
      <RenderTranscript
        scrollElement={null}
        isLastTranscript
        shouldScrollToEnd={false}
        transcriptId="transcript-1"
        currentActive
        liveSegments={[updated]}
        currentMs={0}
        seek={vi.fn()}
        startPlayback={vi.fn()}
        audioExists
      />,
    );

    expect(
      document.querySelector(
        "section[data-transcript-segment-id='segment-live-start:live-next']",
      ),
    ).toBe(initialNode);
  });
});

function renderTranscript(
  scrollElement: HTMLDivElement | null = null,
  currentMs = 0,
) {
  return render(
    <RenderTranscript
      scrollElement={scrollElement}
      isLastTranscript
      shouldScrollToEnd={false}
      transcriptId="transcript-1"
      currentActive={false}
      liveSegments={[]}
      currentMs={currentMs}
      seek={vi.fn()}
      startPlayback={vi.fn()}
      audioExists
    />,
    scrollElement ? { container: scrollElement } : undefined,
  );
}

function createScrollElement() {
  const element = document.createElement("div");
  Object.defineProperties(element, {
    clientHeight: { value: 600 },
    scrollTop: { value: 0, writable: true },
    scrollTo: { value: vi.fn() },
  });
  document.body.append(element);
  return element;
}

function createSegments(count: number): Segment[] {
  return Array.from({ length: count }, (_, index) =>
    createSegment(String(index), index),
  );
}

function createSegment(id: string, index: number): Segment {
  return {
    id: `segment-${id}`,
    key: {
      channel: "MixedCapture",
      speaker_index: index % 2,
      speaker_human_id: null,
    },
    start_ms: index * 100,
    end_ms: index * 100 + 100,
    text: `word ${index}`,
    words: [
      {
        id: `word-${id}`,
        text: `word-${id}`,
        start_ms: index * 100,
        end_ms: index * 100 + 100,
        channel: "MixedCapture",
        is_final: true,
      },
    ],
  };
}

function createRenderRequest(
  segments: Segment[],
  assignments: IdentityAssignment[] = [],
): RenderTranscriptRequest {
  return {
    humans: [],
    participant_human_ids: [],
    self_human_id: null,
    transcripts: [
      {
        assignments,
        started_at: null,
        words: segments.flatMap((segment) =>
          segment.words.flatMap((word) =>
            word.id
              ? [
                  {
                    id: word.id,
                    text: word.text,
                    start_ms: word.start_ms,
                    end_ms: word.end_ms,
                    channel: 2,
                    speaker_index: segment.key.speaker_index,
                  },
                ]
              : [],
          ),
        ),
      },
    ],
  };
}
