import { cleanup, render, screen } from "@testing-library/react";
import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("~/shared/main", () => ({
  StandardContentWrapper: ({
    children,
    floatingButton,
  }: {
    children: React.ReactNode;
    floatingButton?: React.ReactNode;
  }) => (
    <div>
      {children}
      {floatingButton}
    </div>
  ),
}));

vi.mock("~/home/home-view", () => ({
  HomeView: () => <div>Home view</div>,
}));

vi.mock("~/home/home-composer", () => ({
  HomeComposer: () => <input aria-label="Ask anything" />,
}));

import { TabContentEmpty } from "./empty";

describe("TabContentEmpty", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the home view and the Ask anything composer", () => {
    render(
      <TabContentEmpty
        tab={{
          active: true,
          pinned: false,
          slotId: "slot-home",
          type: "empty",
        }}
      />,
    );

    expect(screen.getByText("Home view")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Ask anything" })).toBeTruthy();
  });
});
