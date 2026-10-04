import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listSupportedModels: vi.fn(),
  isModelDownloaded: vi.fn(),
  downloadModel: vi.fn(),
  cancelDownload: vi.fn(),
  listen: vi.fn(),
  setSettingValues: vi.fn(),
  os: { platform: "macos", arch: "aarch64" },
  // An on-device engine already picked (re-onboarding), so the download
  // path runs; a new profile has none and gets Upshot transcription.
  config: {
    current_stt_provider: "apple_speech",
    current_stt_model: "apple-speech",
  } as Record<string, string | undefined>,
}));

vi.mock("@tauri-apps/plugin-os", () => ({
  platform: () => mocks.os.platform,
  arch: () => mocks.os.arch,
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
// The step reads the saved engine from the database when it mounts.
vi.mock("~/settings/queries", () => ({
  setSettingValues: mocks.setSettingValues,
  getStoredSettingValues: async () => ({
    values: mocks.config,
    hasValues: new Set(Object.keys(mocks.config)),
  }),
}));

import {
  formatDownloadSize,
  isOfflineFailure,
  TranscriptionSetupSection,
} from "./transcription";

let downloaded = false;

beforeEach(() => {
  vi.useFakeTimers();
  downloaded = false;
  mocks.os.platform = "macos";
  mocks.os.arch = "aarch64";
  mocks.config = {
    current_stt_provider: "apple_speech",
    current_stt_model: "apple-speech",
  };
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

it("switches to Upshot transcription when the picked engine can't run here", async () => {
  mocks.listSupportedModels.mockResolvedValue({ status: "ok", data: [] });
  render(<TranscriptionSetupSection onContinue={() => {}} />);
  await settle();

  expect(screen.getByText("Upshot transcription is ready")).toBeTruthy();
  expect(mocks.setSettingValues).toHaveBeenCalledWith({
    current_stt_provider: "anarlog",
    current_stt_model: "cloud",
  });
});

it.each([
  ["macos", "aarch64"],
  ["macos", "x86_64"],
  ["windows", "x86_64"],
  ["linux", "x86_64"],
])(
  "starts a new profile on Upshot transcription on %s/%s",
  async (platform, arch) => {
    mocks.os.platform = platform;
    mocks.os.arch = arch;
    mocks.config = {};
    render(<TranscriptionSetupSection onContinue={() => {}} />);
    await settle();

    expect(screen.getByText("Upshot transcription is ready")).toBeTruthy();
    expect(mocks.setSettingValues).toHaveBeenCalledWith({
      current_stt_provider: "anarlog",
      current_stt_model: "cloud",
    });
    expect(mocks.listSupportedModels).not.toHaveBeenCalled();
    expect(mocks.downloadModel).not.toHaveBeenCalled();
  },
);

it.each([
  ["windows", "x86_64"],
  ["linux", "x86_64"],
  ["macos", "x86_64"],
])(
  "uses Upshot transcription with no download on %s/%s",
  async (platform, arch) => {
    mocks.os.platform = platform;
    mocks.os.arch = arch;
    mocks.listSupportedModels.mockResolvedValue({ status: "ok", data: [] });
    render(<TranscriptionSetupSection onContinue={() => {}} />);
    await settle();

    expect(screen.getByText("Upshot transcription is ready")).toBeTruthy();
    expect(
      screen.getByText(
        "Audio streams through Upshot to Deepgram for transcription. Neither keeps your audio.",
      ),
    ).toBeTruthy();
    expect(mocks.downloadModel).not.toHaveBeenCalled();
  },
);

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
