import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
}));

vi.mock("~/shared/config", () => ({
  useConfigValue: () => "",
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
  afterEach(cleanup);

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
