import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./auto-form", () => ({ AutoTemplateDetails: () => null }));

vi.mock("./queries", () => ({
  useSaveTemplate: () => vi.fn(async () => {}),
  useToggleTemplateFavorite: () => vi.fn(),
}));

vi.mock("./sections-editor", () => ({
  SectionsList: () => null,
}));

vi.mock("./template-icon", () => ({
  TemplateIconGlyph: () => null,
}));

vi.mock("./template-icon-picker", () => ({
  TemplateIconPicker: () => null,
}));

vi.mock("./utils", () => ({
  getTemplateCreatorLabel: () => "by Upshot",
}));

vi.mock("~/resource-sharing", () => ({
  ResourceShareButton: () => null,
  sharedTemplatePayload: vi.fn(),
}));

vi.mock("~/settings/queries", () => ({
  useSetSettingValue: () => vi.fn(),
  setSettingValue: vi.fn(),
}));

vi.mock("~/shared/config", () => ({
  useConfigValue: () => "",
}));

import type { WebTemplate } from "./codec";
import { TemplateDetailsColumn } from "./details";

const webTemplate = {
  slug: "general-meeting",
  title: "General meeting",
  description: "Any meeting: what was discussed and decided.",
  targets: ["meeting"],
  sections: [{ title: "Summary", description: "The outcome." }],
} as unknown as WebTemplate;

describe("TemplateDetailsColumn", () => {
  afterEach(cleanup);

  // Fork: Oct 4 template screen review (NN/g #4). The shared header's
  // bg-muted chip is the panel's own color in light, so the built-in
  // template's tag drew no chip.
  it("draws a built-in template's tag once, as a raised chip", () => {
    render(
      <TemplateDetailsColumn
        isAutoSelected={false}
        isWebMode
        selectedMineTemplate={null}
        selectedWebTemplate={webTemplate}
        handleCreateTemplate={vi.fn()}
        handleDeleteTemplate={vi.fn()}
        handleDuplicateTemplate={vi.fn()}
        handleCloneTemplate={vi.fn()}
        handleFavoriteTemplate={vi.fn()}
        handleSetDefaultTemplate={vi.fn()}
      />,
    );

    const chips = screen.getAllByText("meeting");
    expect(chips).toHaveLength(1);

    const chip = chips[0].className.split(/\s+/);
    expect(chip).toEqual(
      expect.arrayContaining(["bg-card", "dark:bg-muted", "border-border"]),
    );
    expect(chip).not.toContain("bg-muted");
    // The header's "Created by" line stays off: the title row says "by".
    expect(screen.queryByText("Created by Upshot")).toBeNull();
  });

  it("draws no tag row when the template has no tags", () => {
    const { container } = render(
      <TemplateDetailsColumn
        isAutoSelected={false}
        isWebMode
        selectedMineTemplate={null}
        selectedWebTemplate={{ ...webTemplate, targets: undefined }}
        handleCreateTemplate={vi.fn()}
        handleDeleteTemplate={vi.fn()}
        handleDuplicateTemplate={vi.fn()}
        handleCloneTemplate={vi.fn()}
        handleFavoriteTemplate={vi.fn()}
        handleSetDefaultTemplate={vi.fn()}
      />,
    );

    expect(container.querySelector(".border-border.rounded-md")).toBeNull();
  });
});
