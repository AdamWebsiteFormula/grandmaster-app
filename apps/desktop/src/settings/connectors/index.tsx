// Fork: Settings › Connectors, a list card of what Upshot connects to, as
// Granola's Connectors page (logo, name, one line, chevron;
// granola-compare-oct3 section 8). Every row opens the settings that
// already exist for it; nothing here needs an account or the cloud.
import { Trans, useLingui } from "@lingui/react/macro";

import {
  CalendarDots,
  Code,
  DownloadSimple,
  FolderSimple,
  Lightning,
  ShareNetwork,
} from "@anlg/ui/components/icons";

import { SettingsPageTitle } from "~/settings/page-title";
import { SettingLinkRow, SettingsGroup } from "~/settings/setting-row";
import { usePermission } from "~/shared/hooks/usePermissions";
import { type SettingsTab, useTabs } from "~/store/zustand/tabs";

export function SettingsConnectors() {
  const { t } = useLingui();
  const calendar = usePermission("calendar");
  const currentTab = useTabs((state) => state.currentTab);
  const updateSettingsTabState = useTabs(
    (state) => state.updateSettingsTabState,
  );
  const open = (tab: SettingsTab) => {
    if (currentTab?.type === "settings") {
      updateSettingsTabState(currentTab, { tab });
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <SettingsPageTitle
        title={<Trans>Connectors</Trans>}
        description={<Trans>Connect Upshot to the tools you use.</Trans>}
      />
      <SettingsGroup title={<Trans>On this Mac</Trans>}>
        <SettingLinkRow
          icon={CalendarDots}
          title={<Trans>Apple Calendar</Trans>}
          description={<Trans>See upcoming meetings and pick calendars.</Trans>}
          // Fork: a status either way, as Granola's "1/2 Connected"
          // (journey-account-settings P3; NN/g #1).
          value={calendar.status === "authorized" ? t`Connected` : t`Off`}
          onClick={() => open("calendars")}
        />
        <SettingLinkRow
          icon={Lightning}
          title={<Trans>Glaido</Trans>}
          description={<Trans>Ask about your meetings from Glaido.</Trans>}
          onClick={() => open("developers")}
        />
        <SettingLinkRow
          icon={Code}
          title={<Trans>MCP and CLI</Trans>}
          description={
            <Trans>Use your notes in AI tools and the terminal.</Trans>
          }
          onClick={() => open("developers")}
        />
        <SettingLinkRow
          icon={ShareNetwork}
          title={<Trans>Webhooks</Trans>}
          description={<Trans>Send finished notes to other tools.</Trans>}
          onClick={() => open("developers")}
        />
      </SettingsGroup>
      <SettingsGroup title={<Trans>Files</Trans>}>
        <SettingLinkRow
          icon={FolderSimple}
          title={<Trans>Export folder</Trans>}
          description={<Trans>Save PDF, text, Markdown and Org exports.</Trans>}
          onClick={() => open("app")}
        />
        <SettingLinkRow
          icon={DownloadSimple}
          title={<Trans>Import notes</Trans>}
          description={
            <Trans>Bring in notes from Granola or transcript files.</Trans>
          }
          onClick={() => open("imports")}
        />
      </SettingsGroup>
    </div>
  );
}
