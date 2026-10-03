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
});
