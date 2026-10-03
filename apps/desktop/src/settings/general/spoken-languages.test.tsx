import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { SpokenLanguagesView } from "./spoken-languages";

describe("SpokenLanguagesView", () => {
  beforeAll(() => {
    // cmdk scrolls the active option into view; jsdom has no layout.
    Element.prototype.scrollIntoView ??= vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it("is a row with a small Add language button, not a full-width field", () => {
    render(
      <SpokenLanguagesView
        mainLanguage="en"
        value={[]}
        onChange={() => {}}
        supportedLanguages={["en", "es", "de"]}
      />,
    );
    const button = screen.getByRole("button", { name: "Add language" });
    expect(button.className).toContain("h-7");
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("opens the searchable list and adds a language", () => {
    const onChange = vi.fn();
    render(
      <SpokenLanguagesView
        mainLanguage="en"
        value={["es"]}
        onChange={onChange}
        supportedLanguages={["en", "es", "de"]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add language" }));
    const options = screen.getAllByRole("option");
    // The main language and the ones already added are not offered.
    expect(options).toHaveLength(1);
    fireEvent.click(options[0]);
    expect(onChange).toHaveBeenCalledWith(["es", "de"]);
  });

  it("lists added languages as chips that can be removed", () => {
    const onChange = vi.fn();
    render(
      <SpokenLanguagesView
        mainLanguage="en"
        value={["es", "de"]}
        onChange={onChange}
        supportedLanguages={["en", "es", "de"]}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /^Remove Spanish/ }));
    expect(onChange).toHaveBeenCalledWith(["de"]);
  });
});
