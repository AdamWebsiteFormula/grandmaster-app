import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  platform: "macos",
  list: vi.fn(),
  openPath: vi.fn(),
  reveal: vi.fn(),
  toastError: vi.fn(),
  menus: [] as Array<
    Array<{ id?: string; text?: string; action?: () => void }>
  >,
}));

vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => mocks.platform }));
vi.mock("@anlg/plugin-fs-sync", () => ({
  commands: { folderAttachmentList: mocks.list },
}));
vi.mock("@anlg/plugin-opener2", () => ({
  commands: { openPath: mocks.openPath, revealItemInDir: mocks.reveal },
}));
vi.mock("@anlg/ui/components/ui/toast", () => ({
  toast: Object.assign(vi.fn(), { error: mocks.toastError }),
}));
vi.mock("~/shared/hooks/useNativeContextMenu", () => ({
  useNativeContextMenu: (
    menu: Array<{ id?: string; text?: string; action?: () => void }>,
  ) => {
    mocks.menus.push(menu);
    return vi.fn();
  },
}));

import { FolderMaterialTile } from "./folder-material-tile";

const material = {
  id: "m1",
  filename: "Brief.pdf",
  contentType: "application/pdf",
  sizeBytes: 10,
  relativePath: "materials/brief-1.pdf",
};

function renderTile() {
  return render(
    <FolderMaterialTile
      folderPath="Clients"
      material={material}
      busy={false}
      onRemove={vi.fn()}
    />,
  );
}

function lastMenu() {
  return mocks.menus[mocks.menus.length - 1]!;
}

// Fork tests: task test, Oct 9 (folder files could not be opened).
describe("FolderMaterialTile", () => {
  beforeEach(() => {
    mocks.platform = "macos";
    mocks.menus = [];
    mocks.list.mockResolvedValue({
      status: "ok",
      data: [
        {
          attachmentId: "brief-1.pdf",
          path: "/notes/Clients/materials/brief-1.pdf",
          extension: "pdf",
          modifiedAt: "",
        },
      ],
    });
    mocks.openPath.mockResolvedValue({ status: "ok", data: null });
    mocks.reveal.mockResolvedValue({ status: "ok", data: null });
    mocks.toastError.mockClear();
  });
  afterEach(cleanup);

  it("opens the file on double-click and on Return", async () => {
    renderTile();
    const tile = screen.getByRole("button", { name: "Open Brief.pdf" });

    fireEvent.doubleClick(tile);
    await vi.waitFor(() =>
      expect(mocks.openPath).toHaveBeenCalledWith(
        "/notes/Clients/materials/brief-1.pdf",
        null,
      ),
    );

    mocks.openPath.mockClear();
    fireEvent.keyDown(tile, { key: "Enter" });
    await vi.waitFor(() => expect(mocks.openPath).toHaveBeenCalledTimes(1));
  });

  it("offers Open and Show in Finder on a Mac", async () => {
    renderTile();
    const texts = lastMenu().map((item) => item.text);
    expect(texts).toContain("Open");
    expect(texts).toContain("Show in Finder");

    lastMenu()
      .find((item) => item.text === "Show in Finder")
      ?.action?.();
    await vi.waitFor(() =>
      expect(mocks.reveal).toHaveBeenCalledWith(
        "/notes/Clients/materials/brief-1.pdf",
      ),
    );
  });

  it("says Show in File Explorer on Windows", () => {
    mocks.platform = "windows";
    renderTile();
    expect(lastMenu().map((item) => item.text)).toContain(
      "Show in File Explorer",
    );
  });

  it("says so when the file can't be opened", async () => {
    mocks.list.mockResolvedValue({ status: "ok", data: [] });
    renderTile();

    fireEvent.doubleClick(
      screen.getByRole("button", { name: "Open Brief.pdf" }),
    );

    await vi.waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Couldn't open Brief.pdf. Try again.",
      ),
    );
  });
});
