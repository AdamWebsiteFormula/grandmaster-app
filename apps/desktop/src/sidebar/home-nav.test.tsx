import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentTab: { type: "empty" } as { type: string } | null,
  tabs: [] as { type: string }[],
  folders: [] as string[],
  openNew: vi.fn(),
  openCurrent: vi.fn(),
  select: vi.fn(),
  openDialog: vi.fn(),
  setSelectedPath: vi.fn(),
  requestFolderAction: vi.fn(),
  menuItems: [] as { text?: string; action?: () => void }[],
  selectedPath: null as string | null,
  platform: "macos",
}));

vi.mock("~/shared/hooks/useNativeContextMenu", () => ({
  useNativeContextMenu:
    (items: { text?: string; action?: () => void }[]) => () => {
      mocks.menuItems = items;
    },
}));

vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => mocks.platform }));

vi.mock("~/store/zustand/tabs", () => {
  const state = () => ({
    currentTab: mocks.currentTab,
    tabs: mocks.tabs,
    openNew: mocks.openNew,
    openCurrent: mocks.openCurrent,
    select: mocks.select,
  });
  const useTabs = (selector: (s: ReturnType<typeof state>) => unknown) =>
    selector(state());
  useTabs.getState = state;
  return { useTabs };
});

vi.mock("~/shared/open-note-dialog", () => ({
  useOpenNoteDialog: () => ({ open: mocks.openDialog }),
}));

vi.mock("~/session/queries", () => ({
  useFolderPaths: () => mocks.folders,
  useFolderIcons: () => ({}),
}));

vi.mock("~/session/folder-icon", () => ({
  resolvedFolderIcon: () => ({ type: "icon", value: "folder" }),
}));

vi.mock("~/templates/template-icon", () => ({
  TemplateIconGlyph: () => <span />,
}));

vi.mock("~/folders/selection", () => ({
  useFolderSelection: (
    selector: (state: {
      iconOverrides: Record<string, unknown>;
      selectedPath: string | null;
      setSelectedPath: (path: string | null) => void;
      requestFolderAction: (path: string, action: string) => void;
    }) => unknown,
  ) =>
    selector({
      iconOverrides: {},
      selectedPath: mocks.selectedPath,
      setSelectedPath: mocks.setSelectedPath,
      requestFolderAction: mocks.requestFolderAction,
    }),
}));

import { SidebarHomeNav } from "./home-nav";

