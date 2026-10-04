import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  createNamedFolder: vi.fn(),
  deleteLocalFolderMaterial: vi.fn(),
  deleteNamedFolder: vi.fn(),
  folders: [] as string[],
  icons: {} as Record<string, { type: "icon"; value: string; color: string }>,
  instructions: "",
  auth: null as { session: { user: { id: string } } } | null,
  materials: [] as Array<{
    id: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
    relativePath: string;
  }>,
  renameNamedFolder: vi.fn(),
  updateFolderIcon: vi.fn(),
  updateFolderInstructions: vi.fn(),
  updateFolderWorkspace: vi.fn(),
  upload: vi.fn(),
  workspaceId: "",
  personalWorkspaceId: "",
  workspaces: [] as Array<{ id: string; name: string }>,
  folderNotes: {
    isLoading: false,
    hasNotes: false,
    groups: [] as unknown[],
    hasMore: false,
  },
  folderNoteCalls: [] as Array<[string, number]>,
  noteCount: 0 as number | null,
  openCurrent: vi.fn(),
}));

vi.mock("~/contexts/shell", () => ({
  useShell: () => ({
    chat: {
      mode: "FloatingClosed",
      startNewChat: vi.fn(),
      sendEvent: vi.fn(),
    },
  }),
}));

vi.mock("./folder-stats", () => ({
  useFolderNoteCount: () => mocks.noteCount,
}));

vi.mock("~/home/home-data", () => ({
  RECENT_PAGE_SIZE: 20,
  useFolderNotes: (folderPath: string, limit: number) => {
    mocks.folderNoteCalls.push([folderPath, limit]);
    return mocks.folderNotes;
  },
}));

vi.mock("~/sidebar/timeline/item", () => ({
  useSessionContextMenu: () => [],
}));

