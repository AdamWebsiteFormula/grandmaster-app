import chroma from "chroma-js";
import { type CSSProperties, useMemo } from "react";

import type { Segment, SegmentKey, SegmentWord } from "~/stt/live-segment";

export type HighlightSegment = { text: string; isMatch: boolean };

export type SentenceLine = {
  words: SegmentWord[];
  startMs: number;
  endMs: number;
};

type SegmentColorVars = CSSProperties & {
  "--segment-color-light": string;
  "--segment-color-dark": string;
};

export function groupWordsIntoLines(words: SegmentWord[]): SentenceLine[] {
  if (words.length === 0) return [];

  const lines: SentenceLine[] = [];
  let currentLine: SegmentWord[] = [];

  for (const word of words) {
    currentLine.push(word);
    const text = word.text.trim();
    if (text.endsWith(".") || text.endsWith("?") || text.endsWith("!")) {
      lines.push({
        words: currentLine,
        startMs: currentLine[0]!.start_ms,
        endMs: currentLine[currentLine.length - 1]!.end_ms,
      });
      currentLine = [];
    }
  }

  if (currentLine.length > 0) {
    lines.push({
      words: currentLine,
      startMs: currentLine[0]!.start_ms,
      endMs: currentLine[currentLine.length - 1]!.end_ms,
    });
  }

  return lines;
}

export function getActiveLineIndex(
  words: SegmentWord[],
  offsetMs: number,
  currentMs: number,
): number | null {
  if (currentMs <= 0 || words.length === 0) return null;

  let lineIndex = 0;
  let lineStartMs = words[0]!.start_ms;

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]!;
    const text = word.text.trim();
    const closesLine =
      text.endsWith(".") ||
      text.endsWith("?") ||
      text.endsWith("!") ||
      index === words.length - 1;

    if (!closesLine) {
      continue;
    }

    const start = offsetMs + lineStartMs;
    const end = offsetMs + word.end_ms;
    if (currentMs >= start && currentMs <= end) {
      return lineIndex;
    }

    lineIndex += 1;
    lineStartMs = words[index + 1]?.start_ms ?? lineStartMs;
  }

  return null;
}

export function getSegmentColor(
  key: SegmentKey,
  mode: "light" | "dark" = "light",
): string {
  let speakerIndex = key.speaker_index ?? 0;
  if (key.speaker_human_id) {
    speakerIndex = 0;
    for (const character of key.speaker_human_id) {
      speakerIndex =
        (Math.imul(speakerIndex, 31) + character.charCodeAt(0)) >>> 0;
    }
  }

  const channelOffset = key.speaker_human_id
    ? 0
    : key.channel === "RemoteParty"
      ? 180
      : 0;
  // Golden-angle spacing keeps consecutive speakers visually distinct.
  // Fork: start at a cool hue (220) at low chroma, so speakers never read as the orange accent.
  const hue = (220 + speakerIndex * 137.508 + channelOffset) % 360;

  // Light 0.52 keeps every hue at 4.5:1 or more on the light page (WCAG 1.4.3).
  return chroma.oklch(mode === "dark" ? 0.72 : 0.52, 0.1, hue).hex();
}

export function getSegmentColorVars(key: SegmentKey): SegmentColorVars {
  return {
    "--segment-color-light": getSegmentColor(key),
    "--segment-color-dark": getSegmentColor(key, "dark"),
  };
}

export function useSegmentColorVars(key: SegmentKey): SegmentColorVars {
  return useMemo(() => getSegmentColorVars(key), [key]);
}

// Fork: Granola lays the transcript out as chat bubbles: your lines on the
// right, everyone else on the left with the speaker name over the first bubble
// of a run, and a centered timestamp between runs (granola-compare-oct3 §2).
// Fork: a time label about every 30 s, as Granola's transcript shows
// (redline-oct3, H2).
export const TRANSCRIPT_TIMESTAMP_INTERVAL_MS = 30_000;

export type SegmentBubbleLayout = {
  /** Your own words (the mic channel, unless reassigned to someone else). */
  isSelf: boolean;
  /** First bubble of a speaker run: the speaker name shows above it. */
  startsRun: boolean;
  /** Centered time label shown before this bubble, or null. */
  timestamp: string | null;
};

export function isSelfSegmentKey(
  key: SegmentKey,
  selfHumanId?: string | null,
): boolean {
  if (key.channel !== "DirectMic") {
    return false;
  }
  return (
    key.speaker_human_id == null ||
    (Boolean(selfHumanId) && key.speaker_human_id === selfHumanId)
  );
}

