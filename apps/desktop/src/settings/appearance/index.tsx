import { Trans } from "@lingui/react/macro";

import { ThemeSelector } from "./theme";
import { TimeFormatSettings } from "./time-format";

import { settingsSectionId } from "~/settings/sections";
import { SettingsGroup } from "~/settings/setting-row";

// Fork: Appearance is a section of General, not its own page, as Granola
// (Preferences › Appearance) and Claude desktop keep it
// (grandmaster/sops/settings-ia-oct3.md Q2). The alternate app icons stay
// hidden (they carry the upstream brand).
export function AppearanceSection() {
  return (
    <SettingsGroup
      id={settingsSectionId("appearance")}
      title={<Trans>Appearance</Trans>}
    >
      <ThemeSelector />
      <TimeFormatSettings />
    </SettingsGroup>
  );
}
