import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDeleteRecordingConfirm } from "./delete-recording-confirm";

const mocks = vi.hoisted(() => ({ toastError: vi.fn() }));

vi.mock("@anlg/ui/components/ui/toast", () => ({
  toast: { error: mocks.toastError },
}));

function Harness({
  deleteRecording,
}: {
  deleteRecording: () => Promise<void>;
}) {
  const { requestDeleteRecording, confirmDialog } = useDeleteRecordingConfirm({
    deleteRecording,
    isPending: false,
  });

  return (
    <>
      <button type="button" onClick={requestDeleteRecording}>
        Request delete
      </button>
      {confirmDialog}
    </>
  );
}

describe("useDeleteRecordingConfirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it("asks before deleting and deletes only on confirm", async () => {
    const deleteRecording = vi.fn().mockResolvedValue(undefined);
    render(<Harness deleteRecording={deleteRecording} />);

    fireEvent.click(screen.getByRole("button", { name: "Request delete" }));

    expect(screen.getByText("Delete this recording?")).toBeTruthy();
    expect(
      screen.getByText("The transcript and notes stay. You can't undo this."),
    ).toBeTruthy();
    expect(deleteRecording).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete recording" }));

    await waitFor(() => expect(deleteRecording).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.queryByText("Delete this recording?")).toBeNull(),
    );
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("keeps the recording when canceled", () => {
    const deleteRecording = vi.fn().mockResolvedValue(undefined);
    render(<Harness deleteRecording={deleteRecording} />);

    fireEvent.click(screen.getByRole("button", { name: "Request delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(deleteRecording).not.toHaveBeenCalled();
  });

  it("shows an error toast when deleting fails", async () => {
    const deleteRecording = vi
      .fn()
      .mockRejectedValue(new Error("audio_session_busy"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Harness deleteRecording={deleteRecording} />);

    fireEvent.click(screen.getByRole("button", { name: "Request delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete recording" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Couldn't delete the recording. Stop playback and try again.",
      ),
    );
  });
});
