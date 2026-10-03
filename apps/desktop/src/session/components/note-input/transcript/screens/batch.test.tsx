import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BatchState } from "./batch";

const sticks = vi.hoisted(() => ({ props: vi.fn() }));

vi.mock("@anlg/ui/components/ui/dancing-sticks", () => ({
  DancingSticks: (props: unknown) => {
    sticks.props(props);
    return null;
  },
}));

vi.mock("~/stt/contexts", () => ({
  useListener: (selector: (state: unknown) => unknown) =>
    selector({
      live: {
        amplitude: { mic: 0, speaker: 0 },
        degraded: { type: "stream_error", message: "deepgram: overloaded" },
      },
    }),
}));

vi.mock("~/settings/queries", () => ({
  useStoredSettingValue: () => ({ value: "deepgram", hasValue: true }),
}));

describe("BatchState", () => {
  afterEach(cleanup);

  // Fork test: journey-meeting P3, tokens only (works in both themes).
  it("colors the bars with the muted text token, not a hex", () => {
    render(<BatchState requestedLiveTranscription={false} />);

    expect(sticks.props).toHaveBeenCalledWith(
      expect.objectContaining({ color: "hsl(var(--muted-foreground))" }),
    );
  });

  it("identifies intentional batch transcription", () => {
    render(<BatchState requestedLiveTranscription={false} />);

    expect(screen.getByText("Transcript comes after you stop")).not.toBeNull();
    expect(
      screen.getByText(
        "Recording continues. Your transcript appears here after you click Stop.",
      ),
    ).not.toBeNull();
  });

  it("reassures that audio is saved when live transcription fails", () => {
    render(<BatchState requestedLiveTranscription />);

    expect(screen.getByRole("status").textContent).toMatch(
      /^Live transcript paused because Deepgram is having an outage\./,
    );
  });
});
