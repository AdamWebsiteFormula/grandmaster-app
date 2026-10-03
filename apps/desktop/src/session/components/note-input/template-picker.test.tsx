import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TemplatePickerPopover } from "./template-picker";

const mocks = vi.hoisted(() => ({
  createTemplate: vi.fn(() => Promise.resolve("new-template")),
  openTemplatesTab: vi.fn(),
  templates: [
    { id: "t-1on1", title: "1 to 1", icon: null },
    { id: "t-hiring", title: "Hiring", icon: null },
    { id: "t-standup", title: "Stand-up", icon: null },
  ],
}));

vi.mock("@anlg/ui/components/ui/popover", () => ({
  AppFloatingPanel: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => (
    <div data-testid="template-menu" className={className}>
      {children}
    </div>
  ),
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@anlg/ui/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => (
    <span role="tooltip">{children}</span>
  ),
}));

vi.mock("~/shared/ui/resource-list", () => ({
  useWebResources: () => ({ data: [] }),
}));

vi.mock("~/templates", () => ({
  DEFAULT_TEMPLATE_ICON: null,
  filterWebTemplatesAgainstUserTemplates: () => [],
  parseWebTemplates: () => [],
  TemplateIconGlyph: () => <span aria-hidden />,
  useCreateTemplate: () => mocks.createTemplate,
  useOpenTemplatesTab: () => mocks.openTemplatesTab,
  useUserTemplates: () => mocks.templates,
}));

function renderPicker(usedTemplateId: string | null = "t-hiring") {
  const onRegenerateUsed = vi.fn();
  const onSelectTemplate = vi.fn();
  render(
    <TemplatePickerPopover
      onSelectTemplate={onSelectTemplate}
      usedTemplateId={usedTemplateId}
      onRegenerateUsed={onRegenerateUsed}
      trigger={<button type="button">Template</button>}
    />,
  );
  return { onRegenerateUsed, onSelectTemplate };
}

function rowLabels() {
  return Array.from(
    screen.getByTestId("template-menu").querySelectorAll("button"),
  )
    .map((button) => button.getAttribute("aria-label") ?? button.textContent)
    .filter((label) => label !== "Clear search");
}

// granola-compare-oct3 §3: template menu.
describe("TemplatePickerPopover", () => {
  beforeEach(() => {
    mocks.createTemplate.mockClear();
    mocks.openTemplatesTab.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("is 256 px wide, puts the template in use first and checks it", () => {
    renderPicker();

    expect(screen.getByTestId("template-menu").className).toContain("w-64");
    expect(rowLabels()).toEqual([
      "Hiring",
      "Regenerate",
      "Auto",
      "1 to 1",
      "Stand-up",
      "All templates…",
      "New template",
    ]);
    const current = screen.getByRole("button", { name: "Hiring" });
    expect(current.getAttribute("aria-current")).toBe("true");
    expect(screen.getByLabelText("Current template")).not.toBeNull();
  });

  it("checks Auto when the summary used no template", () => {
    renderPicker(null);

    expect(
      screen.getByRole("button", { name: "Auto" }).getAttribute("aria-current"),
    ).toBe("true");
    expect(rowLabels()[0]).toBe("Auto");
  });

  it("regenerates from an icon button with a tooltip", () => {
    const { onRegenerateUsed } = renderPicker();

    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));

    expect(onRegenerateUsed).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("tooltip").textContent).toBe("Regenerate");
  });

  it("creates and opens a new template from the footer row", async () => {
    renderPicker();

    fireEvent.click(screen.getByRole("button", { name: "New template" }));
    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.createTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "New template" }),
    );
    expect(mocks.openTemplatesTab).toHaveBeenCalledWith(
      expect.objectContaining({ selectedMineId: "new-template" }),
    );
  });

  it("opens all templates from the footer row", () => {
    renderPicker();

    fireEvent.click(screen.getByRole("button", { name: "All templates…" }));

    expect(mocks.openTemplatesTab).toHaveBeenCalledWith(
      expect.objectContaining({ isWebMode: true }),
    );
  });
});
