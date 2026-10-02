import { useLingui } from "@lingui/react/macro";

import {
  normalizeAudioRetention,
  type AudioRetentionPolicy,
} from "~/services/audio-retention-policy";
import { useConfigValue } from "~/shared/config";
import { useTabs } from "~/store/zustand/tabs";

// Fork: Granola deletes audio after transcription; we keep it, so say so.
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

  return (
    <button
      type="button"
      data-audio-saved-line
      data-tauri-drag-region="false"
      title={t`Change how long recordings are kept`}
      onClick={() => openNew({ type: "settings", state: { tab: "meetings" } })}
      className="text-muted-foreground hover:text-foreground min-w-0 truncate px-2 text-xs transition-colors"
    >
      {t`Audio saved on this Mac · kept ${kept}`}
    </button>
  );
}
