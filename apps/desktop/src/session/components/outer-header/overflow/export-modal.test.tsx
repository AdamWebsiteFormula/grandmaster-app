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
  settings: vi.fn(),
  downloadDir: vi.fn(),
  exportPdf: vi.fn(),
  writeTextFile: vi.fn(),
  revealItemInDir: vi.fn(),
  onOpenChange: vi.fn(),
  save: vi.fn(),
  isAppStoreBuild: vi.fn(),
  enhancedNotes: [] as { id: string; content: string }[],
}));

vi.mock("@tauri-apps/api/path", () => ({
  downloadDir: mocks.downloadDir,
  join: async (...parts: string[]) => parts.join("/"),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ save: mocks.save }));
vi.mock("@anlg/plugin-export", () => ({
  commands: { export: mocks.exportPdf },
}));
vi.mock("@anlg/plugin-fs2", () => ({
  commands: { writeTextFile: mocks.writeTextFile },
}));
vi.mock("@anlg/plugin-opener2", () => ({
  commands: { revealItemInDir: mocks.revealItemInDir },
}));
vi.mock("~/settings/queries", () => ({
  getStoredSettingValues: mocks.settings,
}));
vi.mock("~/shared/app-store", () => ({
  isAppStoreBuild: mocks.isAppStoreBuild,
}));
vi.mock("~/session/queries", () => ({
  useSession: () => ({ title: "Project review" }),
  useEnhancedNote: (id: string) =>
    mocks.enhancedNotes.find((note) => note.id === id),
  useEnhancedNoteRecords: () => mocks.enhancedNotes,
  useSessionParticipants: () => [],
}));
vi.mock("~/session/utils", () => ({ getSessionEvent: () => null }));
vi.mock("~/session/components/note-input/transcript/export-data", () => ({
  useTranscriptExportSegments: () => ({ data: [], isLoading: false }),
}));
vi.mock("~/stt/queries", () => ({ useSessionTranscriptMetadata: () => [] }));

import { ExportModal } from "./export-modal";

function renderModal() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ExportModal
        sessionId="session-1"
        currentView={{ type: "raw" }}
        open
        onOpenChange={mocks.onOpenChange}
      />
    </QueryClientProvider>,
  );
}

const doc = (text: string) =>
  JSON.stringify({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });
const doc1 = { id: "summary-1", content: doc("First summary text") };

