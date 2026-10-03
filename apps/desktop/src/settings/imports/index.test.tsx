import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  openUrl: vi.fn(async () => ({ status: "ok", data: null })),
}));

vi.mock("@anlg/plugin-opener2", () => ({
  commands: { openUrl: mocks.openUrl },
}));
vi.mock("~/imports/screen", () => ({ MeetingImportScreen: () => null }));

import { SettingsImports } from "./index";

// journey-account-settings P3 "Developers, Imports: Help".
describe("Settings › Imports", () => {
  afterEach(cleanup);

  it("Help opens the README import section, not the repository root", () => {
    render(<SettingsImports />);
    fireEvent.click(screen.getByRole("button", { name: /Help/ }));
    expect(mocks.openUrl).toHaveBeenCalledWith(
      "https://github.com/AdamWebsiteFormula/grandmaster-app#import-from-granola",
      null,
    );
  });
});
