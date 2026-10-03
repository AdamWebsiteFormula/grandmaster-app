import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canShareNotes: false,
  copyNotes: vi.fn(),
  sendNotesViaEmail: vi.fn(),
}));

vi.mock("./share-actions", () => ({
  useNoteShareActions: () => ({
    canShareNotes: mocks.canShareNotes,
    copyNotes: mocks.copyNotes,
    sendNotesViaEmail: mocks.sendNotesViaEmail,
  }),
}));
vi.mock("./overflow/export-modal", () => ({ ExportModal: () => null }));

import { ShareMenu } from "./share-menu";

function openMenu() {
  render(<ShareMenu sessionId="session-1" currentView={{ type: "raw" }} />);
  fireEvent.pointerDown(screen.getByRole("button", { name: "Share" }), {
    button: 0,
    ctrlKey: false,
  });
}

// Fork: journey-after P3 "Share menu, empty note".
describe("ShareMenu", () => {
  afterEach(() => {
    cleanup();
    mocks.canShareNotes = false;
  });

  it("says why Copy and Send are off on an empty note", async () => {
    openMenu();
    const copy = await screen.findByRole("menuitem", { name: /Copy notes/ });
    const send = screen.getByRole("menuitem", { name: /Send notes via email/ });
    for (const item of [copy, send]) {
      expect(item.getAttribute("aria-disabled")).toBe("true");
      expect(item.getAttribute("title")).toBe("Nothing to share yet");
    }
  });

  it("has no hint once there is something to share", async () => {
    mocks.canShareNotes = true;
    openMenu();
    const copy = await screen.findByRole("menuitem", { name: /Copy notes/ });
    expect(copy.getAttribute("title")).toBeNull();
    expect(copy.getAttribute("aria-disabled")).toBeNull();
  });
});