vi.mock("~/shared/ui/interactive-button", () => ({
  InteractiveButton: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("~/shared/hooks/useTimeFormat", () => ({
  useTimeFormat: () => "h:mm a",
}));

vi.mock("~/store/zustand/tabs", () => ({
  useTabs: (selector: (state: { openCurrent: () => void }) => unknown) =>
    selector({ openCurrent: mocks.openCurrent }),
}));

vi.mock("~/auth", () => ({
  useOptionalAuth: () => mocks.auth,
}));

vi.mock("~/auth/billing-context", () => ({
  useBillingAccess: () => ({
    isReady: false,
    isPaid: false,
    upgradeToPro: vi.fn(),
  }),
}));

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useLingui: () => ({
    t: (strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce(
        (message, part, index) =>
          `${message}${part}${index < values.length ? String(values[index]) : ""}`,
        "",
      ),
  }),
}));

vi.mock("@anlg/ui/components/ui/toast", () => ({
  toast: { error: mocks.toastError, success: vi.fn(), message: vi.fn() },
}));

vi.mock("~/session/queries", () => ({
  useFolderIcons: () => mocks.icons,
  useFolderPaths: () => mocks.folders,
  useFolderWorkspaces: () => ({}),
}));

vi.mock("~/session/folder-catalog", () => ({
  createNamedFolder: mocks.createNamedFolder,
  deleteNamedFolder: mocks.deleteNamedFolder,
  renameNamedFolder: mocks.renameNamedFolder,
  updateFolderIcon: mocks.updateFolderIcon,
  updateFolderInstructions: mocks.updateFolderInstructions,
  updateFolderWorkspace: mocks.updateFolderWorkspace,
  useFolderWorkspaceId: () => mocks.workspaceId,
  useFolderInstructions: () => mocks.instructions,
}));

vi.mock("~/session-sharing/source", () => ({
  useAvailableShareWorkspaces: () => mocks.workspaces,
  usePersonalWorkspaceId: () => mocks.personalWorkspaceId,
}));

vi.mock("~/session/folder-attachments", () => ({
  deleteLocalFolderMaterial: mocks.deleteLocalFolderMaterial,
  diskAttachmentId: (relativePath: string) => {
    const parts = relativePath.split("/");
    return parts[parts.length - 1] ?? relativePath;
  },
  useFolderMaterials: () => mocks.materials,
}));

vi.mock("~/shared/hooks/useFileUpload", () => ({
  useFolderMaterialUpload: () => mocks.upload,
}));

vi.mock("~/sidebar/custom-sidebar-header", () => ({
  CustomSidebarHeader: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

import { FoldersMain } from "./index";
import { useFolderSelection } from "./selection";
import { FoldersSidebar } from "./sidebar";

function FoldersWorkspace() {
  return (
    <>
      <FoldersSidebar />
      <FoldersMain />
    </>
  );
}

function renderFoldersWorkspace() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <FoldersWorkspace />
    </QueryClientProvider>,
  );
}

describe("Folders workspace", () => {
  beforeEach(() => {
    mocks.createNamedFolder.mockReset();
    mocks.deleteLocalFolderMaterial.mockReset();
    mocks.deleteNamedFolder.mockReset();
    mocks.renameNamedFolder.mockReset();
    mocks.updateFolderIcon.mockReset();
    mocks.updateFolderInstructions.mockReset();
    mocks.updateFolderWorkspace.mockReset();
    mocks.upload.mockReset();
    mocks.folders = [];
    mocks.icons = {};
    mocks.instructions = "";
    mocks.materials = [];
    mocks.auth = null;
    mocks.workspaceId = "";
    mocks.personalWorkspaceId = "";
    mocks.workspaces = [];
    mocks.folderNotes = {
      isLoading: false,
      hasNotes: false,
      groups: [],
      hasMore: false,
    };
    mocks.folderNoteCalls = [];
    mocks.noteCount = 0;
    mocks.openCurrent.mockReset();
    mocks.createNamedFolder.mockResolvedValue("CS 101");
    mocks.deleteNamedFolder.mockResolvedValue(undefined);
    mocks.renameNamedFolder.mockResolvedValue("Algorithms");
    mocks.updateFolderIcon.mockResolvedValue(undefined);
    mocks.updateFolderInstructions.mockResolvedValue(undefined);
    mocks.updateFolderWorkspace.mockResolvedValue(undefined);
    mocks.upload.mockResolvedValue({
      path: "/vault/sessions/CS 101/materials/syllabus.pdf",
      attachmentId: "syllabus.pdf",
    });
    mocks.deleteLocalFolderMaterial.mockResolvedValue(undefined);
    useFolderSelection.setState({
      selectedPath: null,
      deletedPrefixes: [],
      iconOverrides: {},
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("creates the first folder from the empty state", async () => {
    renderFoldersWorkspace();

    // Header icon and the main empty state; the sidebar shows no second
    // empty state (NN/g #8) and no search box until folders exist.
    expect(screen.getAllByRole("button", { name: "New folder" })).toHaveLength(
      2,
    );
    expect(screen.queryByPlaceholderText("Search folders…")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "New folder" })[1]);
    fireEvent.change(screen.getByLabelText("Folder name"), {
      target: { value: "CS 101" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(mocks.createNamedFolder).toHaveBeenCalledWith("CS 101");
    });
  });

  it("edits context and materials for the selected folder", async () => {
    mocks.folders = ["CS 101", "Work"];
    mocks.materials = [
      {
        id: "mat-1",
        filename: "syllabus.pdf",
        contentType: "application/pdf",
        sizeBytes: 12,
        relativePath: "materials/syllabus.pdf",
      },
    ];

    renderFoldersWorkspace();

    expect(screen.getByRole("textbox", { name: "Folder name" })).toHaveProperty(
      "value",
      "CS 101",
    );
    fireEvent.click(screen.getByRole("button", { name: "Work" }));
    expect(screen.getByRole("textbox", { name: "Folder name" })).toHaveProperty(
      "value",
      "Work",
    );

    fireEvent.change(screen.getByLabelText("Folder context"), {
      target: { value: "Prefer the syllabus." },
    });
    fireEvent.blur(screen.getByLabelText("Folder context"));

    await waitFor(() => {
      expect(mocks.updateFolderInstructions).toHaveBeenCalledWith(
        "Work",
        "Prefer the syllabus.",
      );
    });

    expect(screen.getByText("syllabus.pdf")).toBeTruthy();
    const file = new File(["week 1"], "notes.txt", { type: "text/plain" });
    fireEvent.click(screen.getByRole("button", { name: "Add file" }));
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(mocks.upload).toHaveBeenCalledWith(file);
    });
  });

  it("renames the folder from the title field", async () => {
    mocks.folders = ["Work"];

    renderFoldersWorkspace();

    const title = screen.getByRole("textbox", { name: "Folder name" });
    fireEvent.change(title, { target: { value: "Algorithms" } });
    fireEvent.blur(title);

    await waitFor(() => {
      expect(mocks.renameNamedFolder).toHaveBeenCalledWith(
        "Work",
        "Algorithms",
      );
    });
  });

  it("keeps an explicitly selected folder active while queries catch up", () => {
    mocks.folders = ["Work"];
    useFolderSelection.setState({ selectedPath: "New Folder" });

    renderFoldersWorkspace();

    expect(screen.getByRole("textbox", { name: "Folder name" })).toHaveProperty(
      "value",
      "New Folder",
    );
  });

  it("keeps a nested folder under its parent when renaming it", async () => {
    mocks.folders = ["Courses/Algorithms"];
    mocks.renameNamedFolder.mockResolvedValue("Courses/Data Structures");

    renderFoldersWorkspace();

    const title = screen.getByRole("textbox", { name: "Folder name" });
    fireEvent.change(title, { target: { value: "Data Structures" } });
    fireEvent.blur(title);

    await waitFor(() => {
      expect(mocks.renameNamedFolder).toHaveBeenCalledWith(
        "Courses/Algorithms",
        "Courses/Data Structures",
      );
    });
  });

  it("deletes the folder from the actions menu", async () => {
    mocks.folders = ["Work", "Personal"];

    renderFoldersWorkspace();

    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Folder actions" }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(screen.getByText("Delete “Work”?")).toBeTruthy();
    expect(
      screen.getByText(
        "Notes stay on Home. This folder, its nested folders and their materials will be deleted.",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete folder" }));

    await waitFor(() => {
      expect(mocks.deleteNamedFolder).toHaveBeenCalledWith("Work");
      expect(
        screen.getByRole("textbox", { name: "Folder name" }),
      ).toHaveProperty("value", "Personal");
    });
  });

  // Fork: journey-after P2 "Folders › Delete": a failure is said, not
  // swallowed, and the dialog stays open for a retry.
  it("says when deleting the folder fails", async () => {
    mocks.folders = ["Work", "Personal"];
    mocks.deleteNamedFolder.mockRejectedValueOnce(new Error("disk full"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    renderFoldersWorkspace();

    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Folder actions" }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete folder" }));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Couldn't delete the folder. Try again.",
      );
    });
    expect(screen.getByText("Delete “Work”?")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Delete folder" })
        .hasAttribute("disabled"),
    ).toBe(false);
    consoleError.mockRestore();
  });

  it("saves a folder icon from the header picker", async () => {
    mocks.folders = ["Work"];

    renderFoldersWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Choose folder icon" }));
    fireEvent.click(screen.getByRole("button", { name: "target" }));

    await waitFor(() => {
      expect(mocks.updateFolderIcon).toHaveBeenCalledWith("Work", {
        type: "icon",
        value: "target",
        color: "#9ca3af",
      });
    });
    expect(useFolderSelection.getState().iconOverrides.Work).toEqual({
      type: "icon",
      value: "target",
      color: "#9ca3af",
    });
  });

  it("clears an optimistic folder icon when saving fails", async () => {
    mocks.folders = ["Work"];
    mocks.updateFolderIcon.mockRejectedValue(new Error("unavailable"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    renderFoldersWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Choose folder icon" }));
    fireEvent.click(screen.getByRole("button", { name: "target" }));

    await waitFor(() => {
      expect(mocks.updateFolderIcon).toHaveBeenCalledWith("Work", {
        type: "icon",
        value: "target",
        color: "#9ca3af",
      });
      expect(useFolderSelection.getState().iconOverrides.Work).toBeUndefined();
    });
    consoleError.mockRestore();
  });

  it("lists the folder's notes by day and opens one", () => {
    mocks.folders = ["Work"];
    const nineAm = new Date(2026, 9, 3, 9).getTime();
    mocks.folderNotes = {
      isLoading: false,
      hasNotes: true,
      groups: [
        {
          key: "today",
          kind: "today",
          dayMs: new Date(2026, 9, 3).getTime(),
          notes: [
            {
              id: "note-1",
              title: "Weekly sync",
              timeMs: nineAm,
              attendees: 0,
              people: [],
              locked: false,
              trackingId: null,
            },
          ],
        },
      ],
      hasMore: true,
    };

    renderFoldersWorkspace();

    expect(mocks.folderNoteCalls[mocks.folderNoteCalls.length - 1]).toEqual([
      "Work",
      20,
    ]);
    expect(screen.getByRole("heading", { name: "Notes" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Today" })).toBeTruthy();
    fireEvent.click(screen.getByText("Weekly sync"));
    expect(mocks.openCurrent).toHaveBeenCalledWith({
      type: "sessions",
      id: "note-1",
    });

    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(mocks.folderNoteCalls[mocks.folderNoteCalls.length - 1]).toEqual([
      "Work",
      40,
    ]);
  });

  it("heads the page with the folder description and counts", () => {
    mocks.folders = ["Work"];
    mocks.instructions = "Client calls for Acme\nMore detail";
    mocks.noteCount = 12;
    mocks.materials = [
      {
        id: "a",
        filename: "brief.pdf",
        contentType: "application/pdf",
        sizeBytes: 1,
        relativePath: "Work/materials/brief.pdf",
      },
    ];

    renderFoldersWorkspace();

    expect(screen.getByText("Client calls for Acme")).toBeTruthy();
    expect(screen.getByText("12 notes · 1 file")).toBeTruthy();
    // Fork: journey-after P2 "Folder page": ask about this folder.
    expect(
      screen.getByRole("textbox", { name: "Ask about this folder" }),
    ).toBeTruthy();
  });

  it("hides the folder composer while the folder has no notes", () => {
    mocks.folders = ["Work"];
    mocks.noteCount = 0;

    renderFoldersWorkspace();

    expect(
      screen.queryByRole("textbox", { name: "Ask about this folder" }),
    ).toBeNull();
  });

  it("says when a folder has no notes yet", () => {
    mocks.folders = ["Work"];

    renderFoldersWorkspace();

    expect(screen.getByRole("heading", { name: "Notes" })).toBeTruthy();
    expect(screen.getByText("No notes in this folder yet")).toBeTruthy();
  });

  it("renames the folder from the actions menu", async () => {
    mocks.folders = ["Work"];

    renderFoldersWorkspace();

    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Folder actions" }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));
    const nameFields = screen.getAllByLabelText("Folder name");
    const dialogInput = nameFields[nameFields.length - 1];
    fireEvent.change(dialogInput, { target: { value: "Algorithms" } });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));

    await waitFor(() => {
      expect(mocks.renameNamedFolder).toHaveBeenCalledWith(
        "Work",
        "Algorithms",
      );
    });
  });

  it("asks before removing a material", async () => {
    mocks.folders = ["Work"];
    mocks.materials = [
      {
        id: "mat-1",
        filename: "syllabus.pdf",
        contentType: "application/pdf",
        sizeBytes: 12,
        relativePath: "materials/syllabus.pdf",
      },
    ];

    renderFoldersWorkspace();

    fireEvent.click(
      screen.getByRole("button", { name: "Remove syllabus.pdf" }),
    );
    expect(mocks.deleteLocalFolderMaterial).not.toHaveBeenCalled();
    expect(screen.getByText("Remove “syllabus.pdf”?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove file" }));

    await waitFor(() => {
      expect(mocks.deleteLocalFolderMaterial).toHaveBeenCalledWith({
        folderPath: "Work",
        attachmentId: "syllabus.pdf",
      });
    });
  });
});
