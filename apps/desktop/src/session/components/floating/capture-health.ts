import { useEffect, useRef, useState } from "react";

import type { PermissionStatus } from "@anlg/plugin-permissions";

// Fork (F2 capture health): pure rules for the You/Them meters and the
// "can't hear the other side" warning. Amplitude comes from live.amplitude,
// already scaled to 0..1, where normal speech sits around 0.02 to 0.2.

// Below this, system audio counts as silent. A denied permission yields
// digital zeros, so the bar is low on purpose.
export const THEM_SILENCE_THRESHOLD = 0.005;
export const THEM_SILENCE_MS = 10_000;
export const CAPTURE_HEALTH_TICK_MS = 1_000;

export type ThemSilence = {
  // When the current silent stretch began; null while Them is audible.
  silentSince: number | null;
  // Whether Them has been heard at all since recording started.
  heardThem: boolean;
};

export type CaptureHealthNotice = "none" | "permission" | "quiet";

export const startThemSilence = (now: number): ThemSilence => ({
  silentSince: now,
  heardThem: false,
});

export const trackThemSilence = (
  state: ThemSilence,
  speaker: number,
  now: number,
): ThemSilence => {
  if (speaker >= THEM_SILENCE_THRESHOLD) {
    return state.silentSince === null && state.heardThem
      ? state
      : { silentSince: null, heardThem: true };
  }

  return state.silentSince === null ? { ...state, silentSince: now } : state;
};

// Hard warning only when the permission is not confirmed: silence alone can
// just mean nobody on the other side is talking. With permission granted, a
// soft hint shows once, before Them has ever been heard.
export const getCaptureHealthNotice = (
  state: ThemSilence,
  now: number,
  systemAudio: PermissionStatus | undefined,
): CaptureHealthNotice => {
  if (state.silentSince === null || now - state.silentSince < THEM_SILENCE_MS) {
    return "none";
  }

  if (systemAudio !== "authorized") {
    return "permission";
  }

  return state.heardThem ? "none" : "quiet";
};

// Square root gives the meter gain: 0.02 reads as a third, 0.2 and up as full.
export const meterLevel = (amplitude: number): number =>
  Math.min(1, Math.sqrt(Math.max(0, amplitude) / 0.2));

export function useCaptureHealthNotice(
  speaker: number,
  systemAudio: PermissionStatus | undefined,
): CaptureHealthNotice {
  const [clock, setClock] = useState(() => {
    const now = Date.now();
    return { now, silence: startThemSilence(now) };
  });

  // Amplitude arrives at 10 Hz and the tick runs at 1 Hz, so keep the loudest
  // value between ticks; a short reply from Them must still count.
  const peakRef = useRef(speaker);
  useEffect(() => {
    peakRef.current = Math.max(peakRef.current, speaker);
  }, [speaker]);

  const speakerRef = useRef(speaker);
  speakerRef.current = speaker;

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const peak = peakRef.current;
      peakRef.current = speakerRef.current;
      setClock((prev) => ({
        now,
        silence: trackThemSilence(prev.silence, peak, now),
      }));
    }, CAPTURE_HEALTH_TICK_MS);

    return () => clearInterval(id);
  }, []);

  return getCaptureHealthNotice(clock.silence, clock.now, systemAudio);
}
