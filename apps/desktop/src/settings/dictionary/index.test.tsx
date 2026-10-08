import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  billing: {
    isPro: true,
    isUpgradingToPro: false,
    upgradeToPro: vi.fn(),
  },
  toastWarning: vi.fn(),
}));

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useLingui: () => ({
    t: (
      input: TemplateStringsArray | { message?: string } | string,
      ...values: unknown[]
    ) => {
      if (typeof input === "string") return input;
      if (Array.isArray(input)) {
        return (input as readonly string[]).reduce(
          (message: string, part: string, index: number) =>
            `${message}${part}${index < values.length ? String(values[index]) : ""}`,
          "",
        );
      }
      return (input as { message?: string }).message ?? "";
    },
  }),
}));

vi.mock("~/settings/queries", () => ({
  useSetSettingValue: () => vi.fn(),
}));

vi.mock("~/auth/billing-context", () => ({
  useBillingAccess: () => mocks.billing,
}));

vi.mock("@anlg/ui/components/ui/toast", () => ({
  toast: { warning: mocks.toastWarning },
}));

vi.mock("~/shared/config", () => ({
  useConfigValue: () => [],
}));

import { DictionarySettings, DictionarySection } from "./index";

describe("DictionarySettings", () => {
  beforeEach(() => {
    mocks.billing.isPro = true;
    mocks.billing.isUpgradingToPro = false;
    mocks.billing.upgradeToPro.mockClear();
    mocks.toastWarning.mockClear();
  });

  afterEach(cleanup);

  it("is fully usable on the free plan, with a labeled input", () => {
    mocks.billing.isPro = false;

    render(<DictionarySection />);

    const input = screen.getByRole("textbox", { name: "Add a term" });
    fireEvent.click(input);

    expect(mocks.toastWarning).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "Names, jargon, and product terms Upshot should spell your way.",
      ),
    ).toBeTruthy();
  });

  it("adds entered terms and keeps them normalized", async () => {
    const onSave = vi.fn();
    render(<DictionarySettings terms={["Anarlog"]} onSave={onSave} />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: " FastConformer, Parakeet TDT " },
    });
    const addButton = screen.getByRole("button", {
      name: "Add",
    }) as HTMLButtonElement;
    await waitFor(() => expect(addButton.disabled).toBe(false));
    fireEvent.click(addButton);

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        JSON.stringify(["Anarlog", "FastConformer", "Parakeet TDT"]),
      ),
    );
  });

  it("removes saved terms", () => {
    const onSave = vi.fn();
    render(
      <DictionarySettings
        terms={["Anarlog", "Parakeet TDT"]}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove Anarlog" }));

    expect(onSave).toHaveBeenCalledWith(JSON.stringify(["Parakeet TDT"]));
  });

  it("edits saved terms inline", () => {
    const onSave = vi.fn();
    render(
      <DictionarySettings
        terms={["Anarlog", "Parakeet TDT"]}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit: Anarlog" }));
    const input = screen.getByRole("textbox", { name: "Edit: Anarlog" });
    fireEvent.change(input, { target: { value: " Anarlog AI " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith(
      JSON.stringify(["Anarlog AI", "Parakeet TDT"]),
    );
  });

  it("does not save an edit that duplicates another term", () => {
    const onSave = vi.fn();
    render(
      <DictionarySettings
        terms={["Anarlog", "Parakeet TDT"]}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit: Anarlog" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Edit: Anarlog" }), {
      target: { value: "parakeet tdt" },
    });

    expect(
      (screen.getByRole("button", { name: "Save" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("cancels inline edits with Escape", () => {
    const onSave = vi.fn();
    render(<DictionarySettings terms={["Anarlog"]} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit: Anarlog" }));
    const input = screen.getByRole("textbox", { name: "Edit: Anarlog" });
    fireEvent.change(input, { target: { value: "Anarlog AI" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.getByText("Anarlog")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("does not enable adding duplicate terms", async () => {
    const onSave = vi.fn();
    render(<DictionarySettings terms={["Anarlog"]} onSave={onSave} />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "anarlog" },
    });

    const addButton = screen.getByRole("button", {
      name: "Add",
    }) as HTMLButtonElement;
    await waitFor(() => expect(addButton.disabled).toBe(true));
    fireEvent.click(addButton);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("filters saved terms while typing", async () => {
    render(
      <DictionarySettings
        terms={["Anarlog", "FastConformer", "Parakeet TDT"]}
        onSave={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "fast" },
    });

    await waitFor(() => expect(screen.getByText("FastConformer")).toBeTruthy());
    expect(screen.queryByText("Anarlog")).toBeNull();
    expect(screen.queryByText("Parakeet TDT")).toBeNull();
  });

  // journey-account-settings P3 "Settings › Dictionary".
  it("puts the field in a card and styles Add with tokens", () => {
    render(<DictionarySettings terms={[]} onSave={vi.fn()} />);
    const input = screen.getByRole("textbox", { name: "Add a term" });
    expect(input.closest("[data-settings-card]")).not.toBeNull();
    const add = screen.getByRole("button", { name: "Add" });
    expect(add.className).not.toMatch(
      /bg-black|bg-white|text-white|text-black/,
    );
    expect(add.className).toContain("bg-secondary");
  });

  // Fork: Settings cards (design-system "Contrast") and an empty state
  // that says what shows up here (NN/g empty states).
  it("uses Settings cards and an empty state that does not repeat the hint", () => {
    render(<DictionarySettings terms={[]} onSave={vi.fn()} />);
    expect(screen.getByText("Terms you add show up here.")).toBeTruthy();
    expect(screen.queryByText(/^Tip:/)).toBeNull();
    const empty = screen
      .getByText("Your dictionary is empty")
      .closest("[data-settings-card]")!;
    expect(empty.className).toContain("dark:bg-muted");
    expect(empty.className).toContain("rounded-xl");
    expect(empty.className).not.toContain("rounded-2xl");
    cleanup();

    render(<DictionarySettings terms={["Anarlog"]} onSave={vi.fn()} />);
    const list = screen.getByText("Anarlog").closest(".divide-y")!;
    expect(list.className).toContain("dark:bg-muted");
    expect(list.className).toContain("rounded-xl");
  });
});
