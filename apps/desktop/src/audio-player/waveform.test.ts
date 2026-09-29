import { describe, expect, it, vi } from "vitest";

vi.mock("@anlg/plugin-fs-sync", () => ({
  commands: { audioPeaks: vi.fn() },
}));

import { isUsablePeaks, loadWaveform, type WaveformPeaks } from "./waveform";

const peaks: WaveformPeaks = {
  duration: 12.5,
  channels: [
    [0.1, 0.4],
    [0.2, 0.3],
  ],
};

function setup(loadedPeaks: WaveformPeaks | null, status = 200) {
  const blob = new Blob(["audio"], { type: "audio/mpeg" });
  const ws = { loadBlob: vi.fn().mockResolvedValue(undefined) };
  const fetchAudio = vi.fn().mockResolvedValue({
    status,
    blob: () => Promise.resolve(blob),
  });
  const loadPeaks = vi.fn().mockResolvedValue(loadedPeaks);
  return { blob, ws, fetchAudio, loadPeaks };
}

describe("loadWaveform", () => {
  it("draws native peaks without letting wavesurfer decode the audio", async () => {
    const { blob, ws, fetchAudio, loadPeaks } = setup(peaks);
    const controller = new AbortController();

    await loadWaveform(ws, {
      url: "asset://audio.mp3",
      sessionId: "session",
      signal: controller.signal,
      fetchAudio,
      loadPeaks,
    });

    expect(loadPeaks).toHaveBeenCalledWith("session");
    expect(fetchAudio).toHaveBeenCalledWith("asset://audio.mp3", {
      signal: controller.signal,
    });
    expect(ws.loadBlob).toHaveBeenCalledWith(blob, peaks.channels, 12.5);
  });

  it("falls back to wavesurfer decoding when peaks are unavailable", async () => {
    const { blob, ws, fetchAudio, loadPeaks } = setup(null);

    await loadWaveform(ws, {
      url: "asset://audio.mp3",
      sessionId: "session",
      signal: new AbortController().signal,
      fetchAudio,
      loadPeaks,
    });

    expect(ws.loadBlob).toHaveBeenCalledWith(blob);
  });

  it("does not load after the player was torn down", async () => {
    const { ws, fetchAudio, loadPeaks } = setup(peaks);
    const controller = new AbortController();
    const loading = loadWaveform(ws, {
      url: "asset://audio.mp3",
      sessionId: "session",
      signal: controller.signal,
      fetchAudio,
      loadPeaks,
    });
    controller.abort();
    await loading;

    expect(ws.loadBlob).not.toHaveBeenCalled();
  });

  it("rejects when the recording cannot be fetched", async () => {
    const { ws, fetchAudio, loadPeaks } = setup(peaks, 404);

    await expect(
      loadWaveform(ws, {
        url: "asset://audio.mp3",
        sessionId: "session",
        signal: new AbortController().signal,
        fetchAudio,
        loadPeaks,
      }),
    ).rejects.toThrow("404");
    expect(ws.loadBlob).not.toHaveBeenCalled();
  });
});

describe("isUsablePeaks", () => {
  it("rejects empty or durationless peaks", () => {
    expect(isUsablePeaks(peaks)).toBe(true);
    expect(isUsablePeaks(null)).toBe(false);
    expect(isUsablePeaks({ duration: 0, channels: [[0.1]] })).toBe(false);
    expect(isUsablePeaks({ duration: 1, channels: [] })).toBe(false);
    expect(isUsablePeaks({ duration: 1, channels: [[]] })).toBe(false);
  });
});
