import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SectionsList } from "./sections-editor";

const items = [
  { title: "Summary", description: "Two or three sentences on the outcome." },
];

function classes(element: HTMLElement) {
  return element.className.split(/\s+/);
}

describe("SectionsList", () => {
  afterEach(cleanup);

  // Fork: the template screen review of Oct 4 (NN/g #4, consistency): the
  // fields look like the Settings text fields, on a band with no fill.
  it.each([true, false])(
    "draws each section as a house field on a band with no fill (disabled: %s)",
    (disabled) => {
      render(
        <SectionsList disabled={disabled} items={items} onChange={vi.fn()} />,
      );

      const field = screen.getByDisplayValue(items[0].description);
      expect(classes(field)).toEqual(
        expect.arrayContaining(["bg-card", "dark:bg-muted", "border-input"]),
      );
      expect(classes(field)).not.toContain("bg-muted");

      const band = field.closest(".group");
      expect(band).toBeTruthy();
      expect(classes(band as HTMLElement)).not.toContain("bg-card");
    },
  );

  // Fork: WCAG 2.2 SC 1.4.3. A read-only label used the Input's
  // disabled:opacity-50, about 3.3:1 on white.
  it("keeps a read-only label at full opacity in the muted text color", () => {
    render(<SectionsList disabled items={items} onChange={vi.fn()} />);

    const label = classes(screen.getByDisplayValue("Summary"));
    expect(label).toContain("disabled:text-muted-foreground");
    expect(label).toContain("disabled:opacity-100");
    expect(label).not.toContain("disabled:opacity-50");
  });

  it("puts the cursor in a new section's name", () => {
    render(<SectionsList disabled={false} items={items} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Add section" }));

    const names = screen.getAllByRole("textbox", { name: "Section name" });
    expect(document.activeElement).toBe(names[names.length - 1]);
  });
});
