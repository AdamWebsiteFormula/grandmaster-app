import { t } from "@lingui/core/macro";
import { Fragment, memo, useMemo } from "react";

import { cn } from "@anlg/utils";

import type { HighlightSegment } from "./utils";

import type { SegmentWord } from "~/stt/live-segment";
import { isTranscriptWordSeekable } from "~/stt/timing";

interface WordSpanProps {
  word: SegmentWord;
  displayText: string;
  audioExists: boolean;
  onClickWord: (word: SegmentWord) => void;
  highlightSegments?: HighlightSegment[];
  isActiveMatch?: boolean;
}

// Fork: Granola keeps no audio, so it has nothing to play back. Teach the
// click-to-hear gesture with a hover hint until the first word is clicked.
const WORD_SEEK_HINT_KEY = "upshot.transcript-word-seek-hint-seen";
let wordSeekHintSeen = readWordSeekHintSeen();

function readWordSeekHintSeen() {
  try {
    return localStorage.getItem(WORD_SEEK_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

function markWordSeekHintSeen() {
  if (wordSeekHintSeen) return;
  wordSeekHintSeen = true;
  try {
    localStorage.setItem(WORD_SEEK_HINT_KEY, "1");
  } catch {
    // Hint just shows again next launch.
  }
}

export const WordSpan = memo(function WordSpan(props: WordSpanProps) {
  const content = useHighlightedContent(
    props.word,
    props.displayText,
    props.highlightSegments,
    props.isActiveMatch ?? false,
  );
  const canSeek = props.audioExists && isTranscriptWordSeekable(props.word);
  const className = useMemo(
    () =>
      cn([
        canSeek && "hover:bg-accent/60 cursor-pointer",
        !props.word.is_final && ["opacity-60", "italic"],
      ]),
    [canSeek, props.word.is_final],
  );

  return (
    <span
      onClick={() => {
        if (!canSeek) return;
        markWordSeekHintSeen();
        props.onClickWord(props.word);
      }}
      title={
        canSeek && !wordSeekHintSeen ? t`Click any word to hear it` : undefined
      }
      className={className}
      data-transcript-word-id={props.word.id}
      data-transcript-word-start-ms={props.word.start_ms}
    >
      {content}
    </span>
  );
});

function useHighlightedContent(
  word: SegmentWord,
  displayText: string,
  segments: HighlightSegment[] | undefined,
  isActive: boolean,
) {
  return useMemo(() => {
    if (!segments) {
      return displayText;
    }

    const baseKey = word.id ?? word.text ?? "word";

    return segments.map((segment, index) =>
      segment.isMatch ? (
        <span
          key={`${baseKey}-match-${index}`}
          className={isActive ? "bg-primary/60" : "bg-primary/20"}
        >
          {segment.text}
        </span>
      ) : (
        <Fragment key={`${baseKey}-text-${index}`}>{segment.text}</Fragment>
      ),
    );
  }, [displayText, isActive, segments, word.id, word.text]);
}
