import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AlwaysOnTop } from "./always-on-top";

const { setAlwaysOnTopMock } = vi.hoisted(() => ({
  setAlwaysOnTopMock: vi.fn(() => Promise.resolve()),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    isAlwaysOnTop: () => Promise.resolve(false),
    setAlwaysOnTop: setAlwaysOnTopMock,
  }),
}));

vi.mock("@anlg/ui/components/ui/dropdown-menu", () => ({
  DropdownMenuItem: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

describe("AlwaysOnTop", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("pins the current window when toggled on", async () => {
    const { container } = render(<AlwaysOnTop />);

    const item = await screen.findByRole("button", { name: "Always on Top" });
    await vi.waitFor(() =>
      expect((item as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(item);

    expect(setAlwaysOnTopMock).toHaveBeenCalledWith(true);
    expect(container.querySelector(".ml-auto")).not.toBeNull();
  });
});