describe("SidebarHomeNav", () => {
  beforeEach(() => {
    mocks.currentTab = { type: "empty" };
    mocks.tabs = [];
    mocks.folders = [];
    mocks.selectedPath = null;
    mocks.platform = "macos";
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  // Fork: journey-after P2 "Folders": the open folder is the selected row.
  it("marks the open folder row as current", () => {
    mocks.currentTab = { type: "folders" };
    mocks.folders = ["Work", "Clients"];
    mocks.selectedPath = "Clients";
    render(<SidebarHomeNav />);

    const clients = screen.getByRole("button", { name: "Clients" });
    expect(clients.getAttribute("aria-current")).toBe("page");
    expect(clients.className).toContain("bg-sidebar-accent");
    expect(clients.className).toContain("font-medium");
    expect(
      screen.getByRole("button", { name: "Work" }).getAttribute("aria-current"),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Home" }).getAttribute("aria-current"),
    ).toBeNull();
  });

  // Owner test, Oct 4: a + beside Folders creates one, as Granola's + beside
  // a space in its sidebar does (Granola Help Center, "Spaces & Folders").
  it("creates a folder from the + beside Folders", async () => {
    render(<SidebarHomeNav />);

    fireEvent.click(screen.getByRole("button", { name: "New folder" }));

    expect(
      await screen.findByRole("dialog", { name: "New folder" }),
    ).toBeTruthy();
  });

  // Owner test, Oct 4: Folders is a heading with a +, as in Granola's
  // sidebar, not a link that jumps into the first folder.
  it("shows Folders as a heading with a + to create one", () => {
    mocks.folders = ["Work"];
    render(<SidebarHomeNav />);

    expect(screen.getByRole("heading", { name: "Folders" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Folders" })).toBeNull();
    expect(screen.getByRole("button", { name: "New folder" })).toBeTruthy();
  });

  it("marks no folder row away from the Folders page", () => {
    mocks.folders = ["Work"];
    mocks.selectedPath = "Work";
    render(<SidebarHomeNav />);

    expect(
      screen.getByRole("button", { name: "Work" }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("lists Home, Search and Folders with Home active on the home tab", () => {
    render(<SidebarHomeNav />);

    const home = screen.getByRole("button", { name: "Home" });
    expect(home.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: /Search/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Folders" })).toBeTruthy();
  });

  it("keeps the Search shortcut in a tooltip, not a chip on the row", () => {
    render(<SidebarHomeNav />);

    const search = screen.getByRole("button", { name: "Search" });
    expect(search.textContent).toBe("Search");
    expect(search.getAttribute("aria-keyshortcuts")).toBe("Meta+K");
    expect(screen.queryByText("⌘ K")).toBeNull();
  });

  // Microsoft Writing Style Guide, Keys and keyboard shortcuts: Ctrl+K.
  it.each(["windows", "linux"])("announces Control+K on %s", (os) => {
    mocks.platform = os;
    render(<SidebarHomeNav />);

    expect(
      screen
        .getByRole("button", { name: "Search" })
        .getAttribute("aria-keyshortcuts"),
    ).toBe("Control+K");
  });

  it("goes back to the existing home tab, or opens one", () => {
    mocks.currentTab = { type: "sessions" };
    const homeTab = { type: "empty" };
    mocks.tabs = [{ type: "sessions" }, homeTab];
    render(<SidebarHomeNav />);

    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(mocks.select).toHaveBeenCalledWith(homeTab);

    mocks.tabs = [{ type: "sessions" }];
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(mocks.openCurrent).toHaveBeenCalledWith({ type: "empty" });
  });

  it("lists Chat between Search and Folders and opens one Chat page", () => {
    render(<SidebarHomeNav />);

    const names = screen
      .getAllByRole("button")
      .map((button) => button.textContent ?? "");
    expect(names.findIndex((name) => name.startsWith("Search"))).toBe(1);
    expect(names[2]).toBe("Chat");
    expect(screen.getByRole("heading", { name: "Folders" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Chat" }));
    expect(mocks.openCurrent).toHaveBeenCalledWith({ type: "chat" });

    const chatTab = { type: "chat" };
    mocks.tabs = [chatTab];
    mocks.currentTab = chatTab;
    cleanup();
    render(<SidebarHomeNav />);
    const chat = screen.getByRole("button", { name: "Chat" });
    expect(chat.getAttribute("aria-current")).toBe("page");
    fireEvent.click(chat);
    expect(mocks.select).toHaveBeenCalledWith(chatTab);
  });

  it("opens the ⌘K note search", () => {
    render(<SidebarHomeNav />);

    fireEvent.click(screen.getByRole("button", { name: /Search/ }));
    expect(mocks.openDialog).toHaveBeenCalled();
  });

  // Owner test, Oct 4: "How do I delete folders?"
  it("renames or deletes a folder from its right-click menu", () => {
    mocks.folders = ["Clients"];
    render(<SidebarHomeNav />);

    fireEvent.contextMenu(screen.getByRole("button", { name: /Clients/ }));
    expect(mocks.menuItems.map((item) => item.text)).toEqual([
      "Rename…",
      "Delete…",
    ]);

    mocks.menuItems[1]!.action!();
    expect(mocks.setSelectedPath).toHaveBeenCalledWith("Clients");
    expect(mocks.openNew).toHaveBeenCalledWith({ type: "folders" });
    expect(mocks.requestFolderAction).toHaveBeenCalledWith("Clients", "delete");
  });

  it("opens a folder's notes", () => {
    mocks.folders = ["Clients", "Team"];
    render(<SidebarHomeNav />);

    fireEvent.click(screen.getByRole("button", { name: "Team" }));
    expect(mocks.setSelectedPath).toHaveBeenCalledWith("Team");
    expect(mocks.openNew).toHaveBeenCalledWith({ type: "folders" });
  });
});
