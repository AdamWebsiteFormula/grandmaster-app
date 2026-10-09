import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ toast: vi.fn() }));

vi.mock("@anlg/ui/components/ui/toast", () => ({ toast: mocks.toast }));

// The menu renders its items inline so a test can press Delete.
vi.mock("@anlg/ui/components/ui/dropdown-menu", () => ({
  AppFloatingPanel: ({ children }: { children: ReactNode }) => <>{children}</>,
  appFloatingMenuPanelClassName: "",
  DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

import { SectionsList } from "./sections-editor";

const items = [
  { title: "Summary", description: "The outcome." },
  { title: "Decisions", description: "What was agreed." },
];

// Fork test: task test, Oct 9 (Delete took a section with no way back).
describe("SectionsList delete", () => {
  afterEach(cleanup);

  it("offers Undo, which puts the section back in its place", async () => {
    const onChange = vi.fn();
    render(<SectionsList disabled={false} items={items} onChange={onChange} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]!);
    expect(onChange).toHaveBeenLastCalledWith([items[1]]);

    const [title, options] = mocks.toast.mock.calls[0]!;
    expect(title).toBe("Section deleted");
    options.action.onClick();

    await vi.waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith([items[0], items[1]]),
    );
  });
});
