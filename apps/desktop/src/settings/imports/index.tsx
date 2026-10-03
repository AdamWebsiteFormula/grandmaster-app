import { Trans } from "@lingui/react/macro";

import { commands as openerCommands } from "@anlg/plugin-opener2";
import { ArrowSquareOut } from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";

import { MeetingImportScreen } from "~/imports/screen";
import { SettingsPageTitle } from "~/settings/page-title";

const IMPORTS_DOCUMENTATION_URL =
  "https://github.com/AdamWebsiteFormula/grandmaster-app";

export function SettingsImports() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <SettingsPageTitle
          title={<Trans>Imports</Trans>}
          description={
            <Trans>Bring in notes from Granola or transcript files.</Trans>
          }
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            void openerCommands.openUrl(IMPORTS_DOCUMENTATION_URL, null)
          }
        >
          <Trans>Help</Trans>
          <ArrowSquareOut className="size-3.5" />
        </Button>
      </div>
      <MeetingImportScreen />
    </div>
  );
}
