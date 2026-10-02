import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WordSpan } from "./word-span";

import type { SegmentWord } from "~/stt/live-segment";

const word = {
  id: "w1",
  text: "hello",
  start_ms: 1000,
  end_ms: 1400,
  channel: 0,
  is_final: true,
} as unknown as SegmentWord;

describe("WordSpan", () => {
  afterEach(cleanup);

  it("has no hint when there is no audio to play", () => {
    render(
      <WordSpan
        word={word}
        displayText="hello"
        audioExists={false}
        onClickWord={vi.fn()}
      />,
    );

    expect(screen.getByText("hello").getAttribute("title")).toBeNull();
  });

  it("hints that words play until the first click", () => {
    const onClickWord = vi.fn();
    const { rerender } = render(
      <WordSpan
        word={word}
        displayText="hello"
        audioExists
        onClickWord={onClickWord}
      />,
    );

    const span = screen.getByText("hello");
    expect(span.getAttribute("title")).toBe("Click any word to hear it");

    fireEvent.click(span);
    expect(onClickWord).toHaveBeenCalledWith(word);
    expect(localStorage.getItem("upshot.transcript-word-seek-hint-seen")).toBe(
      "1",
    );

    rerender(
      <WordSpan
        word={{ ...word, id: "w2" } as SegmentWord}
        displayText="hello"
        audioExists
        onClickWord={onClickWord}
      />,
    );
    expect(screen.getByText("hello").getAttribute("title")).toBeNull();
  });
});
