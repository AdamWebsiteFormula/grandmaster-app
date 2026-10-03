import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { platform } from "@tauri-apps/plugin-os";

import { SettingSwitchRow } from "~/settings/setting-row";

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
  const keepReachable = <Trans>Keep Upshot in the Dock or the menu bar.</Trans>;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="flex flex-col gap-4">
          {!appStoreBuild && (
            <>
              <SettingSwitchRow
                title={<Trans>Start Upshot at login</Trans>}
                description={
                  <Trans>Have Upshot ready when you log in to your Mac.</Trans>
                }
                checked={autostart.value}
                onChange={autostart.onChange}
              />
              {/* Fork: NN/g "error prevention" - the updater is off in this app, so no update toggle. */}
            </>
          )}
          {isMacos && (
            <SettingSwitchRow
              title={<Trans>Show app in Dock</Trans>}
              description={
                dockIsLastOn ? (
                  keepReachable
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
            title={
              isMacos ? (
                <Trans>Show in menu bar</Trans>
              ) : (
                <Trans>Show tray icon</Trans>
              )
            }
            description={
              trayIsLastOn ? (
                keepReachable
              ) : isMacos ? (
                <Trans>Open Upshot from the menu bar.</Trans>
              ) : undefined
            }
            checked={showTrayIcon.value}
            onChange={showTrayIcon.onChange}
            disabled={trayIsLastOn || showTrayIcon.disabled}
          />
        </div>
      </section>
    </div>
  );
}
