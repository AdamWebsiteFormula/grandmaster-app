import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteModel: vi.fn(),
}));

vi.mock("@anlg/plugin-local-stt", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@anlg/plugin-local-stt")>();
  return {
    ...actual,
    commands: { ...actual.commands, deleteModel: mocks.deleteModel },
  };
});

vi.mock("~/auth/billing-context", () => ({
  useBillingAccess: () => ({ isPaid: true }),
}));

import { DeleteLocalModelDialog, parseModelAction } from "./select";

afterEach(() => {
  cleanup();
  mocks.deleteModel.mockReset();
});

function renderDialog(onClose = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <DeleteLocalModelDialog
        model={{
          id: "am-whisper-large-v3",
          displayName: "Whisper Large v3",
          isDownloaded: true,
          sizeBytes: 1.5 * 1024 * 1024 * 1024,
        }}
        onClose={onClose}
      />
    </QueryClientProvider>,
  );
  return onClose;
}

describe("DeleteLocalModelDialog", () => {
  it("asks before deleting and names the download it will cost", () => {
    renderDialog();

    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toMatch(/Delete .+\?/);
    expect(dialog.textContent).toContain("You’ll need to download it again (");
    expect(dialog.textContent).toContain("GB) to use it.");
    expect(mocks.deleteModel).not.toHaveBeenCalled();
  });

  it("deletes only after Delete is pressed", async () => {
    mocks.deleteModel.mockResolvedValue({ status: "ok", data: null });
    const onClose = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(mocks.deleteModel).toHaveBeenCalledWith("am-whisper-large-v3");
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("cancels without deleting", () => {
    const onClose = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(mocks.deleteModel).not.toHaveBeenCalled();
  });
});

describe("parseModelAction", () => {
  it("reads menu actions and leaves model ids alone", () => {
    expect(parseModelAction("download::model-action::am-parakeet-v3")).toEqual({
      kind: "download",
      model: "am-parakeet-v3",
    });
    expect(parseModelAction("cancel::model-action::am-parakeet-v3")).toEqual({
      kind: "cancel",
      model: "am-parakeet-v3",
    });
    expect(parseModelAction("am-parakeet-v3")).toBeNull();
  });
});
