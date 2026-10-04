import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FolderPicker,
  MoveToFolderDialog,
  openMoveToFolderDialog,
  useMoveToFolderDialog,
} from "./folder-picker";

const mocks = vi.hoisted(() => ({
  createNamedFolder: vi.fn(() => Promise.resolve("clients")),
  folderId: "",
  folderPaths: [] as string[],
  icons: {} as Record<string, { type: "icon"; value: string; color: string }>,
  openNew: vi.fn(),
  setSelectedPath: vi.fn(),
  updateSession: vi.fn(() => Promise.resolve()),
  toastError: vi.fn(),
}));

vi.mock("@anlg/ui/components/ui/toast", () => ({
  toast: { error: mocks.toastError },
}));

vi.mock("~/folders/selection", () => ({
  useFolderSelection: (
    selector: (state: {
      setSelectedPath: typeof mocks.setSelectedPath;
    }) => unknown,
  ) => selector({ setSelectedPath: mocks.setSelectedPath }),
}));

vi.mock("~/store/zustand/tabs", () => ({
  useTabs: (selector: (state: { openNew: typeof mocks.openNew }) => unknown) =>
    selector({ openNew: mocks.openNew }),
}));

vi.mock("~/session/folder-catalog", () => ({
  createNamedFolder: mocks.createNamedFolder,
}));

vi.mock("~/session/queries", () => ({
  useFolderIcons: () => mocks.icons,
  useFolderPaths: () => mocks.folderPaths,
  useSession: () => ({ folder_id: mocks.folderId }),
  useUpdateSession: () => mocks.updateSession,
}));

