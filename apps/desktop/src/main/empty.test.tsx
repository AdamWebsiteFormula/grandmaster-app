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

vi.mock("~/contexts/shell", () => ({
  useShell: () => ({
    chat: {
      mode: "FloatingClosed",
      sendEvent: vi.fn(),
    },
  }),
}));

import { TabContentEmpty } from "./empty";

describe("TabContentEmpty", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the home view and the global chat bar", () => {
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
    expect(
      screen.getByRole("button", { name: "Ask Upshot anything" }),
    ).toBeTruthy();
  });
});
