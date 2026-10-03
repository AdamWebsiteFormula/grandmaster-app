import { Trans } from "@lingui/react/macro";

import { ExportLocationRow } from "./export-location";
import {
  LegacyMigrationCleanupRow,
  useLegacyMigrationCleanup,
} from "./legacy-cleanup";

import { SettingsSectionTitle } from "~/settings/page-title";

export function StorageSettingsView() {
  const { visible } = useLegacyMigrationCleanup();

  return (
    <div>
      <SettingsSectionTitle className="mb-4">
        <Trans>Storage</Trans>
      </SettingsSectionTitle>
      <div className="flex flex-col gap-3">
        <ExportLocationRow />
        {visible && <LegacyMigrationCleanupRow />}
      </div>
    </div>
  );
}