describe("FolderPicker", () => {
  beforeEach(() => {
    mocks.folderId = "";
    mocks.folderPaths = ["personal", "work"];
    mocks.icons = {};
    mocks.createNamedFolder.mockClear();
    mocks.openNew.mockClear();
    mocks.setSelectedPath.mockClear();
    mocks.updateSession.mockClear();
    mocks.updateSession.mockImplementation(() => Promise.resolve());
    mocks.toastError.mockClear();
    useMoveToFolderDialog.setState({ sessionId: null });
    mocks.createNamedFolder.mockResolvedValue("clients");
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as typeof ResizeObserver;
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the selected folder name", () => {
    mocks.folderId = "work";

    render(<FolderPicker sessionId="session-1" />);

    const trigger = screen.getByRole("combobox", { name: "Folder: work" });

    expect(trigger.textContent).toBe("work");
  });

  it("lets the user select an existing folder for the current note", async () => {
    render(<FolderPicker sessionId="session-1" />);

    fireEvent.click(screen.getByRole("combobox", { name: "Select folder" }));
    fireEvent.click(screen.getByRole("option", { name: "work" }));

    expect(mocks.updateSession).toHaveBeenCalledWith({
      folder_id: "work",
    });
  });

  it("creates a folder from the search query and assigns the note", async () => {
    render(<FolderPicker sessionId="session-1" />);

    fireEvent.click(screen.getByRole("combobox", { name: "Select folder" }));
    fireEvent.change(screen.getByPlaceholderText("Search or create folder"), {
      target: { value: "clients" },
    });
    fireEvent.click(
      await screen.findByRole("option", { name: "Create \u201cclients\u201d" }),
    );

    expect(mocks.createNamedFolder).toHaveBeenCalledWith("clients");
    await waitFor(() => {
      expect(mocks.setSelectedPath).toHaveBeenCalledWith("clients");
      expect(mocks.updateSession).toHaveBeenCalledWith({
        folder_id: "clients",
      });
    });
  });

  it("creates nested folder names", async () => {
    render(<FolderPicker sessionId="session-1" />);

    fireEvent.click(screen.getByRole("combobox", { name: "Select folder" }));
    fireEvent.change(screen.getByPlaceholderText("Search or create folder"), {
      target: { value: "clients/acme" },
    });
    fireEvent.click(
      await screen.findByRole("option", {
        name: "Create \u201cclients/acme\u201d",
      }),
    );

    expect(mocks.createNamedFolder).toHaveBeenCalledWith("clients/acme");
    await waitFor(() => {
      expect(mocks.updateSession).toHaveBeenCalledWith({
        folder_id: "clients/acme",
      });
    });
  });

  it("highlights the current folder and does not offer no folder", () => {
    mocks.folderId = "work";

    render(<FolderPicker sessionId="session-1" />);

    fireEvent.click(screen.getByRole("combobox", { name: "Folder: work" }));

    expect(
      screen
        .getByRole("option", { name: "work" })
        .getAttribute("data-selected"),
    ).toBe("true");
    expect(screen.queryByRole("option", { name: "No folder" })).toBeNull();
  });

  it("can remove the current note from its folder", () => {
    mocks.folderId = "work";

    render(<FolderPicker sessionId="session-1" />);

    fireEvent.click(screen.getByRole("combobox", { name: "Folder: work" }));
    fireEvent.click(screen.getByRole("option", { name: "work" }));

    expect(mocks.updateSession).toHaveBeenCalledWith({ folder_id: "" });
  });

  it("keeps a nested stored path selected and can move the note to the parent", () => {
    mocks.folderId = "work/meetings";
    mocks.folderPaths = ["work", "work/meetings"];

    render(<FolderPicker sessionId="session-1" />);

    fireEvent.click(
      screen.getByRole("combobox", { name: "Folder: work/meetings" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "work" }));

    expect(mocks.updateSession).toHaveBeenCalledWith({ folder_id: "work" });
  });

  // Fork: journey-after P3 "Folder picker": a visible Remove item.
  it("offers Remove from folder only when the note is in one", () => {
    mocks.folderId = "work";
    render(<FolderPicker sessionId="session-1" />);
    fireEvent.click(screen.getByRole("combobox", { name: "Folder: work" }));
    fireEvent.click(screen.getByRole("option", { name: "Remove from folder" }));
    expect(mocks.updateSession).toHaveBeenCalledWith({ folder_id: "" });
  });

  it("has no Remove item for a note outside folders", () => {
    render(<FolderPicker sessionId="session-1" />);
    fireEvent.click(screen.getByRole("combobox", { name: "Select folder" }));
    expect(
      screen.queryByRole("option", { name: "Remove from folder" }),
    ).toBeNull();
  });

  // Fork: journey-after P3 "Add note to folder, error".
  it("says when moving the note fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mocks.updateSession.mockImplementation(() =>
      Promise.reject(new Error("db locked")),
    );
    render(<FolderPicker sessionId="session-1" />);
    fireEvent.click(screen.getByRole("combobox", { name: "Select folder" }));
    fireEvent.click(screen.getByRole("option", { name: "work" }));
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Couldn't move the note. Try again.",
      ),
    );
    consoleError.mockRestore();
  });

  // Fork: journey-after P2 "Add note to folder from Home".
  it("opens as a dialog from a note's menu and closes after a pick", async () => {
    render(<MoveToFolderDialog />);
    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => openMoveToFolderDialog("session-1"));
    expect(
      await screen.findByRole("dialog", { name: "Add to folder" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("option", { name: "work" }));

    expect(mocks.updateSession).toHaveBeenCalledWith({ folder_id: "work" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("closes the dialog from Cancel without moving", async () => {
    render(<MoveToFolderDialog />);
    act(() => openMoveToFolderDialog("session-1"));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.updateSession).not.toHaveBeenCalled();
  });

  it("opens the folders workspace from see all folders", () => {
    mocks.folderId = "work";

    render(<FolderPicker sessionId="session-1" />);

    fireEvent.click(screen.getByRole("combobox", { name: "Folder: work" }));
    fireEvent.click(screen.getByRole("button", { name: "See all folders" }));

    expect(mocks.setSelectedPath).toHaveBeenCalledWith("work");
    expect(mocks.openNew).toHaveBeenCalledWith({ type: "folders" });
  });
});
