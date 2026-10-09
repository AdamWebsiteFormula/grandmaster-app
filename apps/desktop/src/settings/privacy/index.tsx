import { useLingui } from "@lingui/react/macro";
import { platform } from "@tauri-apps/plugin-os";

import { CircleNotch, LockKey } from "@anlg/ui/components/icons";
import { useMountEffect } from "@anlg/ui/hooks/use-mount-effect";

import { DEVICE_AUTH_REASON } from "~/lock/auth";
import { useAppLock } from "~/lock/store";
import { privacyMessages } from "~/settings/general/app-settings";
import {
  useSetSettingValues,
  useStoredSettingValuesQuery,
} from "~/settings/queries";
import { settingsSectionId } from "~/settings/sections";
import { SettingsGroup, SettingSwitchRow } from "~/settings/setting-row";
import { resolveConfigValue } from "~/shared/config";

// Fork: Privacy is a section of General, as Granola keeps "Data & sharing"
// in Preferences (grandmaster/sops/settings-ia-oct3.md Q3).
export function PrivacySection() {
  const { i18n, t } = useLingui();
  const settingsQuery = useStoredSettingValuesQuery();
  const setSettingValues = useSetSettingValues();
  const available = useAppLock((state) => state.available);
  const authenticating = useAppLock((state) => state.authenticating);
  const authenticate = useAppLock((state) => state.authenticate);
  const unlockApp = useAppLock((state) => state.unlockApp);
  const refreshAvailability = useAppLock((state) => state.refreshAvailability);

  useMountEffect(() => {
    void refreshAvailability();
  });

  if (settingsQuery.error) {
    throw settingsQuery.error;
  }
  // Fork: the General page's spinner, not a blank page, while settings
  // load (journey-account-settings P3; NN/g #1).
  if (settingsQuery.isLoading || !settingsQuery.data) {
    return (
      <div className="flex min-h-48 items-center justify-center">
        <CircleNotch
          aria-label={t`Loading settings`}
          className="text-muted-foreground size-5 animate-spin"
        />
      </div>
    );
  }

  const lockAppEnabled = resolveConfigValue("lock_app", settingsQuery.data);
  const authAvailable = available === true;
  const lockAppDescription = !authAvailable
    ? t`Device authentication is not available on this computer.`
    : platform() === "windows"
      ? t`Require Windows Hello face, PIN, or password when opening Upshot.`
      : t`Require Touch ID or your password when opening Upshot.`;

  return (
    <>
      {/* Fork: the usage-data and error-report switches did nothing (no
          telemetry keys ship in Upshot), so they are gone; say so plainly
          instead (ux-audit-oct3 E, NN/g #1, #2). The note is the group's
          footer, with no negative margin (journey-account-settings P3). */}
      <SettingsGroup
        id={settingsSectionId("privacy")}
        title={i18n._(privacyMessages.title)}
        footer={t`Upshot sends no usage data or crash reports.`}
      >
        <SettingSwitchRow
          icon={LockKey}
          title={t`Lock app`}
          description={lockAppDescription}
          checked={lockAppEnabled && authAvailable}
          disabled={!authAvailable || authenticating}
          onChange={(next) => {
            void (async () => {
              const canAuth = await refreshAvailability();
              if (!canAuth) return;
              // Fork: turning the lock on asked for Touch ID, locked the app
              // at once and asked again. The first prompt now counts as the
              // unlock; the lock applies the next time the app is hidden or
              // opened (task test, Oct 8; NN/g #7).
              const ok = next
                ? await unlockApp(DEVICE_AUTH_REASON.changeLockSettings)
                : await authenticate(DEVICE_AUTH_REASON.changeLockSettings);
              if (!ok) return;
              setSettingValues({ lock_app: next });
            })();
          }}
        />
      </SettingsGroup>
    </>
  );
}
