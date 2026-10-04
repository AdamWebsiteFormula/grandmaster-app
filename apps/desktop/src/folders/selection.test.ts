import { beforeEach, describe, expect, it } from "vitest";

import { useFolderSelection } from "./selection";

// Owner test, Oct 4: Rename… and Delete… from the sidebar reach the folder page.
describe("folder actions from the sidebar", () => {
  beforeEach(() => {
    useFolderSelection.setState({ pendingAction: null });
  });

  it("keeps the asked action until the folder page takes it", () => {
    useFolderSelection.getState().requestFolderAction("Clients", "rename");
    expect(useFolderSelection.getState().pendingAction).toEqual({
      path: "Clients",
      action: "rename",
    });

    useFolderSelection.getState().clearFolderAction();
    expect(useFolderSelection.getState().pendingAction).toBeNull();
  });
});