describe("ExportModal destination", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.settings.mockResolvedValue({ values: {} });
    mocks.downloadDir.mockResolvedValue("/Users/test/Downloads");
    mocks.exportPdf.mockResolvedValue({ status: "ok", data: null });
    mocks.writeTextFile.mockResolvedValue({ status: "ok", data: null });
    mocks.isAppStoreBuild.mockReturnValue(false);
    // The Save panel returns the path it was given, as if the user clicked Save.
    mocks.save.mockImplementation(
      async ({ defaultPath }: { defaultPath: string }) => defaultPath,
    );
    mocks.enhancedNotes = [doc1];
  });
  afterEach(cleanup);

  it("falls back to the first summary when exporting from My notes", async () => {
    mocks.enhancedNotes = [
      doc1,
      { id: "summary-2", content: doc("Second summary text") },
    ];
    renderModal();
    fireEvent.click(screen.getByRole("radio", { name: "Markdown" }));
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(mocks.writeTextFile).toHaveBeenCalled());
    const content = mocks.writeTextFile.mock.calls[0][1] as string;
    expect(content).toContain("## Summary");
    expect(content).toContain("First summary text");
    expect(content).not.toContain("Second summary text");
  });

  it("closes from Cancel without exporting", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocks.onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.exportPdf).not.toHaveBeenCalled();
  });

  // Fork: journey-after P2 "Export…": always the Save panel, readable name.
  it.each([
    ["PDF", "pdf"],
    ["TXT", "txt"],
    ["Markdown", "md"],
  ])("saves %s through the Save panel", async (label, extension) => {
    mocks.settings.mockResolvedValue({
      values: { export_directory: "/Volumes/Work/Exports" },
    });
    renderModal();
    fireEvent.click(screen.getByRole("radio", { name: label }));
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(mocks.onOpenChange).toHaveBeenCalledWith(false));
    expect(mocks.save).toHaveBeenCalledWith({
      defaultPath: expect.stringMatching(
        new RegExp(
          `^/Volumes/Work/Exports/Project review – [A-Z][a-z]{2} \\d{1,2}, \\d{4}\\.${extension}$`,
        ),
      ),
      filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
    });
    const writer = extension === "pdf" ? mocks.exportPdf : mocks.writeTextFile;
    expect(writer).toHaveBeenCalledWith(
      mocks.save.mock.calls[0][0].defaultPath,
      extension === "pdf" ? expect.any(Object) : expect.any(String),
    );
    expect(mocks.revealItemInDir).toHaveBeenCalledWith(writer.mock.calls[0][0]);
    expect(mocks.downloadDir).not.toHaveBeenCalled();
  });

  // Fork: journey-after P3 "Export format".
  it("does not offer Org", () => {
    renderModal();
    expect(screen.queryByRole("radio", { name: "Org" })).toBeNull();
  });

  // Fork: journey-after P2 "Export, no summary".
  it("defaults to My notes and disables Summary when there is no summary", async () => {
    mocks.enhancedNotes = [];
    renderModal();
    const summary = screen.getByRole("checkbox", { name: "Summary" });
    expect(summary.hasAttribute("disabled")).toBe(true);
    expect((summary as HTMLInputElement).checked).toBe(false);
    expect(summary.getAttribute("aria-describedby")).toBe("export-no-summary");
    expect(screen.getByText("No summary yet")).toBeTruthy();
    expect(
      (screen.getByRole("checkbox", { name: "My notes" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
  });

  it("keeps Summary as the default when the note has one", () => {
    renderModal();
    const summary = screen.getByRole("checkbox", {
      name: "Summary",
    }) as HTMLInputElement;
    expect(summary.checked).toBe(true);
    expect(summary.hasAttribute("disabled")).toBe(false);
    expect(screen.queryByText("No summary yet")).toBeNull();
  });

  it.each([undefined, ""])(
    "uses Downloads when the preference is %s",
    async (directory) => {
      mocks.settings.mockResolvedValue({
        values: { export_directory: directory },
      });
      renderModal();
      fireEvent.click(screen.getByRole("button", { name: "Export" }));
      await waitFor(() =>
        expect(mocks.exportPdf).toHaveBeenCalledWith(
          expect.stringMatching(/^\/Users\/test\/Downloads\//),
          expect.any(Object),
        ),
      );
    },
  );

  it("does not export to Downloads if reading the saved preference fails", async () => {
    mocks.settings.mockRejectedValue(new Error("Database unavailable"));
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await screen.findByRole("alert");
    expect(mocks.downloadDir).not.toHaveBeenCalled();
    expect(mocks.exportPdf).not.toHaveBeenCalled();
  });

  it("keeps the modal open and shows write failures", async () => {
    mocks.writeTextFile.mockResolvedValue({
      status: "error",
      error: "Permission denied",
    });
    renderModal();
    fireEvent.click(screen.getByRole("radio", { name: "Markdown" }));
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Pick another folder and try again",
    );
    expect(mocks.onOpenChange).not.toHaveBeenCalled();
    expect(mocks.revealItemInDir).not.toHaveBeenCalled();
  });

  it("uses the saved folder as the save dialog default", async () => {
    mocks.settings.mockResolvedValue({
      values: { export_directory: "/Users/test/Documents" },
    });
    mocks.save.mockResolvedValue("/Users/test/Documents/review.pdf");
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() =>
      expect(mocks.exportPdf).toHaveBeenCalledWith(
        "/Users/test/Documents/review.pdf",
        expect.any(Object),
      ),
    );
    expect(mocks.save).toHaveBeenCalledWith({
      defaultPath: expect.stringMatching(/^\/Users\/test\/Documents\//),
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
  });

  it("leaves the export modal open when the native save dialog is canceled", async () => {
    mocks.save.mockResolvedValue(null);
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Export" }).hasAttribute("disabled"),
      ).toBe(false),
    );
    expect(mocks.exportPdf).not.toHaveBeenCalled();
    expect(mocks.onOpenChange).not.toHaveBeenCalled();
    expect(mocks.revealItemInDir).not.toHaveBeenCalled();
  });
});
