import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
}));

vi.mock("@tauri-apps/api/path", () => ({
  dataDir: async () => "/Users/test/Library/Application Support",
}));
vi.mock("@anlg/plugin-fs2", () => ({
  commands: {
    readTextFile: mocks.readTextFile,
    writeTextFile: mocks.writeTextFile,
  },
}));
vi.mock("@anlg/plugin-opener2", () => ({
  commands: { revealItemInDir: vi.fn() },
}));
vi.mock("@anlg/ui/components/ui/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("~/types/tauri.gen", () => ({
  commands: { getMcpServerPaths: vi.fn() },
}));

import { GlaidoSection } from "./glaido";

const FOLDER = "/Users/test/Library/Application Support/Upshot/glaido";

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <GlaidoSection />
    </QueryClientProvider>,
  );
}

// Fork: journey-after P3 "Settings › Developers › Glaido".
describe("GlaidoSection after a restart", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it("shows the import steps when the folder already exists", async () => {
    mocks.readTextFile.mockResolvedValue({ status: "ok", data: "{}" });
    renderSection();

    expect(
      await screen.findByRole("button", { name: "Update folder" }),
    ).toBeTruthy();
    expect(screen.getByText(FOLDER)).toBeTruthy();
    expect(mocks.readTextFile).toHaveBeenCalledWith(`${FOLDER}/mcp.json`);
  });

  it("offers to create the folder when there is none", async () => {
    mocks.readTextFile.mockResolvedValue({
      status: "error",
      error: "No such file",
    });
    renderSection();

    expect(
      await screen.findByRole("button", { name: "Create Glaido folder" }),
    ).toBeTruthy();
    expect(screen.queryByText(FOLDER)).toBeNull();
  });
});
