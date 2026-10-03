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
}));

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
      setSelectedPath: (path: string | null) => void;
    }) => unknown,
  ) => selector({ iconOverrides: {}, setSelectedPath: mocks.setSelectedPath }),
}));

import { SidebarHomeNav } from "./home-nav";

describe("SidebarHomeNav", () => {
  beforeEach(() => {
    mocks.currentTab = { type: "empty" };
    mocks.tabs = [];
    mocks.folders = [];
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it("lists Home, Search and Folders with Home active on the home tab", () => {
    render(<SidebarHomeNav />);

    const home = screen.getByRole("button", { name: "Home" });
    expect(home.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: /Search/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Folders" })).toBeTruthy();
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

  it("opens the ⌘K note search", () => {
    render(<SidebarHomeNav />);

    fireEvent.click(screen.getByRole("button", { name: /Search/ }));
    expect(mocks.openDialog).toHaveBeenCalled();
  });

  it("opens a folder's notes", () => {
    mocks.folders = ["Clients", "Team"];
    render(<SidebarHomeNav />);

    fireEvent.click(screen.getByRole("button", { name: "Team" }));
    expect(mocks.setSelectedPath).toHaveBeenCalledWith("Team");
    expect(mocks.openNew).toHaveBeenCalledWith({ type: "folders" });

    fireEvent.click(screen.getByRole("button", { name: "Folders" }));
    expect(mocks.openNew).toHaveBeenCalledTimes(2);
    expect(mocks.setSelectedPath).toHaveBeenCalledTimes(1);
  });
});
