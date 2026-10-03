import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listSupportedModels: vi.fn(),
  isModelDownloaded: vi.fn(),
  downloadModel: vi.fn(),
  cancelDownload: vi.fn(),
  listen: vi.fn(),
}));

vi.mock("@anlg/plugin-local-stt", () => ({
  commands: {
    listSupportedModels: mocks.listSupportedModels,
    isModelDownloaded: mocks.isModelDownloaded,
    downloadModel: mocks.downloadModel,
    cancelDownload: mocks.cancelDownload,
  },
  events: { downloadProgressPayload: { listen: mocks.listen } },
}));
vi.mock("~/settings/queries", () => ({ setSettingValues: vi.fn() }));
vi.mock("~/shared/config", () => ({ useConfigValue: () => "apple_speech" }));

import {
  formatDownloadSize,
  isOfflineFailure,
  TranscriptionSetupSection,
} from "./transcription";

let downloaded = false;

beforeEach(() => {
  vi.useFakeTimers();
  downloaded = false;
  mocks.listSupportedModels.mockResolvedValue({
    status: "ok",
    data: [{ key: "apple-speech" }],
  });
  mocks.isModelDownloaded.mockImplementation(async () => ({
    status: "ok",
    data: downloaded,
  }));
  mocks.downloadModel.mockResolvedValue({ status: "ok", data: null });
  mocks.listen.mockResolvedValue(() => {});
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

it("never shows Try again once the engine is ready, even after 45 s", async () => {
  render(<TranscriptionSetupSection onContinue={() => {}} />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(mocks.downloadModel).toHaveBeenCalledTimes(1);

  // The macOS install finishes without a progress event; the poll sees it.
  downloaded = true;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3_000);
  });
  expect(screen.getByText("Apple Speech is ready")).toBeTruthy();

  const pollsWhenReady = mocks.isModelDownloaded.mock.calls.length;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000);
  });

  expect(screen.queryByText("Try again")).toBeNull();
  expect(mocks.isModelDownloaded.mock.calls.length).toBe(pollsWhenReady);
  expect(mocks.downloadModel).toHaveBeenCalledTimes(1);
});

it("still offers Try again when a download stalls", async () => {
  render(<TranscriptionSetupSection onContinue={() => {}} />);
  for (let i = 0; i < 17; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
  }
  expect(screen.getByText("Try again")).toBeTruthy();
});

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

it("says you're offline when the download fails for lack of a network", async () => {
  mocks.downloadModel.mockResolvedValue({
    status: "error",
    error: "error sending request: dns error",
  });
  render(<TranscriptionSetupSection onContinue={() => {}} />);
  await settle();

  expect(
    screen.getByText(
      "You're offline. Connect to the internet, then click Try again.",
    ),
  ).toBeTruthy();
  expect(screen.getByText("Try again")).toBeTruthy();
});

it("shows the reason in a small line for other failures", async () => {
  mocks.downloadModel.mockResolvedValue({
    status: "error",
    error: "Checksum mismatch",
  });
  render(<TranscriptionSetupSection onContinue={() => {}} />);
  await settle();

  const reason = screen.getByText("Checksum mismatch");
  expect(reason.className).toContain("text-xs");
  expect(reason.className).toContain("text-muted-foreground");
});

it("explains when this Mac has no on-device engine", async () => {
  mocks.listSupportedModels.mockResolvedValue({ status: "ok", data: [] });
  render(<TranscriptionSetupSection onContinue={() => {}} />);
  await settle();

  expect(
    screen.getByText("No on-device engine is available on this Mac."),
  ).toBeTruthy();
});

it("shows the download size while downloading", async () => {
  mocks.listSupportedModels.mockResolvedValue({
    status: "ok",
    data: [{ key: "soniqo-parakeet-streaming", size_bytes: 640_000_000 }],
  });
  render(<TranscriptionSetupSection onContinue={() => {}} />);
  await settle();

  expect(screen.getByText("Downloading Parakeet (about 640 MB)…")).toBeTruthy();
});

it("formats sizes and spots network failures", () => {
  expect(formatDownloadSize(null)).toBeNull();
  expect(formatDownloadSize(1_600_000_000)).toBe("1.6 GB");
  expect(isOfflineFailure("Checksum mismatch", true)).toBe(false);
  expect(isOfflineFailure("Checksum mismatch", false)).toBe(true);
  expect(isOfflineFailure("connection reset", true)).toBe(true);
});
