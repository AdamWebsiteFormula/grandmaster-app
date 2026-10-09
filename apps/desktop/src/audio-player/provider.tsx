import { t } from "@lingui/core/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import WaveSurfer from "wavesurfer.js";

import { toast } from "@anlg/ui/components/ui/toast";
import { commands as fsSyncCommands } from "@anlg/plugin-fs-sync";
import type { SessionAudioRetentionEvent } from "@anlg/plugin-transcription";
import { useMountEffect } from "@anlg/ui/hooks/use-mount-effect";

import { useDeleteRecordingConfirm } from "./delete-recording-confirm";
import { configureCenteredPlayback } from "./playback";
import { loadWaveform } from "./waveform";

import { useBillingAccess } from "~/auth/billing-context";
import {
  isSessionAudioIdle,
  subscribeToSessionAudioRetention,
} from "~/services/audio-retention";
import { deleteSessionAudio } from "~/session/attachments";

const TIME_UPDATE_STEP_SECONDS = 0.1;

type AudioPlayerState = "playing" | "paused" | "stopped";

interface TimeSnapshot {
  current: number;
  total: number;
}

class TimeStore {
  private snapshot: TimeSnapshot = { current: 0, total: 0 };
  private listeners = new Set<() => void>();

  getSnapshot = (): TimeSnapshot => {
    return this.snapshot;
  };

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };

  setCurrent(value: number) {
    if (value === this.snapshot.current) return;
    this.snapshot = { ...this.snapshot, current: value };
    this.notify();
  }

  setTotal(value: number) {
    if (value === this.snapshot.total) return;
    this.snapshot = { ...this.snapshot, total: value };
    this.notify();
  }

  reset() {
    this.snapshot = { current: 0, total: 0 };
    this.notify();
  }

  private notify() {
    for (const cb of this.listeners) {
      cb();
    }
  }
}

interface AudioPlayerContextValue {
  registerContainer: (el: HTMLDivElement | null) => void;
  wavesurfer: WaveSurfer | null;
  state: AudioPlayerState;
  timeStore: TimeStore;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seek: (sec: number) => void;
  audioExists: boolean;
  audioExistsResolved: boolean;
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
  deleteRecording: () => Promise<void>;
  /** Fork: asks first, then runs deleteRecording and toasts on failure. */
  requestDeleteRecording: () => void;
  isDeletingRecording: boolean;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

// Fork: the waveform follows the theme. Unplayed bars use the secondary text
// gray and the played part the main text color; the fixed #3a3a3a measured
// 1.69:1 on the dark player (picture review, Oct 6; WCAG 2.2 SC 1.4.11).
function waveformColors() {
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => {
    const value = styles.getPropertyValue(name).trim();
    return value ? `hsl(${value})` : fallback;
  };
  const wave = token("--muted-foreground", "#8a8a8a");
  const progress = token("--foreground", "#171717");
  return {
    waveColor: wave,
    progressColor: progress,
    cursorColor: progress,
    splitChannels: [
      { waveColor: wave, progressColor: progress, overlay: true },
      { waveColor: wave, progressColor: progress, overlay: true },
    ],
  };
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
  }
  return context;
}

export function useAudioTime(): TimeSnapshot {
  const { timeStore } = useAudioPlayer();
  return useSyncExternalStore(timeStore.subscribe, timeStore.getSnapshot);
}

