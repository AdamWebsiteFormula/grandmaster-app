import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  confirmDelete: vi.fn(() => Promise.resolve(true)),
  deleteHuman: vi.fn(() => Promise.resolve()),
  deleteOrganization: vi.fn(() => Promise.resolve()),
  toastError: vi.fn(),
}));

vi.mock("~/shared/confirm-delete", () => ({
  confirmDelete: mocks.confirmDelete,
}));

vi.mock("./queries", () => ({
  deleteHuman: mocks.deleteHuman,
  deleteOrganization: mocks.deleteOrganization,
}));

vi.mock("@anlg/ui/components/ui/toast", () => ({
  toast: { error: mocks.toastError },
}));

import { confirmContactDelete, deleteContactOrSay } from "./contact-actions";

describe("contact delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("asks first, with Cancel to back out", async () => {
    await confirmContactDelete("person");

    expect(mocks.confirmDelete).toHaveBeenCalledWith("Delete this contact?");
  });

  it("says so when a delete fails", async () => {
    mocks.deleteOrganization.mockRejectedValueOnce(new Error("locked"));

    await deleteContactOrSay("organization", "org-1");

    expect(mocks.deleteOrganization).toHaveBeenCalledWith("org-1");
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Couldn't delete this organization. Try again.",
    );
  });

  it("stays quiet when a delete works", async () => {
    await deleteContactOrSay("person", "human-1");

    expect(mocks.deleteHuman).toHaveBeenCalledWith("human-1");
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
