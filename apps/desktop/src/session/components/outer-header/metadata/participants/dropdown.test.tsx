import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ParticipantDropdown, participantOptionId } from "./dropdown";

describe("ParticipantDropdown", () => {
  // jsdom has no layout, so no scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();

  afterEach(() => {
    cleanup();
  });

  it("is a listbox whose options VoiceOver can read and the input can point to", () => {
    const onSelect = vi.fn();
    render(
      <ParticipantDropdown
        listboxId="people"
        floatingRef={() => {}}
        floatingStyles={{}}
        options={[
          { id: "h1", name: "Micah McBryde" },
          { id: "new", name: "Jordan", isNew: true },
        ]}
        selectedIndex={1}
        onSelect={onSelect}
        onHover={() => {}}
      />,
    );

    const list = screen.getByRole("listbox", { name: "Suggested people" });
    expect(list.id).toBe("people");

    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.id)).toEqual([
      participantOptionId("people", 0),
      participantOptionId("people", 1),
    ]);
    expect(options[0].getAttribute("aria-selected")).toBe("false");
    expect(options[1].getAttribute("aria-selected")).toBe("true");
    expect(options[1].textContent).toMatch(/Add “.*Jordan.*”/);

    fireEvent.click(options[0]);
    expect(onSelect).toHaveBeenCalledWith({ id: "h1", name: "Micah McBryde" });
  });
});
