import { Trans, useLingui } from "@lingui/react/macro";
import { arch, platform } from "@tauri-apps/plugin-os";
import { useEffect, useRef, useState } from "react";

import {
  commands as localSttCommands,
  events as localSttEvents,
  type LocalModel,
} from "@anlg/plugin-local-stt";

import { OnboardingButton, StepRow } from "./shared";

import { setSettingValues } from "~/settings/queries";
import { useConfigValue } from "~/shared/config";
import {
  isOnDeviceSttModel,
  isUpshotCloudSttAvailable,
} from "~/stt/capabilities";

// Fork (Granola standard: transcription works with zero setup). Upshot
// transcription is ready at once; an on-device engine picked before is
// downloaded here with progress. Never block: the download keeps going if
// the user continues.
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
  | { kind: "failed"; reason: string | null };

// Fork: say why setup failed, so offline and server errors don't look the
// same (NN/g #9, WCAG 3.3.1; journey-first-run P2).
const NETWORK_ERROR_PATTERN =
  /network|offline|internet|connection|timed? ?out|dns|resolve|unreachable|socket|request failed/i;

export function isOfflineFailure(
  reason: string | null,
  online = typeof navigator === "undefined" ? true : navigator.onLine,
): boolean {
  return !online || (reason !== null && NETWORK_ERROR_PATTERN.test(reason));
}

// Fork: show the download size, so a slow network can be judged (NN/g #1;
// Apple HIG Progress indicators; journey-first-run P3).
export function formatDownloadSize(bytes: number | null | undefined) {
  if (!bytes || bytes <= 0) return null;
  const mb = bytes / 1_000_000;
  if (mb >= 1_000) return `${(mb / 1_000).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(mb))} MB`;
}

export function pickTranscriptionModel(keys: string[]): Choice | null {
  if (keys.includes(APPLE_SPEECH.model)) return APPLE_SPEECH;
  if (keys.includes(PARAKEET.model)) return PARAKEET;
  return null;
}

export function TranscriptionSetupSection({
  onContinue,
}: {
  // Fork: reports whether setup failed, so the step says "skipped".
  onContinue: (failed?: boolean, downloading?: boolean) => void;
}) {
  const { t } = useLingui();
  const currentProvider = useConfigValue("current_stt_provider");
  const currentModel = useConfigValue("current_stt_model");
  const [choice, setChoice] = useState<Choice | null>(null);
  const [sizeLabel, setSizeLabel] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });
  const [stalled, setStalled] = useState(false);
  // Fork: Upshot transcription is the default on every computer (no
  // download, account or key), as in Granola (granola.ai/security).
  const [usesCloud, setUsesCloud] = useState(false);
  const startedRef = useRef(false);
  const lastProgressRef = useRef(Date.now());
  const isReady = phase.kind === "ready";

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      // Fork: Upshot transcription first on every computer (owner decision
      // Oct 3). An on-device engine picked before (re-onboarding) keeps its
      // download path below.
      if (
        !isOnDeviceSttModel(currentProvider, currentModel) &&
        isUpshotCloudSttAvailable(platform(), arch())
      ) {
        if (!currentProvider) {
          await setSettingValues({
            current_stt_provider: "anarlog",
            current_stt_model: "cloud",
          });
        }
        setUsesCloud(true);
        setPhase({ kind: "ready" });
        return;
      }

      const supported = await localSttCommands.listSupportedModels();
      const picked =
        supported.status === "ok"
          ? pickTranscriptionModel(supported.data.map((m) => m.key))
          : null;
      if (!picked) {
        // Fork: the saved on-device engine can't run here, so switch to
        // Upshot transcription instead of a dead end (NN/g #9).
        if (isUpshotCloudSttAvailable(platform(), arch())) {
          await setSettingValues({
            current_stt_provider: "anarlog",
            current_stt_model: "cloud",
          });
          setUsesCloud(true);
          setPhase({ kind: "ready" });
          return;
        }
        // null: the no-engine case, shown with its own translated line.
        setPhase({ kind: "failed", reason: null });
        return;
      }
      setChoice(picked);
      if (supported.status === "ok") {
        setSizeLabel(
          formatDownloadSize(
            supported.data.find((m) => m.key === picked.model)?.size_bytes,
          ),
        );
      }

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
    // Runs once on mount; the saved engine is read at that moment on purpose.
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

  const name =
    choice?.name ??
    (usesCloud ? t`Upshot transcription` : t`on-device transcription`);
  const failureDetail =
    phase.kind !== "failed"
      ? null
      : isOfflineFailure(phase.reason)
        ? t`You're offline. Connect to the internet, then click Try again.`
        : phase.reason === null
          ? t`No on-device engine is available on this Mac.`
          : phase.reason;
  const stalledOffline =
    stalled && phase.kind === "downloading" && isOfflineFailure(null);

  return (
    <div className="flex flex-col gap-4">
      {phase.kind === "checking" && (
        <StepRow status="active" label={<Trans>Checking this Mac…</Trans>} />
      )}
      {phase.kind === "downloading" && (
        <StepRow
          status="active"
          label={
            sizeLabel === null ? (
              phase.percent === null ? (
                <Trans>Downloading {name}…</Trans>
              ) : (
                <Trans>
                  Downloading {name}… {Math.round(phase.percent)}%
                </Trans>
              )
            ) : phase.percent === null ? (
              <Trans>
                Downloading {name} (about {sizeLabel})…
              </Trans>
            ) : (
              <Trans>
                Downloading {name} (about {sizeLabel})…{" "}
                {Math.round(phase.percent)}%
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
      {failureDetail && (
        <p className="text-muted-foreground text-xs" role="alert">
          {failureDetail}
        </p>
      )}
      {stalledOffline && (
        <p className="text-muted-foreground text-xs" role="status">
          {t`You're offline. Connect to the internet, then click Try again.`}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {/* Fork: also report a download still running, so the step title
            doesn't claim setup is done (NN/g #1). */}
        <OnboardingButton
          onClick={() =>
            onContinue(phase.kind === "failed", phase.kind === "downloading")
          }
        >
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
      {usesCloud && (
        <p className="text-muted-foreground text-sm">
          <Trans>
            Audio streams through Upshot to Deepgram for transcription. Nothing
            is stored.
          </Trans>
        </p>
      )}
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
