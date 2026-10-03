import { Trans } from "@lingui/react/macro";

import { ThemeSelector } from "./theme";
import { TimeFormatSettings } from "./time-format";

import { SettingsPageTitle } from "~/settings/page-title";

export function SettingsAppearance() {
  return (
    <div className="flex max-w-5xl flex-col gap-10">
      <SettingsPageTitle title={<Trans>Appearance</Trans>} />
      <ThemeSelector />
      <TimeFormatSettings />
      {/* Fork: the alternate app icons stay hidden (they carry the upstream
          brand), and the Folder/Tags sidebar fields are gone because the
          timeline they style is hidden (ux-audit-oct3 E, NN/g #4, #8). */}
    </div>
  );
}
