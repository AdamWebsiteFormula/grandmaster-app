import { Trans } from "@lingui/react/macro";

import { ExportLocationRow } from "./export-location";
import {
  LegacyMigrationCleanupRow,
  useLegacyMigrationCleanup,
} from "./legacy-cleanup";

import { SETTINGS_ANCHORS } from "~/settings/sections";
import { SettingsGroup } from "~/settings/setting-row";

export function StorageSettingsView() {
  const { visible } = useLegacyMigrationCleanup();

  return (
    <SettingsGroup id={SETTINGS_ANCHORS.storage} title={<Trans>Storage</Trans>}>
      <ExportLocationRow />
      {visible && (
        <div>
          <LegacyMigrationCleanupRow />
        </div>
      )}
    </SettingsGroup>
  );
}
