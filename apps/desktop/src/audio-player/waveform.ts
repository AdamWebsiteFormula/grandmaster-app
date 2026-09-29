import type WaveSurfer from "wavesurfer.js";

import { commands as fsSyncCommands } from "@anlg/plugin-fs-sync";

export interface WaveformPeaks {
  duration: number;
  channels: number[][];
}

interface LoadWaveformOptions {
  url: string;
  sessionId: string;
  signal: AbortSignal;
  fetchAudio?: typeof fetch;
  loadPeaks?: (sessionId: string) => Promise<WaveformPeaks | null>;
}

export async function loadSessionPeaks(
  sessionId: string,
): Promise<WaveformPeaks | null> {
  try {
    const result = await fsSyncCommands.audioPeaks(sessionId);
    return result.status === "ok" ? result.data : null;
  } catch {
    return null;
  }
}

export function isUsablePeaks(
  peaks: WaveformPeaks | null,
): peaks is WaveformPeaks {
  return (
    peaks !== null &&
    Number.isFinite(peaks.duration) &&
    peaks.duration > 0 &&
    (peaks.channels[0]?.length ?? 0) > 0
  );
}

// Plays the recording from a blob like wavesurfer's own `load(url)`, but draws
// the waveform from peaks computed natively so the webview never decodes it.
// Without usable peaks, wavesurfer decodes the blob itself as before.
export async function loadWaveform(
  ws: Pick<WaveSurfer, "loadBlob">,
  {
    url,
    sessionId,
    signal,
    fetchAudio = fetch,
    loadPeaks = loadSessionPeaks,
  }: LoadWaveformOptions,
): Promise<void> {
  const [peaks, blob] = await Promise.all([
    loadPeaks(sessionId),
    fetchAudio(url, { signal }).then((response) => {
      if (response.status >= 400) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`);
      }
      return response.blob();
    }),
  ]);

  if (signal.aborted) {
    return;
  }

  if (isUsablePeaks(peaks)) {
    await ws.loadBlob(blob, peaks.channels, peaks.duration);
    return;
  }

  await ws.loadBlob(blob);
}
