import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tab: {} as Record<string, unknown>,
  scrolled: [] as HTMLElement[],
}));

vi.mock("./utils", () => ({
  AUTO_TEMPLATE_ID: "__auto__",
  useTemplateTab: () => mocks.tab,
}));

vi.mock("./queries", () => ({
  getTemplateCopyTitle: (title: string) => `${title} (Copy)`,
}));

vi.mock("./delete-template-dialog", () => ({
  DeleteTemplateDialog: () => null,
}));

vi.mock("./template-icon", () => ({
  TemplateIconGlyph: () => null,
}));

vi.mock("~/resource-sharing", () => ({
  parseSharedTemplatePayload: vi.fn(),
  SharedResourceLibrarySection: () => null,
}));

vi.mock("~/shared/config", () => ({
  useConfigValue: () => "",
}));

vi.mock("~/shared/hooks/useNativeContextMenu", () => ({
  useNativeContextMenu: () => vi.fn(),
}));

import type { UserTemplate } from "./queries";
import { TemplatesSidebarContent } from "./template-sidebar";

const tab = { type: "templates", state: {} } as never;

function userTemplate(id: string, title: string) {
  return {
    id,
    title,
    description: "",
    pinned: false,
    icon: { type: "icon", value: "notebook-tabs" },
    sections: [],
  } as unknown as UserTemplate;
}

// The built-in gallery: "General meeting" is the first entry, so it is the
// open row when the Templates screen opens (resolveTemplateTabSelection).
const webTemplates = [
  { slug: "general-meeting", title: "General meeting", sections: [] },
  { slug: "brainstorm", title: "Brainstorm", sections: [] },
];

function setTab(userTemplates: UserTemplate[]) {
  mocks.tab = {
    userTemplates,
    webTemplates,
    isWebLoading: false,
    isWebMode: true,
    selectedMineId: null,
    selectedWebIndex: 0,
    setSelectedMineId: vi.fn(),
    setSelectedWebIndex: vi.fn(),
    createTemplate: vi.fn(),
    createDefaultTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    toggleTemplateFavorite: vi.fn(),
  };
}

describe("TemplatesSidebarContent", () => {
  beforeEach(() => {
    mocks.scrolled = [];
    HTMLElement.prototype.scrollIntoView = function (this: HTMLElement) {
      mocks.scrolled.push(this);
    };
  });
  afterEach(cleanup);

  // Fork: Oct 4 template screen review. The saved templates arrive from the
  // database after the first render and sit above the built-in ones, so the
  // open built-in row moved below the fold and nothing was marked.
  it("scrolls the open row into view when saved templates load above it", () => {
    setTab([]);
    const { rerender } = render(<TemplatesSidebarContent tab={tab} />);
    expect(mocks.scrolled).toHaveLength(1);

    setTab([
      userTemplate("a", "Board meeting"),
      userTemplate("b", "Daily standup"),
      userTemplate("c", "Executive briefing"),
    ]);
    rerender(<TemplatesSidebarContent tab={tab} />);

    expect(mocks.scrolled).toHaveLength(2);
    const open = mocks.scrolled[1];
    expect(open.getAttribute("data-template-selected")).toBe("true");
    expect(open.textContent).toContain("General meeting");
  });

  it("does not scroll again when the list changes below the open row", () => {
    setTab([userTemplate("a", "Board meeting")]);
    const { rerender } = render(<TemplatesSidebarContent tab={tab} />);
    expect(mocks.scrolled).toHaveLength(1);

    mocks.tab = { ...mocks.tab, toggleTemplateFavorite: vi.fn() };
    rerender(<TemplatesSidebarContent tab={tab} />);

    expect(mocks.scrolled).toHaveLength(1);
  });

  // Fork: the open template takes the Settings sidebar's gray selection fill
  // (bg-sidebar-accent), not the hover step (design-system "Contrast").
  it("marks only the open row with the Settings sidebar selection fill", () => {
    setTab([userTemplate("a", "Board meeting")]);
    render(<TemplatesSidebarContent tab={tab} />);

    const row = (name: string) =>
      screen.getByText(name).closest("button") as HTMLButtonElement;

    expect(row("General meeting").className).toContain("bg-sidebar-accent");
    expect(row("General meeting").className).not.toMatch(/(^|\s)bg-accent/);
    expect(row("Board meeting").className).not.toContain("bg-sidebar-accent");
    expect(row("Brainstorm").className).not.toContain("bg-sidebar-accent");
    expect(row("Auto").className).not.toContain("bg-sidebar-accent");
  });

  // Backlog item 3: the two groups carry labels.
  it("labels your templates and the built-in ones", () => {
    setTab([userTemplate("a", "Board meeting")]);
    render(<TemplatesSidebarContent tab={tab} />);

    const yours = screen.getByText("Your templates");
    const builtIn = screen.getByText("Built-in");
    const board = screen.getByRole("button", { name: /Board meeting/ });
    const brainstorm = screen.getByRole("button", { name: /Brainstorm/ });
    const follows = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

    expect(follows(yours, board)).toBe(true);
    expect(follows(board, builtIn)).toBe(true);
    expect(follows(builtIn, brainstorm)).toBe(true);
  });

  // Built-in templates follow the saved ones (the upstream list order), so
  // "General meeting" sits after "Board meeting", not in one A to Z list.
  it("lists built-in templates after the saved ones", () => {
    setTab([
      userTemplate("a", "Board meeting"),
      userTemplate("b", "Incident postmortem"),
    ]);
    render(<TemplatesSidebarContent tab={tab} />);

    const titles = screen
      .getAllByRole("button")
      .map((button) => button.textContent)
      .filter((text) =>
        [
          "Auto",
          "Board meeting",
          "Incident postmortem",
          "Brainstorm",
          "General meeting",
        ].includes(text ?? ""),
      );

    expect(titles).toEqual([
      "Auto",
      "Board meeting",
      "Incident postmortem",
      "Brainstorm",
      "General meeting",
    ]);
  });
});
