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
import { SETTINGS_ANCHORS, scrollToSettingsElement } from "~/settings/sections";
import { SettingLinkRow, SettingsGroup } from "~/settings/setting-row";
import { usePermission } from "~/shared/hooks/usePermissions";
import { isMac } from "~/shared/shortcut-label";
import { type SettingsTab, useTabs } from "~/store/zustand/tabs";

export function SettingsConnectors() {
  const { t } = useLingui();
  const calendar = usePermission("calendar");
  // Fork: the calendar is the Mac's Calendar and Glaido is a Mac app, so
  // their rows show on a Mac only; the rest of the group works everywhere
  // (NN/g heuristic #5, error prevention).
  const mac = isMac();
  const currentTab = useTabs((state) => state.currentTab);
  const updateSettingsTabState = useTabs(
    (state) => state.updateSettingsTabState,
  );
  // Fork: a row for one section of a page scrolls to that section
  // (NN/g heuristic #4; settings/sections.ts SETTINGS_ANCHORS).
  const open = (tab: SettingsTab, anchor?: string) => {
    if (currentTab?.type === "settings") {
      updateSettingsTabState(currentTab, { tab });
      if (anchor) scrollToSettingsElement(anchor);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <SettingsPageTitle
        title={<Trans>Connectors</Trans>}
        description={<Trans>Connect Upshot to the tools you use.</Trans>}
      />
      <SettingsGroup
        // Fork: "Apps and tools" on every system; "On this Mac" did not fit
        // webhooks, which send notes elsewhere (picture review, Oct 9; NN/g
        // #2).
        title={<Trans>Apps and tools</Trans>}
      >
        {mac ? (
          <>
            <SettingLinkRow
              icon={CalendarDots}
              // Fork: "Calendar", not "Apple Calendar": it reads every
              // account in the Mac's Calendar (Google, Outlook, iCloud).
              title={<Trans>Calendar</Trans>}
              description={
                <Trans>See upcoming meetings and pick calendars.</Trans>
              }
              // Fork: a status either way, as Granola's "1/2 Connected"
              // (journey-account-settings P3; NN/g #1), in the same words:
              // Connected or Not connected (NN/g #4).
              value={
                calendar.status === "authorized"
                  ? t`Connected`
                  : t`Not connected`
              }
              onClick={() => open("calendars")}
            />
            <SettingLinkRow
              icon={Lightning}
              title={<Trans>Glaido</Trans>}
              description={<Trans>Ask about your meetings from Glaido.</Trans>}
              onClick={() => open("developers", SETTINGS_ANCHORS.glaido)}
            />
          </>
        ) : null}
        <SettingLinkRow
          icon={Code}
          title={<Trans>MCP and CLI</Trans>}
          description={
            <Trans>Use your notes in AI tools and the terminal.</Trans>
          }
          onClick={() => open("developers", SETTINGS_ANCHORS.cli)}
        />
        <SettingLinkRow
          icon={ShareNetwork}
          title={<Trans>Webhooks</Trans>}
          description={<Trans>Send finished notes to other tools.</Trans>}
          onClick={() => open("developers", SETTINGS_ANCHORS.webhooks)}
        />
      </SettingsGroup>
      <SettingsGroup title={<Trans>Files</Trans>}>
        <SettingLinkRow
          icon={FolderSimple}
          title={<Trans>Export folder</Trans>}
          // Fork: the serial comma (Apple Style Guide; NN/g #4).
          description={<Trans>Where PDF, text, and Markdown exports are saved.</Trans>}
          onClick={() => open("app", SETTINGS_ANCHORS.storage)}
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
