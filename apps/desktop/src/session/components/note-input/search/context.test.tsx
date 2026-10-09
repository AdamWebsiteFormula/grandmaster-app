import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SearchProvider, useSearch } from "./context";

function Probe() {
  const search = useSearch()!;
  return (
    <div>
      <button type="button" onClick={search.open}>
        Open search
      </button>
      <span data-testid="visible">{search.isVisible ? "yes" : "no"}</span>
      <div role="menu">
        <button type="button">Menu item</button>
      </div>
    </div>
  );
}

// Fork tests: task test, Oct 9 (Escape in a popover also closed search).
describe("SearchProvider Escape", () => {
  afterEach(cleanup);

  it("leaves search open when Escape closes a menu on top of it", () => {
    render(
      <SearchProvider>
        <Probe />
      </SearchProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open search" }));
    expect(screen.getByTestId("visible").textContent).toBe("yes");

    act(() => {
      fireEvent.keyDown(screen.getByRole("button", { name: "Menu item" }), {
        key: "Escape",
      });
    });

    expect(screen.getByTestId("visible").textContent).toBe("yes");
  });

  it("closes search on Escape elsewhere", () => {
    render(
      <SearchProvider>
        <Probe />
      </SearchProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open search" }));

    act(() => {
      fireEvent.keyDown(document.body, { key: "Escape" });
    });

    expect(screen.getByTestId("visible").textContent).toBe("no");
  });
});
