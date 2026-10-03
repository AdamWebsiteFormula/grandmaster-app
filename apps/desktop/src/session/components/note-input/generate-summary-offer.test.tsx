import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: {
    title: "Launch review",
    raw_md: "",
  } as { title: string; raw_md: string } | null,
  sessionMode: "inactive",
  hasTranscript: true,
  notes: [] as Array<{ id: string; content: string }>,
  isEnhancing: false,
  eligibility: { eligible: true } as {
    eligible: boolean;
    code?: string;
  },
  enhance: vi.fn(),
  checkEligibility: vi.fn(),
  updateSessionTabState: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
  modelNotReady: vi.fn(),
}));

vi.mock("@anlg/ui/components/ui/toast", () => ({ toast: mocks.toast }));
vi.mock("./enhanced/model-not-ready", () => ({
  showModelNotReadyToast: mocks.modelNotReady,
}));
vi.mock("~/services/enhancer", () => ({
  getEnhancerService: () => ({
    enhance: mocks.enhance,
    checkEligibility: mocks.checkEligibility,
  }),
}));
vi.mock("~/session/components/shared", () => ({
  useHasTranscript: () => mocks.hasTranscript,
  hasStoredNoteContent: (value: unknown) =>
    typeof value === "string" && value.trim().length > 0,
}));
vi.mock("~/session/hooks/useEnhancedNotes", () => ({
  useIsSessionEnhancing: () => mocks.isEnhancing,
}));
vi.mock("~/session/queries", () => ({
  useSession: () => mocks.session,
  useEnhancedNoteRecords: () => mocks.notes,
}));
vi.mock("~/stt/contexts", () => ({
  useListener: (selector: (state: unknown) => unknown) =>
    selector({ getSessionMode: () => mocks.sessionMode }),
}));
vi.mock("~/store/zustand/tabs", () => ({
  useTabs: {
    getState: () => ({
      tabs: [{ type: "sessions", id: "session-1", state: { view: null } }],
      updateSessionTabState: mocks.updateSessionTabState,
    }),
  },
}));

import {
  GenerateSummaryOffer,
  shouldOfferGenerateSummary,
} from "./generate-summary-offer";

const setOnline = (online: boolean) => {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => online,
  });
};

// Fork tests: installed-build review Oct 3 (P1: no way to make a summary
// after Stop). Granola 101: enhance notes after the meeting.
describe("shouldOfferGenerateSummary", () => {
  const base = {
    sessionMode: "inactive" as const,
    hasTranscript: true,
    hasNotes: false,
    hasSummary: false,
    isGenerating: false,
  };

  it("offers after Stop with a transcript or typed notes", () => {
    expect(shouldOfferGenerateSummary(base)).toBe(true);
    expect(
      shouldOfferGenerateSummary({
        ...base,
        hasTranscript: false,
        hasNotes: true,
      }),
    ).toBe(true);
  });

  it("stays away while recording, finishing, generating, with a summary, or with nothing to summarize", () => {
    for (const sessionMode of ["active", "finalizing", "running_batch"]) {
      expect(
        shouldOfferGenerateSummary({
          ...base,
          sessionMode: sessionMode as typeof base.sessionMode,
        }),
      ).toBe(false);
    }
    expect(shouldOfferGenerateSummary({ ...base, isGenerating: true })).toBe(
      false,
    );
    expect(shouldOfferGenerateSummary({ ...base, hasSummary: true })).toBe(
      false,
    );
    expect(shouldOfferGenerateSummary({ ...base, hasTranscript: false })).toBe(
      false,
    );
  });
});

describe("GenerateSummaryOffer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setOnline(true);
    mocks.session = { title: "Launch review", raw_md: "" };
    mocks.sessionMode = "inactive";
    mocks.hasTranscript = true;
    mocks.notes = [];
    mocks.isEnhancing = false;
    mocks.checkEligibility.mockResolvedValue({ eligible: true });
    mocks.enhance.mockResolvedValue({ type: "started", noteId: "note-9" });
  });

  afterEach(cleanup);

  it("offers Generate summary after a meeting with no summary", async () => {
    render(<GenerateSummaryOffer sessionId="session-1" />);

    expect(
      screen.getByText("No summary yet. Turn this meeting into clear notes."),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Generate summary" }),
    ).not.toBeNull();
    await waitFor(() =>
      expect(mocks.checkEligibility).toHaveBeenCalledWith("session-1"),
    );
  });

  it("says too little was said, and offers to use the typed notes", async () => {
    mocks.session = { title: "Launch review", raw_md: "Ship Sunday" };
    mocks.checkEligibility.mockResolvedValue({
      eligible: false,
      code: "transcript_too_short",
    });
    render(<GenerateSummaryOffer sessionId="session-1" />);

    expect(
      await screen.findByText(
        "Too little was said for a full summary. Generate one from your notes anyway?",
      ),
    ).not.toBeNull();
  });

  it("offers from typed notes alone, with no transcript", () => {
    mocks.hasTranscript = false;
    mocks.session = { title: "", raw_md: "Ship Sunday" };
    render(<GenerateSummaryOffer sessionId="session-1" />);

    expect(
      screen.getByText("No summary yet. Turn your notes into a clear summary."),
    ).not.toBeNull();
    expect(mocks.checkEligibility).not.toHaveBeenCalled();
  });

  it("generates even when the transcript is short, then shows the summary", async () => {
    render(<GenerateSummaryOffer sessionId="session-1" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Generate summary" }));
    });

    expect(mocks.enhance).toHaveBeenCalledWith("session-1", {
      allowShortTranscript: true,
    });
    expect(mocks.updateSessionTabState).toHaveBeenCalledWith(
      expect.objectContaining({ id: "session-1" }),
      expect.objectContaining({ view: { type: "enhanced", id: "note-9" } }),
    );
  });

  it("says why when Upshot AI is not ready", async () => {
    mocks.enhance.mockResolvedValue({ type: "no_model" });
    render(<GenerateSummaryOffer sessionId="session-1" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Generate summary" }));
    });

    expect(mocks.modelNotReady).toHaveBeenCalled();
    expect(mocks.updateSessionTabState).not.toHaveBeenCalled();
  });

  it("explains offline and does not start a run that can only fail", async () => {
    setOnline(false);
    render(<GenerateSummaryOffer sessionId="session-1" />);

    expect(
      screen.getByText(
        "You're offline. Connect to the internet to generate a summary.",
      ),
    ).not.toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Generate summary" }));
    });
    expect(mocks.enhance).not.toHaveBeenCalled();
    expect(mocks.toast.error).toHaveBeenCalled();
  });

  it("hides while recording, while generating, and once a summary exists", () => {
    mocks.sessionMode = "active";
    const { rerender } = render(<GenerateSummaryOffer sessionId="session-1" />);
    expect(document.querySelector("[data-generate-summary-offer]")).toBeNull();

    mocks.sessionMode = "inactive";
    mocks.isEnhancing = true;
    rerender(<GenerateSummaryOffer sessionId="session-1" />);
    expect(document.querySelector("[data-generate-summary-offer]")).toBeNull();

    mocks.isEnhancing = false;
    mocks.notes = [{ id: "note-1", content: "## Decisions\n\nShip Sunday" }];
    rerender(<GenerateSummaryOffer sessionId="session-1" />);
    expect(document.querySelector("[data-generate-summary-offer]")).toBeNull();
  });
});
