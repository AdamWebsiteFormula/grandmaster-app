import { useLingui } from "@lingui/react/macro";

import { HardDrive } from "@anlg/ui/components/icons";
import { DropdownMenuItem } from "@anlg/ui/components/ui/dropdown-menu";

import {
  normalizeAudioRetention,
  type AudioRetentionPolicy,
} from "~/services/audio-retention-policy";
import { useConfigValue } from "~/shared/config";
import { isMac } from "~/shared/shortcut-label";
import { useTabs } from "~/store/zustand/tabs";

// Fork: Granola deletes audio after transcription; we keep it, so say so.
// It lives in the ⋯ Recording menu as a labeled row, not as an unlabeled
// header icon (redline-oct3, H2; Apple HIG, Menus: every item has a title).
export function useAudioSavedLabel() {
  const { t } = useLingui();
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

  // Fork: "this computer" off a Mac (NN/g heuristic #2, the user's words).
  return isMac()
    ? t`Audio saved on this Mac · kept ${kept}`
    : t`Audio saved on this computer · kept ${kept}`;
}

export function AudioSavedMenuItem({ onSelect }: { onSelect?: () => void }) {
  const openNew = useTabs((state) => state.openNew);
  const label = useAudioSavedLabel();

  return (
    <DropdownMenuItem
      data-audio-saved-line
      onClick={() => {
        onSelect?.();
        openNew({ type: "settings", state: { tab: "meetings" } });
      }}
      className="cursor-pointer items-start"
    >
      <HardDrive className="mt-0.5" />
      <span className="text-muted-foreground text-xs leading-snug">
        {label}
      </span>
    </DropdownMenuItem>
  );
}
