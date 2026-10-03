import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("~/ai/hooks", () => ({
  useModelMetadata: () => ({
    data: { models: ["model-new", "model-old"], ignored: [], metadata: {} },
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("./model-list-enrich", () => ({
  groupModelOptions: () => ({
    primary: ["model-new"],
    more: ["model-old"],
    previews: [],
  }),
}));

import { ModelCombobox } from "./model-combobox";

Element.prototype.scrollIntoView = vi.fn();

describe("ModelCombobox", () => {
  afterEach(cleanup);

  it("collapses More models even when the saved model is in it", () => {
    render(
      <ModelCombobox
        providerId="openai"
        value="model-old"
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByText("Fewer models"));

    expect(screen.getByText("More models (1)")).toBeTruthy();
  });
});
