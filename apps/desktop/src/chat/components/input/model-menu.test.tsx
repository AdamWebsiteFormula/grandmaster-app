import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isPro: false,
  model: "Auto" as string,
  setModel: vi.fn(),
  openUpgrade: vi.fn(),
}));

vi.mock("@anlg/ui/components/ui/dropdown-menu", () => ({
  appFloatingMenuPanelClassName: "",
  AppFloatingPanel: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenu: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuItem: ({
    children,
    disabled,
    onSelect,
  }: {
    children: ReactNode;
    disabled?: boolean;
    onSelect?: () => void;
  }) => (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => onSelect?.()}
    >
      {children}
    </button>
  ),
}));

vi.mock("~/settings/ai/shared/use-model-registry", () => ({
  useModelRegistry: () => ({
    registry: {
      providers: {
        openrouter: [
          {
            id: "anthropic/claude-sonnet-5.5",
            name: "Claude Sonnet 5.5",
            releasedAt: "2026-09-28",
          },
          {
            id: "openai/gpt-6.1-sol",
            name: "GPT-6.1 Sol",
            releasedAt: "2026-09-29",
          },
        ],
      },
    },
  }),
}));
vi.mock("~/settings/queries", () => ({
  useSetSettingValue: () => mocks.setModel,
}));
vi.mock("~/shared/config", () => ({
  useConfigValue: () => mocks.model,
}));
vi.mock("~/upshot-plan", () => ({
  useUpshotPro: () => mocks.isPro,
  openUpgrade: mocks.openUpgrade,
}));

import { ChatModelMenu } from "./model-menu";

// Fork: Granola's composer menu: free is Auto only, Pro picks a model
// (docs.granola.ai/help-center/getting-more-from-your-notes/understanding-model-selection-in-granola-chat).
describe("ChatModelMenu", () => {
  afterEach(() => {
    cleanup();
    mocks.isPro = false;
    mocks.model = "Auto";
    mocks.setModel.mockReset();
    mocks.openUpgrade.mockReset();
  });

  it("shows Auto to free users, with current models locked behind Pro", () => {
    mocks.model = "openai/gpt-6.1-sol";
    render(<ChatModelMenu />);

    expect(screen.getByRole("button", { name: "Model, Auto" })).not.toBeNull();
    const sonnet = screen.getByRole("menuitem", { name: /Claude Sonnet 5.5/ });
    expect(sonnet.hasAttribute("disabled")).toBe(true);
    expect(sonnet.textContent).toContain("Pro");

    fireEvent.click(
      screen.getByRole("menuitem", { name: "Upgrade to pick a model" }),
    );
    expect(mocks.openUpgrade).toHaveBeenCalledOnce();
  });

  it("lets Pro users pick a model and go back to Auto", () => {
    mocks.isPro = true;
    mocks.model = "openai/gpt-6.1-sol";
    render(<ChatModelMenu />);

    expect(
      screen.getByRole("button", { name: "Model, GPT-6.1 Sol" }),
    ).not.toBeNull();
    expect(screen.queryByRole("menuitem", { name: /Upgrade/ })).toBeNull();

    fireEvent.click(screen.getByRole("menuitem", { name: /Claude Sonnet/ }));
    expect(mocks.setModel).toHaveBeenCalledWith("anthropic/claude-sonnet-5.5");
    fireEvent.click(screen.getByRole("menuitem", { name: "Auto" }));
    expect(mocks.setModel).toHaveBeenCalledWith("Auto");
  });
});
