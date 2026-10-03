import { Trans } from "@lingui/react/macro";

import { ThemeSelector } from "./theme";
import { TimeFormatSettings } from "./time-format";

import { SettingsPageTitle } from "~/settings/page-title";
import { SettingsGroup } from "~/settings/setting-row";

export function SettingsAppearance() {
  return (
    <div className="flex flex-col gap-8">
      <SettingsPageTitle
        title={<Trans>Appearance</Trans>}
        description={<Trans>Theme and how times look.</Trans>}
      />
      <ThemeSelector />
      <SettingsGroup title={<Trans>Time</Trans>}>
        <TimeFormatSettings />
      </SettingsGroup>
      {/* Fork: the alternate app icons stay hidden (they carry the upstream
          brand), and the Folder/Tags sidebar fields are gone because the
          timeline they style is hidden (ux-audit-oct3 E, NN/g #4, #8). */}
    </div>
  );
}
