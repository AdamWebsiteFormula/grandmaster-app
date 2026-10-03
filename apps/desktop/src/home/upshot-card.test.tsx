import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sources: [] as unknown[],
  openCurrent: vi.fn(),
}));

vi.mock("./home-data", () => ({
  useUpshot: () => ({ isLoading: false, sources: mocks.sources }),
}));

vi.mock("~/store/zustand/tabs", () => ({
  useTabs: (
    selector: (state: { openCurrent: typeof mocks.openCurrent }) => unknown,
  ) => selector({ openCurrent: mocks.openCurrent }),
}));

import { parseUpshot, UpshotCard } from "./upshot-card";

const SUMMARY = `# Pricing decision

- Annual plan moves to **$96** for new customers
- Monthly stays the same

# Launch

- Ship on Oct 12

# Next steps

- [ ] Ana sends the pricing page copy by Friday
- Bo updates Stripe
  - nested detail
- Cam books the launch review
- Dee writes the changelog
`;

describe("parseUpshot", () => {
  it("takes the first bullet of the first section and the next steps", () => {
    expect(parseUpshot(SUMMARY)).toEqual({
      lead: "Annual plan moves to $96 for new customers",
      nextSteps: [
        "Ana sends the pricing page copy by Friday",
        "Bo updates Stripe",
        "Cam books the launch review",
        "Dee writes the changelog",
      ],
    });
  });

  it("matches the heading case-insensitively, and Action items", () => {
    expect(
      parseUpshot("# Recap\n- Done\n## NEXT STEPS\n- One").nextSteps,
    ).toEqual(["One"]);
    expect(
      parseUpshot("# Recap\n- Done\n# Action items:\n* Two").nextSteps,
    ).toEqual(["Two"]);
  });

  it("returns no next steps without that section", () => {
    expect(parseUpshot("# Recap\n- We agreed on scope\n- Other")).toEqual({
      lead: "We agreed on scope",
      nextSteps: [],
    });
  });

  it("skips a leading Next steps section for the lead", () => {
    expect(parseUpshot("# Next steps\n- Call Ana\n# Recap\n- Signed")).toEqual({
      lead: "Signed",
      nextSteps: ["Call Ana"],
    });
  });

  it("falls back to plain text and handles empty input", () => {
    expect(parseUpshot("Just one line of text.").lead).toBe(
      "Just one line of text.",
    );
    expect(parseUpshot("")).toEqual({ lead: "", nextSteps: [] });
    expect(parseUpshot("   \n\n")).toEqual({ lead: "", nextSteps: [] });
  });
});

describe("UpshotCard", () => {
  beforeEach(() => {
    mocks.sources = [];
    mocks.openCurrent.mockClear();
  });
  afterEach(cleanup);

  it("is hidden when no note has a summary", () => {
    const { container } = render(<UpshotCard />);
    expect(container.firstChild).toBeNull();
  });

  it("is hidden when the summary has nothing to show", () => {
    mocks.sources = [
      { sessionId: "s1", title: "Empty", timeMs: Date.now(), markdown: "" },
    ];
    const { container } = render(<UpshotCard />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the lead, up to three next steps, and opens the note", () => {
    mocks.sources = [
      {
        sessionId: "s1",
        title: "Pricing sync",
        timeMs: Date.now(),
        markdown: SUMMARY,
      },
    ];
    render(<UpshotCard />);

    expect(screen.getByRole("heading", { name: "The upshot" })).toBeTruthy();
    expect(
      screen.getByText("Annual plan moves to $96 for new customers").className,
    ).toContain("line-clamp-2");
    expect(screen.getByText("Next steps")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByText("Dee writes the changelog")).toBeNull();
    expect(document.querySelectorAll("[data-upshot-marker]")).toHaveLength(3);
    expect(screen.getByText("AI summary, may contain mistakes")).toBeTruthy();
    expect(screen.getByText("From Pricing sync")).toBeTruthy();
    expect(screen.getByText(/Today/)).toBeTruthy();

    fireEvent.click(screen.getByText("Bo updates Stripe"));
    expect(mocks.openCurrent).toHaveBeenCalledWith({
      type: "sessions",
      id: "s1",
    });
    fireEvent.click(screen.getByText("From Pricing sync"));
    fireEvent.click(
      screen.getByText("Annual plan moves to $96 for new customers"),
    );
    expect(mocks.openCurrent).toHaveBeenCalledTimes(3);
  });

  it("shows the lead only without a Next steps section", () => {
    mocks.sources = [
      {
        sessionId: "s2",
        title: "",
        timeMs: Date.now() - 24 * 60 * 60 * 1000,
        markdown: "# Recap\n- Scope is final",
      },
    ];
    render(<UpshotCard />);
    expect(screen.getByText("Scope is final")).toBeTruthy();
    expect(screen.queryByText("Next steps")).toBeNull();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByText(/Yesterday/)).toBeTruthy();
  });
});
