import { useLingui } from "@lingui/react/macro";

import { Waveform } from "@anlg/ui/components/icons";
import { Spinner } from "@anlg/ui/components/ui/spinner";

export function TranscriptListeningState({
  status,
}: {
  status: "listening" | "finalizing";
}) {
  const { t } = useLingui();
  const isFinalizing = status === "finalizing";

  return (
    <div
      role="status"
      className="flex h-full min-h-[400px] flex-col items-center justify-center px-6 text-center"
    >
      {isFinalizing ? (
        <div className="text-muted-foreground mb-5">
          <Spinner size={36} />
        </div>
      ) : (
        <Waveform
          aria-hidden
          className="text-muted-foreground mb-5 size-9 stroke-[1.5]"
        />
      )}
      <div className="flex max-w-md flex-col gap-2">
        <p className="text-base font-medium">
          {/* Fork: plain words, no "first segment" jargon (ux-audit-oct3 C, NN/g #2). */}
          {isFinalizing ? t`Finishing transcript…` : t`Listening…`}
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {isFinalizing
            ? t`Transcript is still being written.`
            : t`Words appear here as people talk.`}
        </p>
      </div>
    </div>
  );
}
