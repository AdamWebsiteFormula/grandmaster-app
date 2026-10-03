// Fork: Settings › Profile, local and with no account, as Granola's Profile
// page (Account, Your company, Account management; granola-compare-oct3
// section 8). It edits the same personal contact card as before.
import { Trans, useLingui } from "@lingui/react/macro";

import { DownloadSimple } from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";

import { AccountProfile } from "~/settings/general/account-profile";
import { SettingsPageTitle } from "~/settings/page-title";
import { SettingLinkRow, SettingsGroup } from "~/settings/setting-row";
import { useTabs } from "~/store/zustand/tabs";
import { openUpshotSignIn, signOutUpshot, useUpshotPlan } from "~/upshot-plan";

export function SettingsProfile() {
  const currentTab = useTabs((state) => state.currentTab);
  const updateSettingsTabState = useTabs(
    (state) => state.updateSettingsTabState,
  );

  return (
    <div className="flex flex-col gap-8">
      <SettingsPageTitle
        title={<Trans>Profile</Trans>}
        description={
          <Trans>Your contact card in Upshot. It stays on this Mac.</Trans>
        }
      />
      <AccountProfile />
      <SettingsGroup title={<Trans>Your notes</Trans>}>
        <SettingLinkRow
          icon={DownloadSimple}
          title={<Trans>Import notes</Trans>}
          description={
            <Trans>Bring in notes from Granola or transcript files.</Trans>
          }
          onClick={() => {
            if (currentTab?.type === "settings") {
              updateSettingsTabState(currentTab, { tab: "imports" });
            }
          }}
        />
      </SettingsGroup>
      <AccountSection />
    </div>
  );
}

// Fork: Sign in and Sign out live on Profile, as Granola keeps them under
// Settings › Profile › Account management (redline-oct3 Settings).
export function AccountSection() {
  const { t } = useLingui();
  const { email, isSignedIn } = useUpshotPlan();

  return (
    <SettingsGroup title={<Trans>Account</Trans>}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {isSignedIn ? (
              <Trans>Signed in</Trans>
            ) : (
              <Trans>Not signed in</Trans>
            )}
          </p>
          <p
            className="text-muted-foreground mt-0.5 truncate text-xs"
            title={isSignedIn && email ? email : undefined}
          >
            {isSignedIn ? (
              (email ?? t`Upshot account`)
            ) : (
              <Trans>You're on Free. No account needed.</Trans>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 text-sm"
          onClick={() =>
            isSignedIn ? void signOutUpshot() : openUpshotSignIn()
          }
        >
          {isSignedIn ? <Trans>Sign out</Trans> : <Trans>Sign in</Trans>}
        </Button>
      </div>
    </SettingsGroup>
  );
}
