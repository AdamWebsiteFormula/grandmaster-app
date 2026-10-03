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

import { TranscriptionSetupSection } from "./transcription";

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
