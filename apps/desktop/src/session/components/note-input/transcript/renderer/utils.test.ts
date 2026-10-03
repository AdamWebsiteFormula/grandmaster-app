import chroma from "chroma-js";
import { describe, expect, it } from "vitest";

import {
  formatTranscriptTimestamp,
  getActiveLineIndex,
  getSegmentBubbleLayouts,
  getSegmentColor,
  getSegmentColorVars,
  isSelfSegmentKey,
  repairJoinedSentences,
  splitSegmentForDisplay,
  splitSegmentsForDisplay,
} from "./utils";

import type { Segment, SegmentKey, SegmentWord } from "~/stt/live-segment";

describe("transcript renderer utils", () => {
  it.each(["light", "dark"] as const)(
    "distinguishes people sharing a channel and speaker index in %s mode",
    (mode) => {
      const key: SegmentKey = {
        channel: "MixedCapture",
        speaker_index: null,
        speaker_human_id: "person-1",
      };
      const first = getSegmentColor(key, mode);
      const second = getSegmentColor(
        { ...key, speaker_human_id: "person-2" },
        mode,
      );

      expect(chroma.deltaE(first, second)).toBeGreaterThan(20);
      expect(
        getSegmentColor(
          { ...key, channel: "RemoteParty", speaker_index: 3 },
          mode,
        ),
      ).toBe(first);
    },
  );

  it("spaces unidentified speakers across distinct hues", () => {
    const colors = Array.from({ length: 6 }, (_, speaker_index) =>
      getSegmentColor({
        channel: "MixedCapture",
        speaker_index,
        speaker_human_id: null,
      }),
    );

    for (let index = 1; index < colors.length; index += 1) {
      expect(chroma.deltaE(colors[index - 1], colors[index])).toBeGreaterThan(
        20,
      );
    }
    expect(new Set(colors).size).toBe(6);
  });

  it("uses a brighter speaker color for dark mode", () => {
    const key: SegmentKey = {
      channel: "RemoteParty",
      speaker_index: 1,
      speaker_human_id: null,
    };

    expect(chroma(getSegmentColor(key, "dark")).luminance()).toBeGreaterThan(
      chroma(getSegmentColor(key)).luminance(),
    );
  });

  it("exposes light and dark speaker color variables", () => {
    const key: SegmentKey = {
      channel: "DirectMic",
      speaker_index: 0,
      speaker_human_id: null,
    };

    expect(getSegmentColorVars(key)).toEqual({
      "--segment-color-light": getSegmentColor(key),
      "--segment-color-dark": getSegmentColor(key, "dark"),
    });
  });

  it("finds the active transcript line without building line groups", () => {
    const words: SegmentWord[] = [
      createWord("word-1", "Hello", 100, 400),
      createWord("word-2", "world.", 400, 900),
      createWord("word-3", "Next", 1400, 1600),
      createWord("word-4", "line!", 1600, 2100),
    ];

    expect(getActiveLineIndex(words, 50, 0)).toBeNull();
    expect(getActiveLineIndex(words, 50, 149)).toBeNull();
    expect(getActiveLineIndex(words, 50, 150)).toBe(0);
    expect(getActiveLineIndex(words, 50, 950)).toBe(0);
    expect(getActiveLineIndex(words, 50, 1200)).toBeNull();
    expect(getActiveLineIndex(words, 50, 1450)).toBe(1);
    expect(getActiveLineIndex(words, 50, 2150)).toBe(1);
    expect(getActiveLineIndex(words, 50, 2200)).toBeNull();
  });
});

function createWord(
  id: string,
  text: string,
  startMs: number,
  endMs: number,
): SegmentWord {
  return {
    id,
    text,
    start_ms: startMs,
    end_ms: endMs,
    channel: "MixedCapture",
    is_final: true,
  };
}

