import { Trans } from "@lingui/react/macro";

import { ExportLocationRow } from "./export-location";
import {
  LegacyMigrationCleanupRow,
  useLegacyMigrationCleanup,
} from "./legacy-cleanup";

import { SettingsGroup } from "~/settings/setting-row";

export function StorageSettingsView() {
  const { visible } = useLegacyMigrationCleanup();

  return (
    <SettingsGroup title={<Trans>Storage</Trans>}>
      <ExportLocationRow />
      {visible && (
        <div>
          <LegacyMigrationCleanupRow />
        </div>
      )}
    </SettingsGroup>
  );
}
