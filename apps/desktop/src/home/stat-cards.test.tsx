import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  stats: {
    isLoading: false,
    notes: null as null | Record<string, number>,
    talk: [] as Array<{ channel: number; words: number; speech_ms: number }>,
    meetings: [] as Array<{ started_at_ms: number; enhanced: number }>,
  },
  config: {
    current_llm_provider: undefined as string | undefined,
    current_llm_model: undefined as string | undefined,
  },
}));

vi.mock("./queries", () => ({ useHomeStats: () => mocks.stats }));
vi.mock("~/shared/config", () => ({ useConfigValues: () => mocks.config }));

import { HomeStatCards } from "./stat-cards";

describe("HomeStatCards", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows calls to action, not zeros, with no meetings", () => {
    mocks.stats.notes = {
      total_words: 0,
      month_generations: 0,
      month_output_words: 0,
      month_input_chars: 0,
    };
    mocks.stats.talk = [];
    mocks.stats.meetings = [];
    mocks.config.current_llm_provider = undefined;
    render(<HomeStatCards />);

    expect(
      screen.getByText("Enhance a meeting to start saving time"),
    ).toBeTruthy();
    expect(
      screen.getByText("Record a meeting to see how much you talk"),
    ).toBeTruthy();
    expect(
      screen.getByText("Wrap up today's meeting to start a streak"),
    ).toBeTruthy();
    expect(screen.queryByText(/^0/)).toBeNull();
    expect(screen.queryByText(/AI cost/)).toBeNull();
  });

  it("shows plausible numbers for three enhanced meetings", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 1, 15, 0)); // Thursday
    mocks.stats.notes = {
      total_words: 1_500,
      month_generations: 3,
      month_output_words: 1_500,
      month_input_chars: 120_000,
    };
    mocks.stats.talk = [
      { channel: 0, words: 1_140, speech_ms: 8 * 60_000 },
      { channel: 1, words: 2_000, speech_ms: 12 * 60_000 },
    ];
    mocks.stats.meetings = [
      { started_at_ms: new Date(2026, 9, 1, 10).getTime(), enhanced: 1 },
      { started_at_ms: new Date(2026, 8, 30, 10).getTime(), enhanced: 1 },
      { started_at_ms: new Date(2026, 8, 29, 10).getTime(), enhanced: 1 },
    ];
    mocks.config.current_llm_provider = "anthropic";
    mocks.config.current_llm_model = "claude-sonnet-5-5";
    render(<HomeStatCards />);

    expect(screen.getByText("38 min")).toBeTruthy();
    expect(screen.getByText("That's a lunch break")).toBeTruthy();
    expect(screen.getByText("40%")).toBeTruthy();
    expect(
      screen.getByText(
        "You did 40% of the talking this week, at 143 words a minute",
      ),
    ).toBeTruthy();
    expect(screen.getByText("3 days")).toBeTruthy();
    // (30,000 + 4,500 tokens) × $2/M + 2,250 tokens × $10/M ≈ $0.09
    expect(
      screen.getByText("AI cost this month ≈ $0.09 · Granola Business $14/mo"),
    ).toBeTruthy();
  });
});
