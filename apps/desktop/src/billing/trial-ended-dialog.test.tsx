import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TrialEndedDialog } from "./trial-ended-dialog";

describe("TrialEndedDialog", () => {
  afterEach(cleanup);

  // Fork: Upshot transcription is free on every computer, so the dialog
  // promises only that transcription keeps working, not a local engine or
  // a paid cloud one.
  it("says transcription keeps working after the trial", () => {
    render(
      <TrialEndedDialog open onOpenChange={() => {}} onUpgrade={() => {}} />,
    );

    expect(
      screen.getByText(
        "Your notes and recordings are safe, and transcription keeps working. Upgrade anytime to keep Pro features.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/local transcription/)).toBeNull();
    expect(screen.queryByText(/keep cloud transcription/)).toBeNull();
  });
});
