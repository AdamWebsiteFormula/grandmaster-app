import { cn } from "@anlg/utils";

import {
  LIVE_TRANSCRIPT_INTERRUPTED_MESSAGE,
  LIVE_TRANSCRIPT_INTERRUPTED_TITLE,
} from "~/stt/live-transcript-interrupted";

export function LiveTranscriptInterruptedNotice({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn([
        "flex flex-col items-center justify-center gap-1 px-6 text-center text-red-500 dark:text-red-400",
        className,
      ])}
    >
      <p className="text-sm font-medium">{LIVE_TRANSCRIPT_INTERRUPTED_TITLE}</p>
      <p className="max-w-md text-sm leading-relaxed">
        {LIVE_TRANSCRIPT_INTERRUPTED_MESSAGE}
      </p>
    </div>
  );
}