export function formatTranscriptTimestamp(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mmss = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
}

export function getSegmentBubbleLayouts(
  segments: ReadonlyArray<{
    key: SegmentKey;
    words: ReadonlyArray<{ start_ms: number }>;
  }>,
  {
    offsetMs = 0,
    selfHumanId,
    speakerLabels,
  }: {
    offsetMs?: number;
    selfHumanId?: string | null;
    speakerLabels?: ReadonlyArray<string>;
  } = {},
): SegmentBubbleLayout[] {
  let lastLabelMs: number | null = null;
  let previousSpeaker: string | null = null;

  return segments.map((segment, index) => {
    const isSelf = isSelfSegmentKey(segment.key, selfHumanId);
    const firstWord = segment.words[0];
    let timestamp: string | null = null;
    if (firstWord) {
      const startMs = offsetMs + (firstWord.start_ms ?? 0);
      if (
        lastLabelMs === null ||
        startMs - lastLabelMs >= TRANSCRIPT_TIMESTAMP_INTERVAL_MS
      ) {
        timestamp = formatTranscriptTimestamp(startMs);
        lastLabelMs = startMs;
      }
    }

    const speaker = isSelf
      ? "self"
      : (speakerLabels?.[index] ??
        `${segment.key.channel}:${segment.key.speaker_index ?? ""}:${segment.key.speaker_human_id ?? ""}`);
    const startsRun = speaker !== previousSpeaker || timestamp !== null;
    previousSpeaker = speaker;

    return { isSelf, startsRun, timestamp };
  });
}

// Fork: some recognizers glue the end of one result to the next word
// ("messages.and"). Display only: put the missing space back after a
// sentence end. Stored words are never changed (redline-oct3, H2).
const NON_SENTENCE_SUFFIXES = new Set([
  "ai",
  "app",
  "co",
  "com",
  "css",
  "dev",
  "edu",
  "gov",
  "html",
  "io",
  "js",
  "json",
  "md",
  "net",
  "org",
  "pdf",
  "py",
  "ts",
  "txt",
  "uk",
  "us",
]);

export function repairJoinedSentences(text: string): string {
  if (/[/@]|www\./i.test(text)) {
    return text;
  }
  return text.replace(
    /(\p{Ll}{2,}[.?!]+)(\p{L}+)/gu,
    (match, before: string, after: string) =>
      NON_SENTENCE_SUFFIXES.has(after.toLowerCase())
        ? match
        : `${before} ${after}`,
  );
}

// Fork: one bubble per spoken result, as Granola sets its transcript, so a
// long monologue doesn't fill one bubble (redline-oct3, H2). Display only:
// the parts keep the segment's key and word ids, so edits, speaker changes
// and merges still act on the stored words.
export const TRANSCRIPT_BUBBLE_MAX_MS = 15_000;

function endsSentence(word: SegmentWord) {
  return /[.?!]["'”’)\]]*$/.test(word.text.trim());
}

function startsNewResult(word: SegmentWord) {
  return !/^\s/.test(word.text);
}

const displayPartsCache = new WeakMap<Segment, Segment[]>();

export function splitSegmentForDisplay(segment: Segment): Segment[] {
  const cached = displayPartsCache.get(segment);
  if (cached) {
    return cached;
  }

  const words = segment.words;
  // Results show as words without a leading space only when the recognizer
  // keeps leading spaces at all.
  const hasSpacedWords = words.some((word) => /^\s/.test(word.text));
  const groups: SegmentWord[][] = [];
  let current: SegmentWord[] = [];

  words.forEach((word, index) => {
    current.push(word);
    const next = words[index + 1];
    if (!next || !endsSentence(word)) {
      return;
    }
    const resultBoundary = hasSpacedWords && startsNewResult(next);
    const longEnough =
      word.end_ms - current[0]!.start_ms >= TRANSCRIPT_BUBBLE_MAX_MS;
    if (resultBoundary || longEnough) {
      groups.push(current);
      current = [];
    }
  });
  if (current.length > 0) {
    groups.push(current);
  }

  const parts =
    groups.length <= 1
      ? [segment]
      : groups.map((group, index) => ({
          ...segment,
          id: index === 0 ? segment.id : `${segment.id}#${index}`,
          start_ms: group[0]!.start_ms,
          end_ms: group[group.length - 1]!.end_ms,
          text: group.map((word) => word.text.trim()).join(" "),
          words: group,
        }));
  displayPartsCache.set(segment, parts);
  return parts;
}

export function splitSegmentsForDisplay(segments: Segment[]): Segment[] {
  return segments.flatMap(splitSegmentForDisplay);
}
