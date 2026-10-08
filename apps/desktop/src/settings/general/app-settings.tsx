import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { platform } from "@tauri-apps/plugin-os";

import { AppWindow, Desktop, Rocket } from "@anlg/ui/components/icons";

import { SettingsGroup, SettingSwitchRow } from "~/settings/setting-row";

export const privacyMessages = {
  title: msg`Privacy`,
};

interface SettingItem {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

interface AppSettingsViewProps {
  appStoreBuild: boolean;
  autostart: SettingItem;
  automaticUpdates: SettingItem;
  showAppInDock: SettingItem;
  showTrayIcon: SettingItem;
}

export function AppSettingsView({
  appStoreBuild,
  autostart,
  showAppInDock,
  showTrayIcon,
}: AppSettingsViewProps) {
  const currentPlatform = platform();
  const isMacos = currentPlatform === "macos";
  // Fork: Upshot must stay reachable, so the last of Dock and menu bar that
  // is on can't be turned off (ux-audit-oct3 E, HIG; NN/g #5).
  const dockIsLastOn = isMacos && showAppInDock.value && !showTrayIcon.value;
  const trayIsLastOn = isMacos && showTrayIcon.value && !showAppInDock.value;
  // Fork: a locked switch says what to turn on, as Meetings' "Join scheduled
  // meetings" does (picture review, Oct 8; NN/g #1, #4).
  const dockLockedReason = (
    <Trans>Turn on “Show in menu bar” first.</Trans>
  );
  const trayLockedReason = <Trans>Turn on “Show app in Dock” first.</Trans>;

  return (
    <SettingsGroup title={<Trans>App</Trans>}>
      {!appStoreBuild && (
        <>
          <SettingSwitchRow
            icon={Rocket}
            title={<Trans>Start Upshot at login</Trans>}
            description={
              // Fork: "your computer" off a Mac (NN/g heuristic #2, the
              // user's words).
              isMacos ? (
                <Trans>Have Upshot ready when you log in to your Mac.</Trans>
              ) : (
                <Trans>
                  Have Upshot ready when you log in to your computer.
                </Trans>
              )
            }
            checked={autostart.value}
            onChange={autostart.onChange}
          />
          {/* Fork: NN/g "error prevention" - the updater is off in this app, so no update toggle. */}
        </>
      )}
      {isMacos && (
        <SettingSwitchRow
          icon={AppWindow}
          title={<Trans>Show app in Dock</Trans>}
          description={
            dockIsLastOn ? (
              dockLockedReason
            ) : (
              <Trans>Show Upshot in the Dock and app switcher.</Trans>
            )
          }
          checked={showAppInDock.value}
          onChange={showAppInDock.onChange}
          disabled={dockIsLastOn || showAppInDock.disabled}
        />
      )}
      <SettingSwitchRow
        icon={Desktop}
        title={
          isMacos ? (
            <Trans>Show in menu bar</Trans>
          ) : (
            <Trans>Show tray icon</Trans>
          )
        }
        description={
          trayIsLastOn ? (
            trayLockedReason
          ) : isMacos ? (
            <Trans>Open Upshot from the menu bar.</Trans>
          ) : undefined
        }
        checked={showTrayIcon.value}
        onChange={showTrayIcon.onChange}
        disabled={trayIsLastOn || showTrayIcon.disabled}
      />
    </SettingsGroup>
  );
}