function useAudioExistence(sessionId: string) {
  const audioExists = useQuery({
    queryKey: ["audio", sessionId, "exist"],
    queryFn: () => fsSyncCommands.audioExist(sessionId),
    // Fork: check again every second until the recording is on disk, so the
    // player shows about a second after Stop instead of up to a minute
    // later (owner test, Oct 4; NN/g heuristic #1). A local file check.
    refetchInterval: (query) =>
      query.state.data?.status === "ok" && query.state.data.data ? false : 1000,
    select: (result) => {
      if (result.status === "error") {
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  return {
    audioExists: audioExists.data ?? false,
    audioExistsResolved: audioExists.isSuccess,
  };
}

export function useAudioExists(sessionId: string): boolean {
  return useAudioExistence(sessionId).audioExists;
}

export function AudioPlayerProvider({
  sessionId,
  url,
  children,
}: {
  sessionId: string;
  url: string;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const { isPro } = useBillingAccess();
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [wavesurfer, setWavesurfer] = useState<WaveSurfer | null>(null);
  const [state, setState] = useState<AudioPlayerState>("stopped");
  const [playbackRate, setPlaybackRateState] = useState(1);
  const timeStoreRef = useRef(new TimeStore());
  const stopRequestedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const { audioExists: audioExistsValue, audioExistsResolved } =
    useAudioExistence(sessionId);

  const registerContainer = useCallback((el: HTMLDivElement | null) => {
    setContainer((prev) => (prev === el ? prev : el));
  }, []);

  useEffect(() => {
    if (!container || !url) {
      return;
    }

    const store = timeStoreRef.current;
    store.reset();
    stopRequestedRef.current = false;

    let lastReportedTime = 0;

    const media = new Audio();
    media.crossOrigin = "anonymous";
    media.preload = "metadata";

    const ws = WaveSurfer.create({
      container,
      media,
      height: 24,
      ...waveformColors(),
      cursorWidth: 2,
      barWidth: 3,
      barGap: 2,
      barRadius: 2,
      barHeight: 1,
      dragToSeek: true,
      normalize: true,
    });
    // The canvas cannot read CSS variables, so repaint on a theme switch.
    const themeObserver = new MutationObserver(() => {
      ws.setOptions(waveformColors());
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });
    const audioContext = configureCenteredPlayback(media);
    audioContextRef.current = audioContext;

    const syncCurrentTime = (currentTime: number, force = false) => {
      if (
        !force &&
        Math.abs(currentTime - lastReportedTime) < TIME_UPDATE_STEP_SECONDS
      ) {
        return;
      }

      lastReportedTime = currentTime;
      store.setCurrent(currentTime);
    };

    const handleReady = (dur: number) => {
      if (dur && isFinite(dur)) {
        store.setTotal(dur);
      }
    };

    const handlePlay = () => {
      stopRequestedRef.current = false;
      syncCurrentTime(ws.getCurrentTime(), true);
      setState("playing");
    };

    const handlePause = () => {
      const currentTime = ws.getCurrentTime();
      syncCurrentTime(currentTime, true);

      if (stopRequestedRef.current) {
        stopRequestedRef.current = false;
        setState("stopped");
        return;
      }

      setState("paused");
    };

    const handleFinish = () => {
      stopRequestedRef.current = false;
      syncCurrentTime(ws.getDuration(), true);
      setState("stopped");
    };

    const handleTimeupdate = (currentTime: number) => {
      syncCurrentTime(currentTime);
    };

    const handleInteraction = (currentTime: number) => {
      syncCurrentTime(currentTime, true);
    };

    const handleDecode = (dur: number) => {
      if (dur && isFinite(dur)) {
        store.setTotal(dur);
      }
    };

    const handleDestroy = () => {
      stopRequestedRef.current = false;
      setState("stopped");
    };

    ws.on("decode", handleDecode);
    ws.on("play", handlePlay);
    ws.on("pause", handlePause);
    ws.on("finish", handleFinish);
    ws.on("ready", handleReady);
    ws.on("timeupdate", handleTimeupdate);
    ws.on("interaction", handleInteraction);
    ws.on("destroy", handleDestroy);

    setWavesurfer(ws);

    const loadController = new AbortController();
    void loadWaveform(ws, {
      url,
      sessionId,
      signal: loadController.signal,
    }).catch(() => {});

    return () => {
      themeObserver.disconnect();
      loadController.abort();
      stopRequestedRef.current = false;
      if (audioContextRef.current === audioContext) {
        audioContextRef.current = null;
      }
      const mediaSrc = media.currentSrc || media.src;
      media.pause();
      ws.destroy();
      if (mediaSrc.startsWith("blob:")) {
        URL.revokeObjectURL(mediaSrc);
      }
      media.removeAttribute("src");
      media.load();
      setWavesurfer(null);
      void audioContext?.close();
    };
  }, [container, sessionId, url]);

  const play = useCallback(() => {
    if (!wavesurfer) {
      return;
    }

    // Fork: a recording that can't play says so; Play did nothing (task
    // test, Oct 9; NN/g #9).
    const playFailed = (error: unknown) => {
      console.error("[audio-player] failed to play", error);
      toast.error(t`Couldn't play this recording. Try again.`, {
        id: "audio-play-failed",
      });
    };

    const audioContext = audioContextRef.current;
    if (audioContext?.state === "suspended") {
      void audioContext
        .resume()
        .then(() => {
          if (audioContextRef.current === audioContext) {
            return wavesurfer.play();
          }
        })
        .catch(playFailed);
      return;
    }

    void wavesurfer.play().catch(playFailed);
  }, [wavesurfer]);

  const pause = useCallback(() => {
    if (wavesurfer) {
      wavesurfer.pause();
    }
  }, [wavesurfer]);

  const stop = useCallback(() => {
    if (wavesurfer) {
      const wasPlaying = wavesurfer.isPlaying();
      stopRequestedRef.current = wasPlaying;
      wavesurfer.stop();
      timeStoreRef.current.setCurrent(0);
      if (!wasPlaying) {
        setState("stopped");
      }
    }
  }, [wavesurfer]);

  const markAudioDeleted = useCallback(() => {
    timeStoreRef.current.reset();
    queryClient.setQueryData(["audio", sessionId, "exist"], {
      status: "ok",
      data: false,
    });
    queryClient.setQueryData(["audio", sessionId, "url"], {
      status: "error",
      error: "audio_path_not_found",
    });
    void queryClient.invalidateQueries({
      queryKey: ["audio", sessionId, "exist"],
    });
    void queryClient.invalidateQueries({
      queryKey: ["audio", sessionId, "url"],
    });
  }, [queryClient, sessionId]);
  const retentionHandlerRef = useRef(
    (_event: SessionAudioRetentionEvent) => {},
  );
  retentionHandlerRef.current = (event) => {
    if (event.session_id !== sessionId) {
      return;
    }
    stop();
    if (event.phase === "deleted") {
      markAudioDeleted();
    }
  };
  useMountEffect(() =>
    subscribeToSessionAudioRetention((event) =>
      retentionHandlerRef.current(event),
    ),
  );

  const seek = useCallback(
    (timeInSeconds: number) => {
      if (wavesurfer) {
        wavesurfer.setTime(timeInSeconds);
      }
    },
    [wavesurfer],
  );

  const setPlaybackRate = useCallback(
    (rate: number) => {
      if (!isPro && rate !== 1) {
        return;
      }
      if (wavesurfer) {
        wavesurfer.setPlaybackRate(rate, false);
      }
      setPlaybackRateState(rate);
    },
    [isPro, wavesurfer],
  );

  useEffect(() => {
    if (!wavesurfer) {
      return;
    }

    const nextRate = isPro ? playbackRate : 1;
    wavesurfer.setPlaybackRate(nextRate, false);

    if (nextRate !== playbackRate) {
      setPlaybackRateState(1);
    }
  }, [isPro, playbackRate, wavesurfer]);

  const deleteRecordingMutation = useMutation({
    mutationFn: async () => {
      stop();
      const deleted = await deleteSessionAudio(sessionId, () =>
        isSessionAudioIdle(sessionId),
      );
      if (!deleted) {
        throw new Error("audio_session_busy");
      }
    },
    onSuccess: markAudioDeleted,
  });

  // Fork: Delete recording asks first and reports failures (ux-audit-oct3 C;
  // HIG alerts, NN/g #5). The delete itself is unchanged.
  const { requestDeleteRecording, confirmDialog } = useDeleteRecordingConfirm({
    deleteRecording: deleteRecordingMutation.mutateAsync,
    isPending: deleteRecordingMutation.isPending,
  });

  const value = useMemo<AudioPlayerContextValue>(
    () => ({
      registerContainer,
      wavesurfer,
      state,
      timeStore: timeStoreRef.current,
      start: play,
      pause,
      resume: play,
      stop,
      seek,
      audioExists: audioExistsValue,
      audioExistsResolved,
      playbackRate,
      setPlaybackRate,
      deleteRecording: deleteRecordingMutation.mutateAsync,
      requestDeleteRecording,
      isDeletingRecording: deleteRecordingMutation.isPending,
    }),
    [
      registerContainer,
      wavesurfer,
      state,
      play,
      pause,
      stop,
      seek,
      audioExistsValue,
      audioExistsResolved,
      playbackRate,
      setPlaybackRate,
      deleteRecordingMutation.mutateAsync,
      requestDeleteRecording,
      deleteRecordingMutation.isPending,
    ],
  );

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
      {confirmDialog}
    </AudioPlayerContext.Provider>
  );
}
