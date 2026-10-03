import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  defaultTemplateId: "",
  setSettingValue: vi.fn(() => Promise.resolve()),
}));

vi.mock("./queries", () => ({
  useSaveTemplate: () => vi.fn(async () => {}),
  useToggleTemplateFavorite: () => vi.fn(),
}));

vi.mock("./sections-editor", () => ({
  SectionsList: () => null,
}));

vi.mock("./template-icon-picker", () => ({
  TemplateIconPicker: () => null,
}));

vi.mock("~/resource-sharing", () => ({
  ResourceShareButton: () => null,
  sharedTemplatePayload: vi.fn(),
}));

vi.mock("~/settings/queries", () => ({
  useSetSettingValue: () => vi.fn(),
  setSettingValue: mocks.setSettingValue,
}));

vi.mock("~/shared/config", () => ({
  useConfigValue: () => mocks.defaultTemplateId,
}));

import type { UserTemplate } from "./queries";
import { TemplateForm } from "./template-form";

const template = {
  id: "template-1",
  title: "Standup",
  description: "",
  targets: ["Engineering"],
  sections: [],
  pinned: false,
} as unknown as UserTemplate;

describe("TemplateForm", () => {
  afterEach(() => {
    cleanup();
    mocks.defaultTemplateId = "";
    mocks.setSettingValue.mockClear();
  });

  // Fork: journey-after P3 "Templates": sentence case words and a neutral,
  // filled favorite heart (red is for errors).
  it("labels default and favorite in sentence case without red", () => {
    render(
      <TemplateForm
        template={{ ...template, pinned: true } as UserTemplate}
        handleDeleteTemplate={vi.fn()}
        handleDuplicateTemplate={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Set as default" })).toBeTruthy();
    const heart = screen.getByRole("button", { name: "Unfavorite template" });
    expect(heart.className).toContain("text-foreground");
    expect(heart.className).not.toContain("text-destructive");
    expect(heart.getAttribute("aria-pressed")).toBe("true");
  });

  it("says when the template is the current default", () => {
    mocks.defaultTemplateId = "template-1";
    render(
      <TemplateForm
        template={template}
        handleDeleteTemplate={vi.fn()}
        handleDuplicateTemplate={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Current default" }),
    ).toBeTruthy();
  });

  // Fork: journey-after P3 "Templates › Delete".
  it("warns and falls back to Auto when deleting the default", async () => {
    mocks.defaultTemplateId = "template-1";
    const handleDeleteTemplate = vi.fn();
    render(
      <TemplateForm
        template={template}
        handleDeleteTemplate={handleDeleteTemplate}
        handleDuplicateTemplate={vi.fn()}
      />,
    );

    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Template actions" }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(
      screen.getByText(
        "This is your default template. New notes will use Auto.",
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete template" }));
    expect(mocks.setSettingValue).toHaveBeenCalledWith(
      "selected_template_id",
      "",
    );
    expect(handleDeleteTemplate).toHaveBeenCalledWith("template-1");
  });

  it("asks before deleting a template", async () => {
    const handleDeleteTemplate = vi.fn();
    render(
      <TemplateForm
        template={template}
        handleDeleteTemplate={handleDeleteTemplate}
        handleDuplicateTemplate={vi.fn()}
      />,
    );

    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Template actions" }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));

    expect(handleDeleteTemplate).not.toHaveBeenCalled();
    expect(screen.getByText("Delete “Standup”?")).toBeTruthy();
    expect(screen.getByText("This can't be undone.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete template" }));
    expect(handleDeleteTemplate).toHaveBeenCalledWith("template-1");
    expect(mocks.setSettingValue).not.toHaveBeenCalled();
  });

  it("keeps the template when the delete is canceled", async () => {
    const handleDeleteTemplate = vi.fn();
    render(
      <TemplateForm
        template={template}
        handleDeleteTemplate={handleDeleteTemplate}
        handleDuplicateTemplate={vi.fn()}
      />,
    );

    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Template actions" }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(handleDeleteTemplate).not.toHaveBeenCalled();
  });

  it("names the title field and the tag remove button", () => {
    render(
      <TemplateForm
        template={template}
        handleDeleteTemplate={vi.fn()}
        handleDuplicateTemplate={vi.fn()}
      />,
    );

    expect(screen.getByRole("textbox", { name: "Template name" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Remove Engineering" }),
    ).toBeTruthy();
  });
});
