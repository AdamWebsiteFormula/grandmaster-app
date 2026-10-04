import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  downloadDir: vi.fn(),
  selectFolder: vi.fn(),
  setSettingValue: vi.fn(),
  settings: vi.fn(),
  platform: "macos",
}));

vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => mocks.platform }));

vi.mock("@tauri-apps/api/path", () => ({
  downloadDir: mocks.downloadDir,
  homeDir: async () => "/Users/test",
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mocks.selectFolder }));
vi.mock("~/settings/queries", () => ({
  useStoredSettingValuesQuery: mocks.settings,
  setSettingValue: mocks.setSettingValue,
}));

import { ExportLocationRow } from "./export-location";

function renderRow() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ExportLocationRow />
    </QueryClientProvider>,
  );
}

describe("ExportLocationRow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.downloadDir.mockResolvedValue("/Users/test/Downloads");
    mocks.selectFolder.mockResolvedValue(null);
    mocks.setSettingValue.mockResolvedValue(undefined);
    mocks.settings.mockReturnValue({ data: { values: {} }, isLoading: false });
    mocks.platform = "macos";
  });
  afterEach(cleanup);

  // Fork: Finder is the Mac's; elsewhere the label names the folder (NN/g #2).
  it.each([
    ["macos", "Open ~/Downloads in Finder"],
    ["windows", "Open the ~/Downloads folder"],
  ])("labels the folder button on %s", async (os, label) => {
    mocks.platform = os;
    renderRow();

    expect(await screen.findByRole("button", { name: label })).toBeTruthy();
  });

  it("defaults to Downloads and saves the chosen folder", async () => {
    mocks.selectFolder.mockResolvedValue("/Volumes/Work/Meeting exports");
    renderRow();
    await screen.findByText("~/Downloads");
    fireEvent.click(screen.getByRole("button", { name: "Choose folder" }));
    await waitFor(() =>
      expect(mocks.setSettingValue).toHaveBeenCalledWith(
        "export_directory",
        "/Volumes/Work/Meeting exports",
      ),
    );
    expect(mocks.selectFolder).toHaveBeenCalledWith({
      title: "Choose export folder",
      directory: true,
      multiple: false,
      defaultPath: "/Users/test/Downloads",
    });
  });

  it("shows the persisted folder and clears the override on reset", async () => {
    mocks.settings.mockReturnValue({
      data: { values: { export_directory: "/Users/test/Documents" } },
      isLoading: false,
    });
    renderRow();
    await screen.findByText("~/Documents");
    expect(mocks.downloadDir).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reset to Downloads" }));
    await waitFor(() =>
      expect(mocks.setSettingValue).toHaveBeenCalledWith(
        "export_directory",
        "",
      ),
    );
    expect(mocks.selectFolder).not.toHaveBeenCalled();
  });

  it("keeps the setting when the folder picker is canceled", async () => {
    renderRow();
    await screen.findByText("~/Downloads");
    fireEvent.click(screen.getByRole("button", { name: "Choose folder" }));
    await waitFor(() => expect(mocks.selectFolder).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Choose folder" })
          .hasAttribute("disabled"),
      ).toBe(false),
    );
    expect(mocks.setSettingValue).not.toHaveBeenCalled();
  });

  it.each(["picker", "persistence"])(
    "shows a recoverable %s error",
    async (failure) => {
      if (failure === "picker")
        mocks.selectFolder.mockRejectedValue(new Error("Unavailable"));
      else {
        mocks.selectFolder.mockResolvedValue("/Users/test/Documents");
        mocks.setSettingValue.mockRejectedValue(
          new Error("Database unavailable"),
        );
      }
      renderRow();
      await screen.findByText("~/Downloads");
      fireEvent.click(screen.getByRole("button", { name: "Choose folder" }));
      expect((await screen.findByRole("alert")).textContent).toBe(
        "Could not update the export folder",
      );
      expect(screen.getByText("~/Downloads")).toBeTruthy();
    },
  );

  it("puts the description under the title and the folder beside its button", async () => {
    renderRow();
    const folder = await screen.findByText("~/Downloads");
    const title = screen.getByRole("heading", { name: "Export location" });
    const description = screen.getByText(
      "Save PDF, text, and Markdown exports to this folder.",
    );
    expect(description.parentElement).toBe(title.parentElement);
    const choose = screen.getByRole("button", { name: "Choose folder" });
    expect(folder.parentElement).toBe(choose.parentElement);
    expect(folder.getAttribute("title")).toBe("/Users/test/Downloads");
  });

  it("waits for settings to load before allowing a change", () => {
    mocks.settings.mockReturnValue({ isLoading: true });
    renderRow();
    expect(
      screen
        .getByRole("button", { name: "Choose folder" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
});
