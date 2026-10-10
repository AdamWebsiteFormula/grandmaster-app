import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ConfirmDeleteHost, confirmDelete } from "./confirm-delete";

describe("confirmDelete", () => {
  afterEach(() => {
    cleanup();
  });

  it("deletes only after the red button is pressed", async () => {
    render(<ConfirmDeleteHost />);

    let answer: Promise<boolean> = Promise.resolve(false);
    act(() => {
      answer = confirmDelete("Delete this automation?");
    });

    expect(await screen.findByText("Delete this automation?")).toBeTruthy();
    expect(screen.getByText("You can't undo this.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await expect(answer).resolves.toBe(true);
  });

  it("keeps the item when Cancel is pressed", async () => {
    render(<ConfirmDeleteHost />);

    let answer: Promise<boolean> = Promise.resolve(true);
    act(() => {
      answer = confirmDelete("Revoke this key?", "Revoke");
    });

    await screen.findByText("Revoke this key?");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await expect(answer).resolves.toBe(false);
  });
});
