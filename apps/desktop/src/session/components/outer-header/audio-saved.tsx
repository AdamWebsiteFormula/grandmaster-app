import { useLingui } from "@lingui/react/macro";

import { HardDrive } from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@anlg/ui/components/ui/tooltip";

import {
  normalizeAudioRetention,
  type AudioRetentionPolicy,
} from "~/services/audio-retention-policy";
import { useConfigValue } from "~/shared/config";
import { useTabs } from "~/store/zustand/tabs";

// Fork: Granola deletes audio after transcription; we keep it, so say so.
// An icon with the sentence as its tooltip keeps the note header light.
export function AudioSavedLine() {
  const { t } = useLingui();
  const openNew = useTabs((state) => state.openNew);
  const retention = normalizeAudioRetention(useConfigValue("audio_retention"));
  const keptFor: Record<AudioRetentionPolicy, string> = {
    none: t`until transcribed`,
    oneDay: t`for 1 day`,
    threeDays: t`for 3 days`,
    oneWeek: t`for 1 week`,
    oneMonth: t`for 1 month`,
    forever: t`forever`,
  };
  const kept = keptFor[retention];

  const label = t`Audio saved on this Mac · kept ${kept}`;

  // Own provider so the header renders anywhere, including tests.
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            data-audio-saved-line
            data-tauri-drag-region="false"
            aria-label={label}
            onClick={() =>
              openNew({ type: "settings", state: { tab: "meetings" } })
            }
            className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-full [&_svg]:size-4"
          >
            <HardDrive className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
