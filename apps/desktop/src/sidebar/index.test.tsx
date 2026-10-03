import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentTab: { type: "empty" } as { type: string } | null,
  platform: "macos",
  openNew: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-os", () => ({
  platform: () => mocks.platform,
}));

vi.mock("~/store/zustand/tabs", () => ({
  useTabs: (
    selector: (state: {
      currentTab: typeof mocks.currentTab;
      openNew: typeof mocks.openNew;
    }) => unknown,
  ) => selector({ currentTab: mocks.currentTab, openNew: mocks.openNew }),
}));

vi.mock("~/sidebar/folder-materials", () => ({
  FolderMaterialsPanel: ({ folderPath }: { folderPath: string }) => (
    <div data-testid="folder-materials" data-folder-path={folderPath} />
  ),
}));

vi.mock("~/sidebar/timeline", () => ({
  TimelineView: ({ folderFilter = null }: { folderFilter?: string | null }) => (
    <div data-testid="timeline-view" data-folder-filter={folderFilter ?? ""} />
  ),
}));

vi.mock("~/sidebar/calendar", () => ({
  CalendarNav: () => <div data-testid="calendar-nav" />,
}));

vi.mock("~/sidebar/automations", () => ({
  AutomationsNav: () => <div data-testid="automations-nav" />,
}));

vi.mock("~/sidebar/contacts", () => ({
  ContactsNav: () => <div data-testid="contacts-nav" />,
}));

vi.mock("~/sidebar/settings", () => ({
  SettingsNav: () => <div data-testid="settings-nav" />,
}));

vi.mock("~/sidebar/templates", () => ({
  TemplatesNav: () => <div data-testid="templates-nav" />,
}));

vi.mock("~/sidebar/folders", () => ({
  FoldersNav: () => <div data-testid="folders-nav" />,
}));

vi.mock("~/sidebar/home-nav", () => ({
  SidebarHomeNav: () => <nav data-testid="home-nav" />,
}));

vi.mock("~/sidebar/shared-notes", () => ({
  SharedNotesNav: () => <div data-testid="shared-notes-nav" />,
}));

import { LeftSidebar } from "./index";

describe("LeftSidebar", () => {
  beforeEach(() => {
    mocks.currentTab = { type: "empty" };
    mocks.platform = "macos";
  });

  afterEach(() => {
    cleanup();
  });

  it("opens Settings from the button at the bottom of the sidebar", () => {
    render(<LeftSidebar />);

    const settings = screen.getByRole("button", { name: "Settings" });
    expect(settings.getAttribute("aria-keyshortcuts")).toBe("Meta+,");
    expect(screen.queryByText("⌘ ,")).toBeNull();
    fireEvent.click(settings);

    expect(mocks.openNew).toHaveBeenCalledWith({
      type: "settings",
      state: { tab: "app" },
    });
  });

  // Fork (Granola 101): the sidebar is navigation; notes live on Home.
  it.each([
    ["all notes", {}],
    ["received notes", { noteFilter: "shared" as const }],
    ["a folder filter", { folderFilter: "CS 101" }],
  ])("shows the nav instead of the timeline for %s", (_name, props) => {
    render(<LeftSidebar {...props} />);

    expect(screen.getByTestId("home-nav")).toBeTruthy();
    expect(screen.queryByTestId("timeline-view")).toBeNull();
    expect(screen.queryByTestId("shared-notes-nav")).toBeNull();
    expect(screen.queryByTestId("folder-materials")).toBeNull();
  });

  it.each([
    ["settings", "settings-nav"],
    ["calendar", "calendar-nav"],
    ["contacts", "contacts-nav"],
    ["templates", "templates-nav"],
    ["automations", "automations-nav"],
    ["folders", "folders-nav"],
  ])("shows the %s nav instead of the timeline", (type, testId) => {
    mocks.currentTab = { type };

    render(<LeftSidebar />);

    expect(screen.getByTestId(testId)).toBeTruthy();
    expect(screen.queryByTestId("timeline-view")).toBeNull();
    expect(screen.queryByTestId("home-nav")).toBeNull();
  });
});