// granola-compare-oct3 §2: bubbles and centered timestamps.
describe("transcript bubble layout", () => {
  const mic = (speaker_human_id: string | null = null): SegmentKey => ({
    channel: "DirectMic",
    speaker_index: null,
    speaker_human_id,
  });
  const remote = (speaker_index: number): SegmentKey => ({
    channel: "RemoteParty",
    speaker_index,
    speaker_human_id: null,
  });
  const at = (key: SegmentKey, startMs: number) => ({
    key,
    words: [{ start_ms: startMs }],
  });

  it("treats the mic as you unless it was reassigned to someone else", () => {
    expect(isSelfSegmentKey(mic())).toBe(true);
    expect(isSelfSegmentKey(mic("me"), "me")).toBe(true);
    expect(isSelfSegmentKey(mic("guest"), "me")).toBe(false);
    expect(isSelfSegmentKey(remote(0))).toBe(false);
  });

  it("formats timestamps as mm:ss, adding hours past an hour", () => {
    expect(formatTranscriptTimestamp(0)).toBe("00:00");
    expect(formatTranscriptTimestamp(2_544_000)).toBe("42:24");
    expect(formatTranscriptTimestamp(3_725_000)).toBe("1:02:05");
  });

  it("labels the first bubble, then about every 30 seconds, and starts runs on speaker change", () => {
    const layouts = getSegmentBubbleLayouts(
      [
        at(remote(0), 0),
        at(remote(0), 20_000),
        at(mic(), 40_000),
        at(remote(1), 59_000),
        at(remote(1), 61_000),
        at(remote(1), 70_000),
      ],
      { offsetMs: 1_000 },
    );

    expect(layouts.map((layout) => layout.timestamp)).toEqual([
      "00:01",
      null,
      "00:41",
      null,
      null,
      "01:11",
    ]);
    expect(layouts.map((layout) => layout.startsRun)).toEqual([
      true,
      false,
      true,
      true,
      false,
      true,
    ]);
    expect(layouts.map((layout) => layout.isSelf)).toEqual([
      false,
      false,
      true,
      false,
      false,
      false,
    ]);
  });

  it("groups runs by the rendered speaker name when given", () => {
    const layouts = getSegmentBubbleLayouts(
      [at(remote(0), 0), at(remote(1), 1_000)],
      { speakerLabels: ["Bruce", "Bruce"] },
    );

    expect(layouts[1]?.startsRun).toBe(false);
  });
});

// Fork: display-only fixes for glued results and one bubble per result
// (redline-oct3, H2).
describe("transcript display", () => {
  it.each([
    ["messages.and", "messages. and"],
    ["done.So", "done. So"],
    ["really?yes", "really? yes"],
    ["Go.", "Go."],
    ["e.g.", "e.g."],
    ["U.S.", "U.S."],
    ["example.com", "example.com"],
    ["Node.js", "Node.js"],
    ["3.5", "3.5"],
    ["https://a.b/c", "https://a.b/c"],
  ])("puts a space back between joined sentences: %s", (text, shown) => {
    expect(repairJoinedSentences(text)).toBe(shown);
  });

  const word = (text: string, start_ms: number, id: string): SegmentWord => ({
    id,
    text,
    start_ms,
    end_ms: start_ms + 300,
    channel: "DirectMic",
    is_final: true,
  });
  const segment = (words: SegmentWord[]): Segment => ({
    id: "seg-1",
    key: { channel: "DirectMic", speaker_index: null, speaker_human_id: null },
    start_ms: words[0]!.start_ms,
    end_ms: words[words.length - 1]!.end_ms,
    text: words.map((w) => w.text).join(""),
    words,
  });

  it("splits a monologue into one bubble per spoken result", () => {
    const source = segment([
      word("Okay,", 0, "w1"),
      word(" a", 500, "w2"),
      word(" reminder.", 900, "w3"),
      word("I", 2_000, "w4"),
      word(" need", 2_400, "w5"),
      word(" emails.", 2_800, "w6"),
      word("And", 4_000, "w7"),
      word(" more.", 4_400, "w8"),
    ]);

    const parts = splitSegmentForDisplay(source);

    expect(parts.map((part) => part.words.map((w) => w.id))).toEqual([
      ["w1", "w2", "w3"],
      ["w4", "w5", "w6"],
      ["w7", "w8"],
    ]);
    expect(parts.map((part) => part.id)).toEqual([
      "seg-1",
      "seg-1#1",
      "seg-1#2",
    ]);
    expect(parts[1]).toMatchObject({
      key: source.key,
      start_ms: 2_000,
      end_ms: 3_100,
      text: "I need emails.",
    });
    // The stored segment is untouched and the split is stable.
    expect(source.words).toHaveLength(8);
    expect(splitSegmentForDisplay(source)).toBe(parts);
  });

  it("keeps a result whole until it runs past 15 seconds", () => {
    const spaced = (text: string, start: number, id: string) =>
      word(` ${text}`, start, id);
    const source = segment([
      spaced("One.", 0, "a"),
      spaced("Two.", 5_000, "b"),
      spaced("Three.", 16_000, "c"),
      spaced("Four.", 18_000, "d"),
    ]);

    expect(
      splitSegmentForDisplay(source).map((part) => part.words.map((w) => w.id)),
    ).toEqual([["a", "b", "c"], ["d"]]);
  });

  it("leaves a short segment as it is", () => {
    const source = segment([word("Hi", 0, "a"), word(" there.", 300, "b")]);

    expect(splitSegmentsForDisplay([source])).toEqual([source]);
    expect(splitSegmentsForDisplay([source])[0]).toBe(source);
  });
});
