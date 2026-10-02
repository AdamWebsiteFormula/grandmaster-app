import { describe, expect, it } from "vitest";

import {
  estimateCostUsd,
  formatMinutes,
  formatUsd,
  minutesSaved,
  priceFor,
  talkShare,
  timeSavedTier,
  wrapUpStreak,
} from "./stats";

// Thursday, Oct 1 2026, 3 PM local time.
const NOW = new Date(2026, 9, 1, 15, 0);
const at = (month: number, day: number, hour = 10) =>
  new Date(2026, month, day, hour).getTime();
const meeting = (month: number, day: number, enhanced: boolean) => ({
  started_at_ms: at(month, day),
  enhanced: enhanced ? 1 : 0,
});

describe("time saved", () => {
  it("turns words into minutes at 40 wpm", () => {
    expect(minutesSaved(0)).toBe(0);
    expect(minutesSaved(-5)).toBe(0);
    expect(minutesSaved(400)).toBe(10);
    expect(minutesSaved(4_800)).toBe(120);
  });

  it("formats durations without ever showing zero", () => {
    expect(formatMinutes(0.2)).toBe("1 min");
    expect(formatMinutes(42)).toBe("42 min");
    expect(formatMinutes(200)).toBe("3 h 20 min");
    expect(formatMinutes(180)).toBe("3 h");
    expect(formatMinutes(725)).toBe("12 h");
  });

  it("grows the plain-English line with the total", () => {
    expect(timeSavedTier(10)).toBe("coffee");
    expect(timeSavedTier(30)).toBe("lunch");
    expect(timeSavedTier(8 * 60)).toBe("workday");
    expect(timeSavedTier(40 * 60)).toBe("week");
  });
});

describe("talk share", () => {
  it("is your share of speaking time with your wpm", () => {
    const share = talkShare([
      { channel: 0, words: 1_140, speech_ms: 8 * 60_000 },
      { channel: 1, words: 2_000, speech_ms: 12 * 60_000 },
    ]);
    expect(share).toEqual({ percent: 40, wpm: 143 });
  });

  it("ignores mixed-capture words (channel 2)", () => {
    const share = talkShare([
      { channel: 0, words: 300, speech_ms: 2 * 60_000 },
      { channel: 1, words: 300, speech_ms: 2 * 60_000 },
      { channel: 2, words: 9_000, speech_ms: 60 * 60_000 },
    ]);
    expect(share?.percent).toBe(50);
  });

  it("returns null (call to action) with too little speech", () => {
    expect(talkShare([])).toBeNull();
    expect(
      talkShare([
        { channel: 0, words: 10, speech_ms: 5_000 },
        { channel: 1, words: 10, speech_ms: 5_000 },
      ]),
    ).toBeNull();
  });

  it("drops wpm when you spoke under a minute", () => {
    const share = talkShare([
      { channel: 0, words: 50, speech_ms: 20_000 },
      { channel: 1, words: 500, speech_ms: 5 * 60_000 },
    ]);
    expect(share?.wpm).toBeNull();
    expect(share?.percent).toBe(6);
  });
});

describe("wrap-up streak", () => {
  it("is zero with no meetings", () => {
    expect(wrapUpStreak([], NOW)).toEqual({ days: 0, todayPending: false });
  });

  it("counts consecutive wrapped-up workdays", () => {
    const meetings = [
      meeting(9, 1, true), // Thu
      meeting(8, 30, true), // Wed
      meeting(8, 29, true), // Tue
      meeting(8, 28, false), // Mon: broke here
      meeting(8, 25, true),
    ];
    expect(wrapUpStreak(meetings, NOW)).toEqual({
      days: 3,
      todayPending: false,
    });
  });

  it("is not broken by weekends, even unwrapped weekend meetings", () => {
    const meetings = [
      meeting(9, 1, true), // Thu
      meeting(8, 28, true), // Mon
      meeting(8, 27, false), // Sun, not wrapped up
      meeting(8, 26, false), // Sat, not wrapped up
      meeting(8, 25, true), // Fri
    ];
    expect(wrapUpStreak(meetings, NOW).days).toBe(3);
  });

  it("is not broken by workdays without meetings", () => {
    const meetings = [
      meeting(9, 1, true), // Thu
      // Wed and Tue: no meetings
      meeting(8, 28, true), // Mon
    ];
    expect(wrapUpStreak(meetings, NOW).days).toBe(2);
  });

  it("needs every meeting of a day wrapped up", () => {
    const meetings = [
      meeting(9, 1, true),
      meeting(8, 30, true),
      { started_at_ms: at(8, 30, 16), enhanced: 0 },
    ];
    expect(wrapUpStreak(meetings, NOW).days).toBe(1);
  });

  it("keeps the streak while today's meeting is still pending", () => {
    const meetings = [
      meeting(9, 1, false), // today, not yet wrapped up
      meeting(8, 30, true),
      meeting(8, 29, true),
    ];
    expect(wrapUpStreak(meetings, NOW)).toEqual({
      days: 2,
      todayPending: true,
    });
  });

  it("works when today is a weekend day", () => {
    const saturday = new Date(2026, 9, 3, 12, 0);
    const meetings = [meeting(9, 2, true), meeting(9, 1, true)];
    expect(wrapUpStreak(meetings, saturday).days).toBe(2);
  });

  it("ignores meetings in the future", () => {
    const meetings = [meeting(9, 5, false), meeting(9, 1, true)];
    expect(wrapUpStreak(meetings, NOW).days).toBe(1);
  });
});

describe("AI cost estimate", () => {
  it("prices local and subscription providers at zero", () => {
    expect(priceFor("ollama", "llama3")).toEqual({ kind: "local" });
    expect(priceFor("apple_foundation", "")).toEqual({ kind: "local" });
    expect(priceFor("claude", "claude-sonnet-5-5")).toEqual({
      kind: "subscription",
    });
    expect(priceFor(undefined, undefined)).toBeNull();
  });

  it("uses cheaper rates for Haiku and Gemini Flash", () => {
    expect(priceFor("anthropic", "claude-haiku-4-5")).toMatchObject({
      inputPerMillion: 1,
      outputPerMillion: 5,
    });
    expect(priceFor("google_generative_ai", "gemini-3.8-flash")).toMatchObject(
      { inputPerMillion: 0.75, outputPerMillion: 3.75 },
    );
    expect(priceFor("openai", "gpt-6.1")).toMatchObject({
      inputPerMillion: 2,
      outputPerMillion: 10,
    });
  });

  it("estimates chars ÷ 4 plus prompt overhead at list price", () => {
    const price = priceFor("anthropic", "claude-sonnet-5-5")!;
    // 10 notes, 40,000 transcript chars each, 500 words written each.
    const usd = estimateCostUsd(
      { generations: 10, input_chars: 400_000, output_words: 5_000 },
      price,
    );
    // Input: 100,000 + 15,000 tokens at $2/M = $0.23.
    // Output: 5,000 × 6 ÷ 4 = 7,500 tokens at $10/M = $0.075.
    expect(usd).toBeCloseTo(0.305, 5);
    expect(formatUsd(usd)).toBe("$0.30");
  });

  it("is zero off the API and formats tiny amounts", () => {
    const usage = { generations: 3, input_chars: 9_000, output_words: 600 };
    expect(estimateCostUsd(usage, { kind: "local" })).toBe(0);
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(0.004)).toBe("< $0.01");
  });
});
