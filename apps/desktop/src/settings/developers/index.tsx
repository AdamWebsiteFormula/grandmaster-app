import { t } from "@lingui/core/macro";

import { commands as openerCommands } from "@anlg/plugin-opener2";
import { ArrowSquareOut } from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";

import { CliSettingsSections } from "./cli";
import { GlaidoSection } from "./glaido";
import { WebhooksSection } from "./webhooks";

import { SettingsPageTitle } from "~/settings/page-title";
import { isMac } from "~/shared/shortcut-label";

export { buildMcpConfiguration, getCliInstallNotification } from "./cli";

const DEVELOPERS_GUIDE_URL =
  "https://github.com/AdamWebsiteFormula/grandmaster-app";

export function SettingsDevelopers() {
  // Fork: Glaido is a Mac app, so its section and name show on a Mac only
  // (NN/g heuristic #5, error prevention).
  const mac = isMac();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <SettingsPageTitle
          title={t`Developers`}
          description={
            mac
              ? t`Connect Upshot to Glaido, the CLI and webhooks.`
              : t`Connect Upshot to the CLI and webhooks.`
          }
        />
        {/* Fork: one name and style for help links across Settings
            (ux-audit-oct3 E, NN/g #4). */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            void openerCommands.openUrl(DEVELOPERS_GUIDE_URL, null)
          }
        >
          {t`Help`}
          <ArrowSquareOut className="size-3.5" />
        </Button>
      </div>
      {/* Fork: Glaido first; it is the integration most people use
          (ux-audit-oct3 E, NN/g #4). */}
      {mac ? <GlaidoSection /> : null}
      <CliSettingsSections />
      {/* Fork: cloud API hidden (blueprint section 5); local CLI and webhooks stay. */}
      <WebhooksSection />
    </div>
  );
}
