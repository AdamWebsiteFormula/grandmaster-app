import { Trans } from "@lingui/react/macro";
import { useEffect, useRef, useState } from "react";

import {
  commands as localSttCommands,
  events as localSttEvents,
  type LocalModel,
} from "@anlg/plugin-local-stt";

import { OnboardingButton, StepRow } from "./shared";

import { setSettingValues } from "~/settings/queries";
import { useConfigValue } from "~/shared/config";

// Fork (Granola standard: transcription works with zero setup). Pick the best
// on-device engine for this Mac, select it, and download it here with
// progress. Never block: the download keeps going if the user continues.
type Choice = { provider: string; model: LocalModel; name: string };

const APPLE_SPEECH: Choice = {
  provider: "apple_speech",
  model: "apple-speech",
  name: "Apple Speech",
};
const PARAKEET: Choice = {
  provider: "soniqo",
  model: "soniqo-parakeet-streaming",
  name: "Parakeet",
};

const STALL_MS = 45_000;
const POLL_MS = 3_000;

type Phase =
  | { kind: "checking" }
  | { kind: "downloading"; percent: number | null }
  | { kind: "ready" }
  | { kind: "failed"; reason: string };

export function pickTranscriptionModel(keys: string[]): Choice | null {
  if (keys.includes(APPLE_SPEECH.model)) return APPLE_SPEECH;
  if (keys.includes(PARAKEET.model)) return PARAKEET;
  return null;
}

export function TranscriptionSetupSection({
  onContinue,
}: {
  // Fork: reports whether setup failed, so the step says "skipped".
  onContinue: (failed?: boolean) => void;
}) {
  const currentProvider = useConfigValue("current_stt_provider");
  const [choice, setChoice] = useState<Choice | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });
  const [stalled, setStalled] = useState(false);
  const startedRef = useRef(false);
  const lastProgressRef = useRef(Date.now());
  const isReady = phase.kind === "ready";

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      const supported = await localSttCommands.listSupportedModels();
      const picked =
        supported.status === "ok"
          ? pickTranscriptionModel(supported.data.map((m) => m.key))
          : null;
      if (!picked) {
        setPhase({
          kind: "failed",
          reason: "No on-device engine is available on this Mac.",
        });
        return;
      }
      setChoice(picked);

      // Respect a provider the user already chose (for example, re-onboarding).
      if (!currentProvider) {
        await setSettingValues({
          current_stt_provider: picked.provider,
          current_stt_model: picked.model,
        });
      }

      const downloaded = await localSttCommands.isModelDownloaded(picked.model);
      if (downloaded.status === "ok" && downloaded.data) {
        setPhase({ kind: "ready" });
        return;
      }
      await startDownload(picked.model);
    })();
    // Runs once on mount; currentProvider is read at that moment on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startDownload = async (model: LocalModel) => {
    lastProgressRef.current = Date.now();
    setStalled(false);
    setPhase({ kind: "downloading", percent: null });
    const result = await localSttCommands.downloadModel(model);
    if (result.status === "error") {
      setPhase({ kind: "failed", reason: result.error });
    }
  };

  // Progress events, plus a poll as a backstop: Apple Speech installs through
  // macOS and does not always report progress.
  // Fork: once the engine is ready, stop polling and the stall timer, so
  // "Try again" never shows next to "is ready" (it would re-download).
  useEffect(() => {
    if (!choice || isReady) return;
    const unlisten = localSttEvents.downloadProgressPayload.listen((event) => {
      const { model, status } = event.payload;
      if (model !== choice.model) return;
      lastProgressRef.current = Date.now();
      if (status === "completed") {
        setPhase({ kind: "ready" });
      } else if (typeof status === "object" && "failed" in status) {
        setPhase({ kind: "failed", reason: status.failed });
      } else if (typeof status === "object" && "downloading" in status) {
        setPhase({
          kind: "downloading",
          percent: Math.max(0, Math.min(100, status.downloading)),
        });
      }
    });
    const timer = setInterval(() => {
      void localSttCommands.isModelDownloaded(choice.model).then((r) => {
        if (r.status === "ok" && r.data) setPhase({ kind: "ready" });
      });
      if (Date.now() - lastProgressRef.current > STALL_MS) setStalled(true);
    }, POLL_MS);
    return () => {
      clearInterval(timer);
      void unlisten.then((fn) => fn());
    };
  }, [choice, isReady]);

  const retry = async () => {
    if (!choice) return;
    await localSttCommands.cancelDownload(choice.model);
    await startDownload(choice.model);
  };

  const name = choice?.name ?? "on-device transcription";

  return (
    <div className="flex flex-col gap-4">
      {phase.kind === "checking" && (
        <StepRow status="active" label={<Trans>Checking this Mac…</Trans>} />
      )}
      {phase.kind === "downloading" && (
        <StepRow
          status="active"
          label={
            phase.percent === null ? (
              <Trans>Downloading {name}…</Trans>
            ) : (
              <Trans>
                Downloading {name}… {Math.round(phase.percent)}%
              </Trans>
            )
          }
        />
      )}
      {phase.kind === "ready" && (
        <StepRow status="done" label={<Trans>{name} is ready</Trans>} />
      )}
      {phase.kind === "failed" && (
        <StepRow
          status="failed"
          label={
            <Trans>
              Couldn’t set up {name}. You can pick an engine later in Settings ›
              Transcription.
            </Trans>
          }
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <OnboardingButton onClick={() => onContinue(phase.kind === "failed")}>
          <Trans>Continue</Trans>
        </OnboardingButton>
        {((stalled && phase.kind === "downloading") ||
          phase.kind === "failed") &&
          choice && (
            <OnboardingButton variant="secondary" onClick={() => void retry()}>
              <Trans>Try again</Trans>
            </OnboardingButton>
          )}
      </div>
      {phase.kind === "downloading" && (
        <p className="text-muted-foreground text-sm">
          <Trans>
            Transcription runs on your Mac. The download keeps going if you
            continue.
          </Trans>
        </p>
      )}
    </div>
  );
}
