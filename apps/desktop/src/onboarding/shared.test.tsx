import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OnboardingSection } from "./shared";

describe("OnboardingSection", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  // WCAG 2.2 SC 2.4.3: focus follows the step that just opened.
  it("moves focus to the heading of the step that becomes active", () => {
    vi.useFakeTimers();
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    render(
      <OnboardingSection title="Connect calendar" status="active">
        <button type="button">Continue</button>
      </OnboardingSection>,
    );
    act(() => {
      vi.runAllTimers();
    });

    const heading = screen.getByRole("heading", { name: "Connect calendar" });
    expect(heading.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(heading);
    expect(scrollIntoView).toHaveBeenCalled();
  });

  // NN/g #8: "Step 1 of 1" tells nothing, so a single step shows no count.
  it("shows the step count only when there is more than one step", () => {
    Element.prototype.scrollIntoView = vi.fn();
    const { rerender } = render(
      <OnboardingSection
        title="Ready to go"
        status="active"
        progress={{ current: 1, total: 1 }}
      >
        <button type="button">Open Upshot</button>
      </OnboardingSection>,
    );
    expect(screen.queryByText("Step 1 of 1")).toBeNull();

    rerender(
      <OnboardingSection
        title="Ready to go"
        status="active"
        progress={{ current: 2, total: 2 }}
      >
        <button type="button">Open Upshot</button>
      </OnboardingSection>,
    );
    expect(screen.getByText("Step 2 of 2")).toBeTruthy();
  });
});
